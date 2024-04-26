import { expect, test } from "bun:test";

import { Sheet, SheetProxy } from "@okcontract/cells";

import { estimateGas } from "./gasEstimate";
import { LocalRPCSubscriber } from "./local";
import { MultiChainRPC } from "./multi";

test("gas estimate simple", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const rpc = new LocalRPCSubscriber(proxy, multi);

  const gasAmount = estimateGas(
    proxy,
    rpc,
    proxy.new("ethereum"),
    proxy.new({
      from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      to: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8"
    })
  );
  const v = (await gasAmount.consolidatedValue) as bigint;
  expect(v).toBe(21000n);
});

test("gas estimate insufficient amount - ethereum swapExactETHForTokens", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const rpc = new LocalRPCSubscriber(proxy, multi);

  const gasAmount = estimateGas(
    proxy,
    rpc,
    proxy.new("ethereum"),
    proxy.new({
      from: "0xFd6124e4518E290938a35aA434659fD825F516Df",
      to: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
      data: "0x7ff36ab500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000fd6124e4518e290938a35aa434659fd825f516df0000000000000000000000000000000000000000000000000000000065817f730000000000000000000000000000000000000000000000000000000000000002000000000000000000000000b4fbf271143f4fbf7b91a5ded31805e42b2208d600000000000000000000000011fe4b6ae13d2a6055c8d9cf65c55bac32b5d844",
      value: 200000000000000000n
    })
  );
  const error = await gasAmount.consolidatedValue;
  expect(error).toBeInstanceOf(Error);
  expect(error.toString()).toContain("insufficient funds for gas");
});
