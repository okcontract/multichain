import type { Log, RpcTransactionReceipt, TransactionRequest } from "viem";

import type { CallQueryType, CallResult } from "./ethCall";
import type { Network } from "./network";
import type { StarkCallQueryType, StarkCallResult } from "./starkCall";

export type TokenQuery = `tok:${string}`;

export type ChainType = string;

/**
 * OKcontract Chain definition.
 */
export interface Chain {
  /** OKcontract ID (without prefix) */
  id: ChainType;
  /** display name */
  name: string;
  /** chain ID */
  numid: bigint;
  /** network */
  net: Network;
  /** testnet */
  test?: boolean;
  /** currency OKcontract query */
  currency: TokenQuery;
  /** list of RPCs as string */
  rpc: string[];
  /** list of explorers */
  explorer: string[];
  /** default gas value */
  defaultGas?: number;
  /** optional logo */
  readonly logo?: string;
}

export const RPCVersion = "2.0";
export const latestBlock = "latest";

export type BlockNumberQuery = {
  method: "eth_blockNumber";
  params: [];
};

export type BlockNumberResult = {
  // The block number
  result: string;
};

export const BalanceMethod = "eth_getBalance";
export type GetBalanceQuery = {
  method: typeof BalanceMethod;
  params: [string, string]; // block
};

export type GetBalanceResult = {
  result: string; // The balance hex-encoded string
};

export const GasMethod = "eth_estimateGas";
export type GetEstimateGas = {
  method: typeof GasMethod;
  params: [TransactionRequest];
};

export type GasEstimation = {
  result: string; // The gas amount hex-encoded
};

export type GetTransactionReceiptQuery = {
  method: "eth_getTransactionReceipt";
  params: [string];
};

export type GetTransactionReceiptResult = {
  result: RpcTransactionReceipt | null;
};

export type LogEntry = Log<bigint, number>;

/**
 * MultiChainRPCQuery is a unique RPC Query for multiple chains.
 */
export type MultiChainRPCQuery = [ChainType, RawRPCQuery];

/**
 * RawRPCQuery defines a user submitted RPC query, without id.
 */
export type RawRPCQuery =
  | GetBalanceQuery
  | BlockNumberQuery
  | CallQueryType
  | GetEstimateGas
  | GetTransactionReceiptQuery
  | StarkCallQueryType;

export type RPCQueryOptions = {
  // debug name
  name?: string;

  retry?: number;
  validity?: number;
  failOnError?: boolean;
} & RPCConvert;

export type RPCConvert = {
  convertToNative?: (v: unknown) => unknown;
  convertFromNative?: (v: unknown) => unknown;
};

/**
 * RPCQuery, ready-to-be submitted.
 */
export type RPCQuery = {
  // @todo should be added for RPCCaller but not in higher-level query
  jsonrpc: "2.0";
  id: number;
} & RawRPCQuery;

/**
 * RPCQuery, ready-to-be submitted.
 */
export type RPCQueryOf<Q extends RawRPCQuery> = {
  // @todo should be added for RPCCaller but not in higher-level query
  jsonrpc: "2.0";
  id: number;
} & Q;

/**
 * Batched RPC call.
 */
export type RPCCaller = <T extends RPCQuery[]>(
  input: T
) => Promise<{
  [K in keyof T]: T[K] extends RPCQuery
    ? RPCResult<T[K]> | RPCErrorResult<T[K]>
    : never;
}>;

/**
 * RPCError type.
 */
export interface RPCError {
  code: number;
  message: string;
  data?: unknown; // Optional field for additional error data
}

export interface RPCErrorResult<Q extends RPCQuery> {
  jsonrpc: "2.0";
  id: Q["id"]; // Ensure the error ID matches the query ID
  error: RPCError;
}

export type RawRPCQueryOf<Q extends RawRPCQuery> = Q extends GetBalanceQuery
  ? GetBalanceResult
  : Q extends BlockNumberQuery
    ? BlockNumberResult
    : Q extends CallQueryType
      ? CallResult
      : Q extends GetTransactionReceiptQuery
        ? GetTransactionReceiptResult
        : Q extends GetEstimateGas
          ? GasEstimation
          : Q extends StarkCallQueryType
            ? StarkCallResult
            : never;

export type RPCResultNoError<Q extends RawRPCQuery> = {
  jsonrpc: "2.0";
  id: number;
  multi?: boolean;
} & RawRPCQueryOf<Q>;

export type RPCResult<Q extends RawRPCQuery> =
  | RPCResultNoError<Q>
  | RPCErrorResult<RPCQuery>;
