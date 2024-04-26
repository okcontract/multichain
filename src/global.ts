// import * as Config from "../../config.json";
const DEV = false; // Config.debug.rpc;

import type { SheetProxy, ValueCell, WrappedCell } from "@okcontract/cells";

import type { RPCCache } from "./cache";
import { debouncer } from "./debouncer";
import type { RPCQueryKey } from "./hash";
import type { RPCResult, RawRPCQuery } from "./types";

// @todo independent types
export class RPCQueryAggregator {
  _proxy: SheetProxy;
  _cache: RPCCache;
  _sub: ValueCell<Map<RPCQueryKey, ValueCell<number>>>;
  _deb: <T>(cb: (v: T) => void | Promise<void>, v: T) => void;

  constructor(proxy: SheetProxy, cache: RPCCache, delay = 20) {
    this._cache = cache;
    this._sub = proxy.new(new Map());
    this._deb = debouncer(delay);
  }

  get _counter() {
    return this._cache._counter;
  }

  cell<Q extends RawRPCQuery>(
    q: Q,
    options?: { validity?: number; retry?: number }
  ): Promise<WrappedCell<RPCResult<Q>>> {
    return this._cache.cell(q, options);
  }

  /**
   * add queries, must be called only by local subscriptions
   * @param queries
   * @returns
   * @version previously subscribe
   */
  // private _add_list = (queries: RPCQueryKey[]) => {
  //   if (!queries) return;
  //   for (const key of queries) {
  //     // const key = await computeHash(q);
  //     const prev = this._sub.get(key) || 0;
  //     // @todo no need, we can map directly on _sub
  //     if (!prev) {
  //       this._cache.activate(key);
  //     }
  //     this._sub.set(key, prev + 1);
  //   }
  // };

  /**
   * remove queries, must be called only by local subscriptions
   * @param keys
   * @returns
   * @version previously unsubscribe
   *
   * @todo should be a list
   */
  _remove = (q: RPCQueryKey) => {
    this._sub.update((_sub) => {
      const counter = _sub.get(q);
      if (counter)
        counter.update((c) => {
          if (c > 0) return c - 1;
          return c;
        });
      return _sub;
    });
    // if (!keys) return;
    // for (const key of keys) {
    //   const c = this._sub.get(key) || 0;
    //   if (c) {
    //     if (c === 1) {
    //       this._cache.activate(key, false);
    //     }
    //     this._sub.set(key, c - 1);
    //   }
    // }
  };

  /**
   * _add_batch should only be used with debounced `_append`.
   */
  // private _add_batch = async () => {
  //   const adding = Array.from(this._batch);
  //   this._batch.clear();
  //   DEV && console.log({ global: "rpc", at: Date.now(), batch: adding });
  //   this._add_list(adding);
  //   // FIXME: only if we don't have them already in the local cache?
  //   // we only _refresh now?
  //   await this._cache._refresh(adding);
  // };

  /**
   * append new query from a caller.
   * @param q
   * @todo migrate to Key
   */
  _append(q: RPCQueryKey) {
    this._sub.update((_sub) => {
      const counter = _sub.get(q);
      if (counter) counter.update((c) => c + 1);
      else _sub.set(q, this._proxy.new(0));
      return _sub;
    });
  }

  invalidate(q: RPCQueryKey, options?: { replaceQuery?: RawRPCQuery }) {
    this._cache._invalidate(q, options);
  }
}
