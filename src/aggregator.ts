/**
 * src/aggregator.ts
 * Aggregates live meme-coin data from DexScreener, Jupiter, and GeckoTerminal.
 * Uses Redis caching and emits live updates via Socket.io.
 */

import config from "./config";
import { fetchWithBackoff } from "./retryHttp";
import { redis, setJson, getJson } from "./cache";
import { mergeTokens } from "./merge";
import { Server as SocketIOServer } from "socket.io";
import { Token } from "./types";

/**
 * API endpoints and helper generators
 */
const DEXS = {
  dexscreenerSearch: (q: string) =>
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
  dexscreenerToken: (addr: string) =>
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(addr)}`,
  jupiter: (ids: string) =>
    `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids)}`,
  geckoterminal: () =>
    `https://api.geckoterminal.com/api/v2/networks/solana/tokens`,
};

/**
 * Aggregator class — handles periodic polling, merging, caching, and WS updates
 */
export class Aggregator {
  io: SocketIOServer;
  running = false;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /** Start the continuous polling loop */
  async start() {
    if (this.running) return;
    this.running = true;
    console.log("🚀 Aggregator started. Polling every", config.POLL_INTERVAL_MS, "ms");
    this.loop();
  }

  /** Poll all APIs in a loop */
  async loop() {
    while (this.running) {
      try {
        await this.doPollOnce();
      } catch (e) {
        console.error("❌ Poll error:", e);
      }
      await new Promise((r) => setTimeout(r, config.POLL_INTERVAL_MS));
    }
  }

  /** Helper: avoid DexScreener rate limit (~300/min) */
  async paceRequests(items: any[], fn: (it: any) => Promise<void>, delayMs = 250) {
    for (const it of items) {
      try {
        await fn(it);
      } catch (e) {
        console.warn("DexScreener request failed:", (e as any)?.message);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  /** One full data aggregation cycle */
  async doPollOnce() {
    console.log("🔄 Polling APIs for latest token data...");

    // 1️⃣ Get top Solana tokens from GeckoTerminal
    let geckoTokens: any[] = [];
    try {
      const gresp = await fetchWithBackoff(DEXS.geckoterminal());
      geckoTokens = gresp.data?.data || [];
    } catch (e) {
      console.warn("⚠️ GeckoTerminal fetch failed:", (e as any)?.message);
      geckoTokens = [];
    }

    const top = Math.min(30, geckoTokens.length || 30);
    const topAddresses = geckoTokens
      .slice(0, top)
      .map(
        (t: any) =>
          (t?.attributes?.address ||
            t?.token_address ||
            t?.address ||
            "").toString().toLowerCase()
      )
      .filter(Boolean);

    // 2️⃣ DexScreener: fetch details for each token (paced)
    const dexResults: any[] = [];
    await this.paceRequests(topAddresses, async (addr: string) => {
      const dsResp = await fetchWithBackoff(DEXS.dexscreenerToken(addr));
      const pairs = dsResp.data?.pairs || [];
      if (pairs?.length) dexResults.push(...pairs);
    });

    // 3️⃣ Jupiter: get batch prices
    let jupData: Record<string, any> = {};
    try {
      if (topAddresses.length) {
        const ids = topAddresses.join(",");
        const jupResp = await fetchWithBackoff(DEXS.jupiter(ids));
        jupData = jupResp.data?.data || {};
      }
    } catch (e) {
      console.warn("⚠️ Jupiter fetch failed:", (e as any)?.message);
    }

    // 4️⃣ Merge all sources into unified tokens
    const incomingTokens: Token[] = [];

    for (const g of geckoTokens.slice(0, top)) {
      const addr = (
        g?.attributes?.address ||
        g?.token_address ||
        g?.address ||
        ""
      )
        .toString()
        .toLowerCase();
      if (!addr) continue;

      const dsMatch = dexResults.find(
        (d) =>
          (d?.baseToken?.address || d?.tokenAddress || "")
            .toString()
            .toLowerCase() === addr
      );
      const jupMatch = jupData[addr] || jupData[addr.toUpperCase()] || null;

      const token: Token = {
        token_address: addr,
        token_name:
          g?.attributes?.name ||
          dsMatch?.baseToken?.name ||
          g?.name ||
          "Unknown",
        token_ticker:
          g?.attributes?.symbol ||
          dsMatch?.baseToken?.symbol ||
          g?.symbol ||
          "",
        price_sol:
          jupMatch?.price ||
          Number(dsMatch?.priceUsd) ||
          Number(g?.attributes?.price_usd) ||
          0,
        market_cap_sol:
          g?.attributes?.market_cap_usd || dsMatch?.fdv || undefined,
        volume_sol:
          Number(dsMatch?.volumeUsd) ||
          Number(g?.attributes?.volume_usd_24h) ||
          0,
        liquidity_sol:
          Number(dsMatch?.liquidityUsd) ||
          Number(g?.attributes?.liquidity_usd) ||
          0,
        price_1hr_change: g?.attributes?.price_change_percentage_1h || 0,
        price_24hr_change: g?.attributes?.price_change_percentage_24h || 0,
        protocols: [
          dsMatch?.dex ||
            g?.attributes?.protocol ||
            "unknown",
        ],
        sources: {
          geckoterminal: g,
          dexscreener: dsMatch || undefined,
          jupiter: jupMatch || undefined,
        },
        last_updated: Date.now(),
      };

      incomingTokens.push(token);
    }

    // 5️⃣ Save to Redis + emit updates
    for (const inc of incomingTokens) {
      const key = `token:${inc.token_address}`;
      const existing = await getJson<Token>(key);
      const merged = mergeTokens(existing || null, inc);

      const priceChangeRatio =
        existing?.price_sol && merged.price_sol
          ? Math.abs(merged.price_sol - existing.price_sol) /
            Math.max(existing.price_sol, 1)
          : 1;

      const volumeChange =
        Math.abs((merged.volume_sol || 0) - (existing?.volume_sol || 0)) > 0.5;

      const significant = !existing || priceChangeRatio > 0.001 || volumeChange;

      await setJson(key, merged, config.CACHE_TTL_SECONDS * 4);
      await redis.zadd("tokens:by_volume", merged.volume_sol || 0, merged.token_address);

      if (significant) {
        // emit update
        const updatePayload = {
          token_address: merged.token_address,
          token_ticker: merged.token_ticker,
          price_sol: merged.price_sol,
          price_24hr_change: merged.price_24hr_change,
          volume_sol: merged.volume_sol,
          liquidity_sol: merged.liquidity_sol,
          last_updated: merged.last_updated,
          sources: merged.protocols,
        };

        if (config.ENABLE_WEBSOCKETS) {
          this.io.of("/discover").emit("token_update", updatePayload);
        }

        // detect volume spike (3×)
        if (
          existing?.volume_sol &&
          merged.volume_sol &&
          merged.volume_sol / existing.volume_sol > 3
        ) {
          this.io.of("/discover").emit("volume_spike", {
            token_address: merged.token_address,
            volume_sol: merged.volume_sol,
            delta:
              (merged.volume_sol || 0) - (existing.volume_sol || 0),
            timestamp: Date.now(),
          });
        }
      }
    }

    console.log(`✅ Aggregation complete: ${incomingTokens.length} tokens processed`);
  }
}
