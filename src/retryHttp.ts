/**
 * src/retryHttp.ts
 * Axios wrapper with exponential backoff + jitter for reliability
 */

import axios, { AxiosRequestConfig } from "axios";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch with retry/backoff (handles 429, 5xx errors)
 */
export async function fetchWithBackoff(
  url: string,
  opts?: AxiosRequestConfig,
  maxAttempts = 5,
  baseDelay = 300
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await axios({ url, timeout: 10000, ...opts });
    } catch (err: any) {
      const status = err?.response?.status;
      const retriable = !status || status >= 500 || status === 429;
      if (!retriable || attempt === maxAttempts - 1) throw err;

      const jitter = Math.floor(Math.random() * baseDelay);
      const delay = Math.min(10000, baseDelay * 2 ** attempt + jitter);
      console.warn(
        `Retry ${attempt + 1}/${maxAttempts} for ${url} in ${delay}ms (status: ${status})`
      );
      await sleep(delay);
    }
  }
  throw new Error("Max retries reached");
}
