import { expect, test } from "bun:test";

import { Sheet, SheetProxy } from "@okcontract/cells";

import { Address, type EVMAddress, nativeAddrEVM } from "./address";
import { nativeBalance } from "./balance";
import { LocalRPCSubscriber } from "./local";
import { MultiChainRPC } from "./multi";

test("native balance", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const rpc = new LocalRPCSubscriber(proxy, multi);

  const chain = proxy.new("ethereum");
  const owner = proxy.new<Address>(
    new Address("0x3a401D1B6aB6d751cC268d1420010140dE55eE38")
  );
  const bal = nativeBalance(proxy, rpc, chain, owner);
  const v = (await bal.get()) as bigint;
  expect(v).toBeGreaterThan(100000000n);
});
