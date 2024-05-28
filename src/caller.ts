import { type AnyCell, jsonStringify } from "@okcontract/cells";

import type { Address } from "./address";
import { EthCall, multiCall } from "./ethCall";
import { type RPCQueryKey, computeHash } from "./hash";
import { type EVMType, StarkNet, type StarkNetType } from "./network";
import { type ChainRPCOptions, type RPCOptions, chainOptions } from "./options";
import { StarkCall, starkMulticall } from "./starkCall";
import {
  type ChainType,
  type RPCCaller,
  type RPCQuery,
  RPCVersion,
  type RawRPCQuery
} from "./types";

/**
 * RPC instance support multiple endpoints for a given chain.
 * @todo query each endpoint in round-robin
 * @todo maintain an active status for each endpoint
 * @todo measure latency for each endpoint
 */
export class RPC {
  readonly _chain: ChainType;
  readonly _options: AnyCell<ChainRPCOptions>;
  readonly _endpoints: AnyCell<string[]>;
  _current: number;
  protected _count: number;

  /** rate limiting */
  _last: number; // in ms
  _rateLimit: number; // in ms

  constructor(chain: ChainType, options: RPCOptions) {
    const endpoints = options.chains.map((_chains) => {
      const rpc = _chains[chain]?.rpc;
      if (!rpc) throw new Error(`unknown chain: ${chain}`);
      return rpc;
    }, "RPC.endpoint");
    this._chain = chain;
    this._options = chainOptions(options, chain);
    this._rateLimit = options?.rateLimit || 2000;
    this._last = 0;
    this._endpoints = endpoints;
    this._current = 0;
    this._count = 0;
  }

  // @todo also measure delays
  _rotate(): AnyCell<boolean> {
    return this._endpoints.map((_endpoints) => {
      if (_endpoints.length < 2) return false;
      this._current =
        this._current === _endpoints.length - 1 ? 0 : this._current + 1;
      return true;
    }, "RPC._rotate");
  }

  /**
   * _keyMap builds the list of keys and a Map from a list of RawRPCQuery.
   * (there is no deduplication in the list of keys)
   * @param qs
   * @returns
   * @todo only for tests?
   */
  _keyMap = async (
    qs: RawRPCQuery[]
  ): Promise<[RPCQueryKey[], Map<RPCQueryKey, RawRPCQuery>]> => {
    const keys: RPCQueryKey[] = [];
    const m: Map<RPCQueryKey, RawRPCQuery> = new Map();
    for (let i = 0; i < qs.length; i++) {
      const key = await computeHash(qs[i]);
      keys.push(key);
      m.set(key, qs[i]);
    }
    return [keys, m];
  };

  /**
   * _enumerate transforms query keys into built requests.
   * @param keys
   * @param getter
   * @returns the enumerated, multicall-ed RPCQuery array and the list of
   * RawRPCQuery in the multicall (empty if no multicall).
   */
  _enumerate = (
    keys: RPCQueryKey[],
    getter: Map<RPCQueryKey, RawRPCQuery>,
    options: ChainRPCOptions
  ): [RPCQuery[], RPCQueryKey[], number] => {
    const [rq, mck] = this._multicall(keys, getter, options);
    const qs = rq.map(
      (q) =>
        ({
          ...q,
          id: ++this._count,
          jsonrpc: RPCVersion
        }) as RPCQuery
    );
    return [qs, mck, mck.length ? qs[0].id : undefined];
  };

  _multicall = (
    keys: RPCQueryKey[],
    getter: Map<RPCQueryKey, RawRPCQuery>,
    options: ChainRPCOptions
  ): [RawRPCQuery[], RPCQueryKey[]] => {
    // skip multicall if only one query
    if (!options.multiCall || keys.length === 1)
      return [keys.map((key) => getter.get(key)), []];
    // split the calls, other RPC queries and list of call keys
    const { calls, others, mck } = keys.reduce(
      (result, key) => {
        const q = getter.get(key);
        if (q?.method === EthCall || q?.method === StarkCall) {
          result.mck.push(key);
          result.calls.push(q);
        } else result.others.push(q);
        return result;
      },
      { calls: [], others: [], mck: [] }
    );
    // transform call queries into a multicall
    // @todo split in several multicall beyond threshold
    if (calls.length > 1) {
      if (options?.multiCall._network === StarkNet) {
        const multi = starkMulticall(
          options.multiCall as Address<StarkNetType>,
          calls
        );
        return [[multi, ...others], mck];
      }
      const multi = multiCall(options.multiCall as Address<EVMType>, calls);
      return [[multi, ...others], mck];
    }
    // no calls or a single call, no multicall
    return [keys.map((key) => getter.get(key)), []];
  };

  call: RPCCaller = async (input: RPCQuery[]) => {
    // remove optional args from queries
    const newInputs = input.map((_input) => ({ ..._input, args: undefined }));

    try {
      const req = {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: jsonStringify(newInputs)
      };
      // @todo measure stats on response time
      // We switch to a new endpoint for each request.
      // this._rotate();
      const endpoints = await this._endpoints.get();
      if (endpoints instanceof Error) throw endpoints;
      const now = Date.now();
      if (now - this._last < this._rateLimit) return;

      this._last = now;
      // console.log("Calling URL=", { url: endpoints[this._current] });
      const response = await fetch(endpoints[this._current], req);

      if (!response.ok) {
        if (await this._rotate()?.get()) {
          // @todo no need to rebuild the request
          return this.call(input);
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      return result?.length ? result : [result];
    } catch (error) {
      if (await this._rotate()?.get()) {
        // @todo no need to rebuild the request
        return this.call(input);
      }
      throw error;
    }
  };
}
