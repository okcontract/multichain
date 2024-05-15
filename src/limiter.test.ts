import { expect, test } from "bun:test";

import { Sheet, SheetProxy, sleep } from "@okcontract/cells";

import { RateLimiter } from "./limiter";

test("RateLimiter", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const endpoints = proxy.new(["a", "b"], "endpoints");
  const limiter = new RateLimiter(endpoints, 50);
  expect(limiter.take("a")).toBe(true);
  expect(limiter.take("a")).toBe(false);
  expect(limiter.take("b")).toBe(true);
  await sleep(60);
  expect(limiter.take("a")).toBe(true);
  endpoints.update((l) => [...l, "c"]);
  expect(limiter.take("c")).toBe(true);
  expect(limiter.take("c")).toBe(false);
});
