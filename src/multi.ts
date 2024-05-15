const DEV = false;

import type { SheetProxy, ValueCell } from "@okcontract/cells";

import { RPCCache } from "./cache";
import { RPC } from "./caller";

import type { RPCQueryKey } from "./hash";
import { defaultRPCOptions } from "./options";
import type { Chain, ChainType, RawRPCQuery } from "./types";

export type MultiChainRPCOptions = {
  now: () => number | Promise<number>;
  chains: ValueCell<{ [key: ChainType]: Chain }>;
  convertToNative: (v: unknown) => unknown;
  convertFromNative: (v: unknown) => unknown;
  loopDelay: number; // in ms
  dev: boolean;
  rateLimit: number; // in ms
};

export class MultiChainRPC {
  _proxy: SheetProxy;
  // @todo without ALL
  _aggregators: { [id in ChainType]: RPCCache };
  _options: ValueCell<MultiChainRPCOptions>;

  constructor(
    proxy: SheetProxy,
    options: ValueCell<MultiChainRPCOptions> = proxy.new(
      defaultRPCOptions(proxy)
    )
  ) {
    this._proxy = proxy;
    this._options = options;
    this._aggregators = {};
  }

  private async _aggregator(chain: ChainType) {
    let cache = this._aggregators[chain];
    if (!cache) {
      DEV && console.log({ multi: "rpc", agg: chain });
      const options = await this._options.get();

      //... build option for chain without cells
      const rpc = new RPC(this._proxy, chain, options);
      cache = new RPCCache(this._proxy, rpc, options);
      this._aggregators[chain] = cache;
    }
    return cache;
  }

  async _counter(chain: ChainType) {
    const agg = await this._aggregator(chain);
    return agg?._counter || 0;
  }

  async cell<Q extends RawRPCQuery>(
    q: [ChainType, Q],
    /**
     * validity for the query (in seconds)
     * @todo optional third element in q?
     */
    options?: { validity?: number; retry?: number }
  ) {
    const agg = await this._aggregator(q[0]);
    return agg.cell(q[1], options);
  }

  async add(chain: ChainType, key: RPCQueryKey) {
    const agg = await this._aggregator(chain);
    return agg._append(key);
  }

  async remove(chain: ChainType, key: RPCQueryKey) {
    const agg = await this._aggregator(chain);
    agg._remove(key);
  }

  async invalidate(
    chain: ChainType,
    key: RPCQueryKey,
    options?: { replaceQuery?: RawRPCQuery }
  ) {
    const agg = await this._aggregator(chain);
    agg._invalidate(key, options);
  }
}
