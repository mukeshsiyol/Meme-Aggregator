/**
 * src/cache.ts
 * Redis cache utility functions
 */

import Redis from "ioredis";
import config from "./config";

export const redis = new Redis(config.REDIS_URL);

/**
 * Set a JSON value in Redis
 * @param key Redis key
 * @param value JS object to stringify
 * @param ttlSec Optional TTL (in seconds)
 */
export async function setJson(key: string, value: any, ttlSec?: number) {
  const s = JSON.stringify(value);
  if (ttlSec) await redis.set(key, s, "EX", ttlSec);
  else await redis.set(key, s);
}

/**
 * Get a parsed JSON value from Redis
 */
export async function getJson<T = any>(key: string): Promise<T | null> {
  const v = await redis.get(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}
