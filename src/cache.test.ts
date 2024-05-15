import { expect, test } from "bun:test";

import { Sheet, SheetProxy, sleep } from "@okcontract/cells";

import { Address } from "./address";
import { RPCCache } from "./cache";
import { RPC } from "./caller";

import { defaultRPCOptions } from "./options";
import { BalanceQuery } from "./query";
import type { Chain } from "./types";

// biome-ignore lint/suspicious/noExportsInTest: used in tests only
export const polygon: Chain = {
  currency: "tok:matic",
  explorer: ["https://polygonscan.com"],
  id: "polygon",
  name: "Polygon (Matic)",
  net: "evm",
  numid: 137n,
  rpc: [
    "https://polygon-rpc.com",
    "https://polygon.llamarpc.com",
    "https://polygon.meowrpc.com",
    "https://rpc-mainnet.maticvigil.com"
  ]
};

test("reuse a RPC value", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({ polygon }, "polygon")
  };
  const rpc = new RPC(proxy, "polygon", options);
  const cache = new RPCCache(proxy, rpc, options);

  const balQ1 = BalanceQuery(
    new Address("0xAee5667c86bf40e873b7e33A59d1E0358cF8eBE5")
  );

  // We need to await here because of the query hash computation.
  const bal1 = await cache.cell(balQ1);

  expect(bal1.value).toBeUndefined();
  expect(cache._counter).toBe(0);

  await sleep(1800);

  expect(cache._counter).toBe(1);
  expect(bal1?.value).toHaveProperty("result");

  // Create the same RPC request a second time.
  const bal2 = await cache.cell(balQ1);
  // cache._append(await computeHash(balQ1));

  expect(bal2?.value).toHaveProperty("result");
  expect(cache._counter).toBe(1);
});

test("get multiple RPC values", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const options = {
    ...defaultRPCOptions(proxy),
    chains: proxy.new({ polygon })
  };
  const rpc = new RPC(proxy, "polygon", options);
  const cache = new RPCCache(proxy, rpc, options);

  const balQ1 = BalanceQuery(
    new Address("0xAee5667c86bf40e873b7e33A59d1E0358cF8eBE5")
  );
  const balQ2 = BalanceQuery(
    new Address("0xd683cbeb396b460e1866c1504ab2661b544d74af")
  );

  // We need to await here because of the query hash computation.
  const bal1 = await cache.cell(balQ1);
  const bal2 = await cache.cell(balQ2);

  expect(bal1.value).toBeUndefined();
  expect(bal2.value).toBeUndefined();
  expect(cache._counter).toBe(0);

  await sleep(1800);

  console.log({ bal1: bal1.value, bal2: bal2.value });
  expect(cache._counter).toBe(1);
  expect(bal1?.value).toHaveProperty("result");
  expect(bal2?.value).toHaveProperty("result");
});

test(
  "validity",
  async () => {
    const sheet = new Sheet();
    const proxy = new SheetProxy(sheet);
    const options = {
      ...defaultRPCOptions(proxy),
      chains: proxy.new({ polygon }),
      loopDelay: 1000
    };
    const rpc = new RPC(proxy, "polygon", options);
    const cache = new RPCCache(proxy, rpc, options);

    const balQ1 = BalanceQuery(
      new Address("0x082489A616aB4D46d1947eE3F912e080815b08DA")
    );

    // 3 sec validity
    const bal1 = await cache.cell(balQ1, { validity: 3 });

    expect(bal1.value).toBeUndefined();
    expect(cache._counter).toBe(0);
    await sleep(2000);
    expect(cache._counter).toBe(1);
    expect(bal1?.value).toHaveProperty("result");
    await sleep(1200);
    expect(cache._counter).toBe(1);
    await sleep(3000);
    expect(cache._counter).toBe(2);
    expect(bal1?.value).toHaveProperty("result");
  },
  { timeout: 8000 }
);
