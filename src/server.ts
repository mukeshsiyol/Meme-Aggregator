import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import config from "./config";
import { redis, getJson } from "./cache";
import { Aggregator } from "./aggregator";
import bodyParser from "body-parser";
import { Token } from "./types";

const app = express();
app.use(bodyParser.json());

/**
 * GET /tokens
 * Cursor-based pagination of tokens sorted by volume.
 */
app.get("/tokens", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const cursor = req.query.cursor as string | undefined;

    let offset = 0;
    if (cursor) {
      try {
        const dec = Buffer.from(cursor, "base64").toString("utf8");
        const parsed = JSON.parse(dec);
        offset = parsed.offset || 0;
      } catch {
        offset = 0;
      }
    }

    const start = offset;
    const stop = offset + limit - 1;

    // fetch token addresses sorted by volume (highest first)
    const addresses = await redis.zrevrange("tokens:by_volume", start, stop);

    const tokens: Token[] = [];
    for (const addr of addresses) {
      const t = await getJson<Token>(`token:${addr}`);
      if (t) tokens.push(t);
    }

    const nextCursor =
      addresses.length < limit
        ? null
        : Buffer.from(JSON.stringify({ offset: offset + limit })).toString(
            "base64"
          );

    const count = await redis.zcard("tokens:by_volume");

    res.json({ data: tokens, nextCursor, count });
  } catch (e) {
    console.error("GET /tokens error", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /health
 * Simple health check: verifies Redis connection.
 */
app.get("/health", async (_req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch (e) {
    console.error("Redis health check failed", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * Create HTTP + WebSocket server
 */
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*" },
});

/**
 * Socket.io Namespace: /discover
 * Emits live updates from the Aggregator.
 */
io.of("/discover").on("connection", (socket) => {
  console.log("client connected:", socket.id);
  socket.emit("connected", { message: "Connected to Meme Aggregator WS" });

  socket.on("subscribe", (payload) => {
    socket.data.sub = payload;
    console.log(`client ${socket.id} subscribed`, payload);
  });

  socket.on("disconnect", () => {
    console.log("client disconnected:", socket.id);
  });
});

/**
 * Start Aggregator Service
 */
const aggregator = new Aggregator(io);
aggregator.start().catch((e) => console.error("Aggregator start error", e));

/**
 * Start HTTP server
 */
server.listen(config.PORT, () =>
  console.log(`✅ Server listening on port ${config.PORT}`)
);
