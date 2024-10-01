import { formatTransactionReceipt } from "viem";

import type { AnyCell } from "@okcontract/cells";

import type { LocalRPCSubscriber } from "./local";
import { TransactionByHashQuery, TransactionReceiptQuery } from "./query";
import type {
  ChainType,
  GetTransactionByHashQuery,
  GetTransactionReceiptQuery
} from "./types";

export const getTransactionReceipt = (
  rpc: LocalRPCSubscriber,
  hash: AnyCell<`0x${string}`>,
  ch: AnyCell<ChainType>
) => {
  const query = rpc._proxy.map(
    [hash, ch],
    (_hash, _ch) => (_hash ? [_ch, TransactionReceiptQuery(_hash)] : null),
    "getTransactionReceipt.query"
  ) as AnyCell<[ChainType, GetTransactionReceiptQuery]>;
  return rpc
    .get(rpc._proxy, query, {
      retry: 5
    })
    .map((_res) => {
      // returning undefined to wait for receipt
      if (!_res || "error" in _res || !_res?.result) return undefined;
      return formatTransactionReceipt(_res.result);
    }, "getTransactionReceipt.result");
};

export const getTransaction = (
  rpc: LocalRPCSubscriber,
  hash: AnyCell<`0x${string}`>,
  ch: AnyCell<ChainType>
) => {
  const query = rpc._proxy.map(
    [hash, ch],
    (_hash, _ch) => (_hash ? [_ch, TransactionByHashQuery(_hash)] : null),
    "getTransactionReceipt.query"
  ) as AnyCell<[ChainType, GetTransactionByHashQuery]>;
  return rpc.get(rpc._proxy, query, {
    retry: 5
  });
};
