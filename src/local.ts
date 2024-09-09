import type { Abi as StarkAbi } from "starknet";
import type { Abi as ViemAbi } from "viem";

import {
  type AnyCell,
  type MapCell,
  type SheetProxy,
  type ValueCell,
  nextSubscriber
} from "@okcontract/cells";

import type { EVMAddress } from "./address";
import { encodeCall } from "./ethCall";
import { type RPCQueryKey, computeHash } from "./hash";
import type { MultiChainRPC } from "./multi";
import {
  type AbiOfNetwork,
  type EVMType,
  type Network,
  StarkNet,
  type StarkNetType
} from "./network";
import { starkCall } from "./starkCall";
import type {
  ChainType,
  RPCQueryOptions,
  RPCResult,
  RawRPCQuery
} from "./types";

// @todo same options between all layers ?
export type LocalRPCOptions = {
  /**
   * Response validity in seconds, will be refreshed after that.
   */
  validity?: number;
  /**
   * Retry delay in seconds, if the response is an error. After we
   * successfully obtain a response, we stop.
   */
  retry?: number;
  /**
   * Display name (for debugging)
   */
  name?: string;
  /**
   * noFail could be set to true to ignore RPC errors.
   */
  noFail?: boolean;
  /**
   * removeExtraParams removes from the RawRPCQuery all extra params
   * ex: expiry / blockNumber
   */
  removeExtraParams?: boolean;

  convertToNative?: (v: unknown) => unknown;
  convertFromNative?: (v: unknown) => unknown;
};

export class LocalRPCSubscriber {
  readonly _gs: MultiChainRPC;
  /**
   * hashes are multi-chain, so different from single-chain hashes
   */
  readonly _qs: Set<RPCQueryKey>;
  readonly _proxy: SheetProxy;
  readonly _nullCell: ValueCell<null>;

  /**
   * create a new local subscriber, e.g. within a Svelte component
   * @param gs global subscription
   * @param qs initial list of queries (can be empty)
   */
  constructor(proxy: SheetProxy, gs: MultiChainRPC) {
    this._gs = gs;
    this._qs = new Set();
    this._proxy = proxy;
    this._nullCell = proxy.new(null, "local._nullCell");
  }

  /**
   * creates a cell from the query.
   *
   * If a cell already exists, it is reused.
   * @param q
   * @returns
   */
  async newData<Q extends RawRPCQuery>(
    q: [ChainType, Q],
    options?: LocalRPCOptions
  ) {
    this._gs._options.value.dev &&
      console.log({ local: "rpc", at: Date.now(), new: q });
    if (!q) throw new Error("empty query");
    const key = await computeHash(q[1]);
    const mKey = `${q[0]}:${key}`;
    if (!this._qs.has(mKey)) {
      this._qs.add(mKey);
      // @todo optimize not to recompute the key twice
      await this._gs.add(q[0], key);
    }
    return this._gs.cell(q, options);
  }

  get<Q extends RawRPCQuery>(
    proxy: SheetProxy,
    q: AnyCell<[ChainType, Q] | null>,
    options?: LocalRPCOptions
  ): MapCell<RPCResult<Q> | null, false> {
    return q.map(async (_q) => {
      if (!_q) return this._nullCell;
      const data = await this.newData(_q, options);
      return data.cell;
    }, "rpc.get"); // as any as MapCell<RPCResult<Q> | null, false>;
  }

  async invalidate<Q extends RawRPCQuery>(
    q: [ChainType, Q],
    options: {
      cb: () => unknown;
      replaceQuery: RawRPCQuery;
    }
  ) {
    this._gs._options.value.dev &&
      console.log("invalidating...", { q, options });
    const key = await computeHash(q[1]);
    await this._gs.invalidate(q[0], key, options);
    const cell = (await this._gs.cell(q)).cell;
    return nextSubscriber(cell, options?.cb);
  }

  call<Args extends AnyCell<unknown>[], N extends Network>(
    addr: AnyCell<EVMAddress<N>>,
    abi: AnyCell<AbiOfNetwork<N>>,
    functionName: AnyCell<string>,
    args: AnyCell<Args>,
    options: AnyCell<RPCQueryOptions> = this._nullCell
  ) {
    // @todo options could be non-cell?
    const opts = this._proxy.map(
      [options, this._gs._options],
      (callOpts, gsOpts) => ({
        ...gsOpts,
        ...(callOpts || {})
      })
    );
    return addr.map((_addr) =>
      _addr
        ? _addr?.addr._network === StarkNet
          ? starkCall(
              this,
              addr as AnyCell<EVMAddress<StarkNetType>>,
              abi as AnyCell<StarkAbi>,
              functionName,
              args,
              opts
            )
          : encodeCall(
              this,
              addr as AnyCell<EVMAddress<EVMType>>,
              abi as AnyCell<ViemAbi>,
              functionName,
              args,
              opts
            )
        : null
    );
  }

  /**
   * delete all local subscriptions, typically when the component
   * is destroyed.
   */
  destroy() {
    this._gs;
    for (const mKey of this._qs) {
      const [chain, key] = mKey.split(":");
      this._gs.remove(chain as ChainType, key);
    }
  }
}
