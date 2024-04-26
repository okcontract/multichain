import { expect, test } from "vitest";

import { Sheet, SheetProxy } from "@okcontract/cells";

import { getTransactionReceipt } from "./getTransactionReceipt";
import { LocalRPCSubscriber } from "./local";
import { MultiChainRPC } from "./multi";
import type { ChainType } from "./types";

test("get transaction receipt", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const multi = new MultiChainRPC(proxy);
  const rpc = new LocalRPCSubscriber(proxy, multi);

  const hash = proxy.new(
    "0xb17cf93cf9b6c0b9756beeea4dfaade90e9b34f45e24337f754032d21d783dd5" as `0x${string}`
  );
  const sepolia = proxy.new("sepolia" as ChainType);
  const receipt = await getTransactionReceipt(rpc, hash, sepolia)
    .consolidatedValue;
  if (receipt instanceof Error) throw "test getTransactionReceipt fail";

  expect(receipt).toMatchObject({
    blockHash:
      "0x2095009945031af07b8766079135b123e2f70f2aac27733571c54eb2fe219b39",
    blockNumber: 5514856n,
    contractAddress: null,
    cumulativeGasUsed: 2517418n,
    effectiveGasPrice: 1599294373n,
    from: "0xda72407d3b2406a7afaa09271f61d6f6f431cb50",
    gasUsed: 66743n,
    logsBloom:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000001000000000008000000000000000000000000000000000000000000000000020000000000000400000800000000000000000000000011000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000001000000000000000000",
    status: "success",
    to: "0xf875fecff122927e53c3b07f4258c690b026004b",
    transactionHash:
      "0xb17cf93cf9b6c0b9756beeea4dfaade90e9b34f45e24337f754032d21d783dd5",
    transactionIndex: 16,
    type: "eip1559"
  });
  expect(receipt.logs).toStrictEqual([
    {
      address: "0x3f4b6664338f23d2397c953f2ab4ce8031663f80",
      blockHash:
        "0x2095009945031af07b8766079135b123e2f70f2aac27733571c54eb2fe219b39",
      blockNumber: 5514856n,
      data: "0x0000000000000000000000000000000000000000000000008ac7230489e80000",
      logIndex: 25,
      removed: false,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x000000000000000000000000da72407d3b2406a7afaa09271f61d6f6f431cb50"
      ],
      transactionHash:
        "0xb17cf93cf9b6c0b9756beeea4dfaade90e9b34f45e24337f754032d21d783dd5",
      transactionIndex: 16
    }
  ]);
});
