/**
 * src/config.ts
 * Centralized configuration for Meme Aggregator Service
 */

import dotenv from "dotenv";

// Load environment variables from .env (if present)
dotenv.config();

/**
 * Exported configuration object used throughout the app
 */
const config = {
  /** HTTP server port */
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,

  /** Redis connection URL (e.g., redis://localhost:6379 or Upstash rediss:// URL) */
  REDIS_URL:
    process.env.REDIS_URL ||
    "redis://localhost:6379",

  /** Cache Time-To-Live in seconds (how long token data stays cached in Redis) */
  CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS
    ? Number(process.env.CACHE_TTL_SECONDS)
    : 30,

  /** How often aggregator polls DEX APIs (milliseconds) */
  POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS
    ? Number(process.env.POLL_INTERVAL_MS)
    : 10000,

  /** DexScreener API rate limit (per minute) */
  DEXS_SCREENER_RATE_LIMIT_PER_MIN: process.env.DEXS_SCREENER_RATE_LIMIT_PER_MIN
    ? Number(process.env.DEXS_SCREENER_RATE_LIMIT_PER_MIN)
    : 300,

  /** Logging level — can be set to debug/info/warn/error */
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  /** Toggle WebSocket updates (useful for debugging) */
  ENABLE_WEBSOCKETS:
    process.env.ENABLE_WEBSOCKETS === "false" ? false : true,
};

export default config;
