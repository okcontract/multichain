import type { TransactionRequest } from "viem";

import type { Address } from "./address";
import { type CallQueryType, EthCall } from "./ethCall";
import {
  BalanceMethod,
  type GetBalanceQuery,
  type GetEstimateGas,
  type GetTransactionReceiptQuery,
  type RawRPCQuery,
  latestBlock
} from "./types";

export const BalanceQuery = (
  addr: Address,
  options: { expiry?: number; blockNumber: string } = {
    blockNumber: latestBlock
  }
): GetBalanceQuery => ({
  method: BalanceMethod,
  params: [addr.toString(), options.blockNumber]
});

export const TransactionReceiptQuery = (
  tx: `0x${string}`
): GetTransactionReceiptQuery => ({
  method: "eth_getTransactionReceipt",
  params: [tx]
});

export const EstimateGasQuery = (tx: TransactionRequest): GetEstimateGas => ({
  method: "eth_estimateGas",
  params: [tx]
});

export const CallQuery = (
  to: Address,
  data: string,
  options: { expiry?: number; blockNumber?: string } = {
    blockNumber: latestBlock
  }
): CallQueryType => ({
  method: EthCall,
  params: [{ to: to.toString(), data }, latestBlock],
  expiry: options?.expiry
});

// We remove variable parameters unrelated to the query itself
// (block number, expiry) from each query
export const RawRPCQueryForHash = (
  q: RawRPCQuery,
  options: { removeExtraParams?: boolean } = { removeExtraParams: true }
) => {
  switch (q.method) {
    case EthCall:
      // remove expiry and latest block
      return {
        method: EthCall,
        params: options.removeExtraParams ? q.params[0] : q.params
      };
    case BalanceMethod:
      return {
        method: BalanceMethod,
        params: options.removeExtraParams ? q.params[0] : q.params
      };
    default:
      return q;
  }
};

export const isRPCQuery = (query: unknown): query is RawRPCQuery =>
  typeof query === "object" &&
  query !== null &&
  "method" in query &&
  "params" in query;
