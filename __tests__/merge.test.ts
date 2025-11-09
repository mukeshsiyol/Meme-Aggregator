import { mergeTokens } from "../src/merge";
import { Token } from "../src/types";

test("prefers higher liquidity price", () => {
  const existing: Token = {
    token_address: "a",
    price_sol: 1,
    liquidity_sol: 100,
  };
  const incoming: Token = {
    token_address: "a",
    price_sol: 2,
    liquidity_sol: 1000,
  };
  const merged = mergeTokens(existing, incoming);
  expect(merged.price_sol).toBe(2);
});

test("averages when both have liquidity", () => {
  const existing: Token = {
    token_address: "a",
    price_sol: 1,
    liquidity_sol: 100,
  };
  const incoming: Token = {
    token_address: "a",
    price_sol: 3,
    liquidity_sol: 100,
  };
  const merged = mergeTokens(existing, incoming);
  expect(merged.price_sol).toBeCloseTo(2.0, 5);
});
