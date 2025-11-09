/**
 * src/merge.ts
 * Merge token data from multiple APIs into one canonical object
 */

import { Token } from "./types";

/**
 * Merge incoming token data into existing token data
 * Prefers sources with higher liquidity for price
 */
export function mergeTokens(existing: Token | null, incoming: Token): Token {
  if (!existing) {
    incoming.last_updated = Date.now();
    incoming.protocols = Array.from(new Set(incoming.protocols || []));
    return incoming;
  }

  const merged: Token = { ...existing };

  merged.token_name = incoming.token_name || merged.token_name;
  merged.token_ticker = incoming.token_ticker || merged.token_ticker;
  merged.protocols = Array.from(
    new Set([...(merged.protocols || []), ...(incoming.protocols || [])])
  );
  merged.sources = { ...(merged.sources || {}), ...(incoming.sources || {}) };

  const existingL = merged.liquidity_sol ?? 0;
  const inL = incoming.liquidity_sol ?? 0;

  // Prefer source with higher liquidity
  if (inL > existingL) {
    merged.price_sol = incoming.price_sol ?? merged.price_sol;
  } else if (inL > 0 || existingL > 0) {
    merged.price_sol =
      ((merged.price_sol || 0) * existingL +
        (incoming.price_sol || 0) * inL) /
      ((existingL + inL) || 1);
  } else {
    merged.price_sol = incoming.price_sol ?? merged.price_sol;
  }

  merged.liquidity_sol = (existingL + inL) || merged.liquidity_sol;
  merged.market_cap_sol = incoming.market_cap_sol ?? merged.market_cap_sol;
  merged.volume_sol =
    (merged.volume_sol || 0) + (incoming.volume_sol || 0);
  merged.transaction_count =
    (merged.transaction_count || 0) + (incoming.transaction_count || 0);

  merged.price_1hr_change =
    incoming.price_1hr_change ?? merged.price_1hr_change;
  merged.price_24hr_change =
    incoming.price_24hr_change ?? merged.price_24hr_change;
  merged.last_updated = Date.now();

  return merged;
}
