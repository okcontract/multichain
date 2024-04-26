import {
  type Abi,
  decodeFunctionResult,
  encodeFunctionData,
  getAbiItem
} from "viem";

import type { AnyCell, MapCell, SheetProxy } from "@okcontract/cells";

import type { Address, EVMAddress } from "./address";
import type { LocalRPCSubscriber } from "./local";
import { mapArrayRec } from "./mapArrayRec";
import { CallQuery } from "./query";
import type { ChainType } from "./types";
import {
  type RPCErrorResult,
  type RPCQuery,
  type RPCResult,
  type RawRPCQuery,
  latestBlock
} from "./types";

export const EthCall = "eth_call" as const;

export type CallQueryType = {
  method: typeof EthCall;
  params: [{ to: string; data: string }, string]; // [params, blockNumber]
  /** Should the result be cached permanently or does it expire after a given delay? */
  // @todo use RawRPCQueryWithOptions
  expiry?: number;
};

export type CallResult = {
  result: `0x${string}`;
};

export const ethCallQuery = <T extends unknown[]>(
  proxy: SheetProxy,
  addr: AnyCell<EVMAddress>,
  abi: AnyCell<Abi>,
  functionName: AnyCell<string>,
  args: AnyCell<T>,
  opts: { blockNumber: string } = { blockNumber: latestBlock }
): AnyCell<[ChainType, RawRPCQuery]> => {
  const data = proxy.map(
    [abi, args, functionName],
    async (abi, args, functionName) => {
      const abiItem =
        abi && functionName
          ? // @ts-expect-error Type instantiation is excessively deep and possibly infinite.
            getAbiItem({ abi, name: functionName, args: args || [] })
          : null;
      return abiItem && args && "inputs" in abiItem
        ? abiItem?.inputs?.length === args?.length &&
            encodeFunctionData({
              abi,
              functionName,
              // biome-ignore lint: lint/suspicious/noExplicitAny
              args: (args || []) as any[]
            })
        : null;
    },
    `ethCall.ethCallQuery.data:${functionName.value}`
  );

  return proxy.map([data, addr], (data, addr) =>
    data && addr?.chain && addr?.addr
      ? ([addr.chain, CallQuery(addr.addr, data, opts)] as [
          ChainType,
          CallQueryType
        ])
      : null
  );
};

type CallOptions = {
  validity?: number;
  name?: string;
  /**
   * noFail could be set to true to ignore RPC errors.
   */
  noFail?: boolean;
  removeExtraParams?: boolean;
  convertToNative?: (v: unknown) => unknown;
  convertFromNative?: (v: unknown) => unknown;
};

export const ethCall = <T extends unknown | unknown[]>(
  local: LocalRPCSubscriber,
  query: AnyCell<[ChainType, RawRPCQuery]>,
  abi: AnyCell<Abi>,
  functionName: AnyCell<string>,
  opts?: CallOptions
) => {
  const proxy = local._proxy;
  // @todo use new cells redirect
  const cell = local.get(proxy, query, {
    ...opts,
    name: opts?.name
      ? `${opts?.name}.${functionName.id}`
      : `encodeCall.cell:${functionName.id}`
  });
  return proxy.map(
    [abi, cell, functionName],
    (abi, _cell, _functionName) => {
      try {
        if (!_cell || "error" in _cell || !_cell?.result) return null;
        const decoded = decodeFunctionResult({
          abi,
          functionName: _functionName,
          data: _cell.result as `0x${string}`
        }) as NonNullable<T>;
        return opts?.convertFromNative(decoded) || decoded;
      } catch (error) {
        console.log("decodeFunctionResult-Error", {
          error,
          _functionName,
          query
        });
        return error;
      }
    },
    `ethCall.encodeCall:${functionName.value}`
  );
};

/**
 *
 * @param proxy
 * @param cache
 * @param addr
 * @param abi
 * @param functionName
 * @param _args
 * @param expiry
 * @returns
 *
 * @todo should be in CoreExecution? (with proxy and cache auto-filled)
 * @todo should be with direct arguments (not cell, but return cell)
 */
export const encodeCall = <
  T extends unknown | unknown[],
  Args extends AnyCell<unknown>[] | null
>(
  // @todo these should be from CoreExecution
  local: LocalRPCSubscriber,
  // @todo cells or values?
  addr: AnyCell<EVMAddress>,
  abi: AnyCell<Abi>,
  functionName: AnyCell<string>,
  args: AnyCell<Args>,
  opts: AnyCell<CallOptions> = local._proxy.new(null)
): MapCell<T | null, false> => {
  return opts.map((_options) => {
    const proxy = local._proxy;
    const converted = mapArrayRec(
      proxy,
      args,
      _options?.convertToNative || ((v: unknown) => v),
      "encodeCall.converted"
    );
    const query = ethCallQuery(proxy, addr, abi, functionName, converted);
    return ethCall(local, query, abi, functionName, _options);
  }, "ethCall.encodeCall.cell");
};

export type Aggregate3Call = {
  allowFailure: boolean;
  callData: string;
  target: `0x${string}`;
};

/* [Multicall3](https://github.com/mds1/multicall) */
export const multicall3Abi = [
  {
    inputs: [
      {
        components: [
          {
            name: "target",
            type: "address"
          },
          {
            name: "allowFailure",
            type: "bool"
          },
          {
            name: "callData",
            type: "bytes"
          }
        ],
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          {
            name: "success",
            type: "bool"
          },
          {
            name: "returnData",
            type: "bytes"
          }
        ],
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const multiCall = (
  multi: Address,
  calls: CallQueryType[],
  maxSize = 1024 // @todo implement
): CallQueryType => {
  const agg = calls.map(
    (call) =>
      ({
        allowFailure: true,
        callData: call.params[0].data,
        target: call.params[0].to
      }) as Aggregate3Call
  );
  const enc = encodeFunctionData({
    abi: multicall3Abi,
    functionName: "aggregate3",
    // @ts-expect-error why type error?
    args: [agg]
  });
  return CallQuery(multi, enc);
};

export const decodeMultiCall = (
  id: number,
  data: `0x${string}`
): (RPCResult<RPCQuery> | RPCErrorResult<RPCQuery>)[] => {
  const out = decodeFunctionResult({
    abi: multicall3Abi,
    functionName: "aggregate3",
    data
  });
  return out.map((v, i) =>
    v.success
      ? {
          id,
          jsonrpc: "2.0",
          result: v.returnData
        }
      : // @todo retrieve and decode error from returnData?
        { id, jsonrpc: "2.0", error: { code: 400, message: "call failed" } }
  );
};
