/**
 * src/types.ts
 * Shared TypeScript types
 */

export type Token = {
  token_address: string;
  token_name?: string;
  token_ticker?: string;
  price_sol?: number;
  market_cap_sol?: number;
  volume_sol?: number;
  liquidity_sol?: number;
  transaction_count?: number;
  price_1hr_change?: number;
  price_24hr_change?: number;
  price_7d_change?: number;
  protocols?: string[];
  sources?: Record<string, any>;
  last_updated?: number;
};
