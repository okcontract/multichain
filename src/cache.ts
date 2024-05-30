import {
  type MapCell,
  type SheetProxy,
  type ValueCell,
  WrappedCell,
  clock,
  clockWork
} from "@okcontract/cells";

import type { RPC } from "./caller";
import { isErrorResult } from "./error";
import { retryCodes } from "./errors";
import { decodeMultiCall } from "./ethCall";
import { type RPCQueryKey, computeHash } from "./hash";
import type { ChainRPCOptions, MultiChainRPCOptions } from "./options";
import { decodeStarkMultiCall } from "./starkCall";
import type {
  ChainType,
  RPCError,
  RPCErrorResult,
  RPCQuery,
  RPCResult,
  RawRPCQuery
} from "./types";

/**
 * nowPlus computes an expected time.
 * @param now current time getter
 * @param delta interval in **seconds**
 * @todo `delta` in ms?
 */
export const nowPlus = async (
  now: () => number | Promise<number>,
  delta: number
) => (await now()) + delta * 1000;

type RPCCacheOptions = {
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
   * noFail could be set to true to ignore RPC errors.
   */
  noFail?: boolean;
  /**
   * errorOnNull return an error for null value
   * @todo should be an option of an RPCQuery
   */
  errorOnNull?: boolean;
};

type ActionError = {
  message?: string;
};

type ActionSet = {
  key?: string;
  value?: RPCResult<RPCQuery> | RPCErrorResult<RPCQuery>;
};

type Action = { type: string } & (ActionError | ActionSet);

type Cache = Record<RPCQueryKey, CacheValue<RawRPCQuery>>;
type CacheValue<Q extends RawRPCQuery> = RPCResult<Q>;

/**
 * QueryCache implements a cache for each RPC call for a given chain.
 */
export class RPCCache {
  _proxy: SheetProxy;
  _RPC: RPC;
  _chain: ChainType;

  /** loop delay in ms */
  _loopDelay: number;
  _timeout: ReturnType<typeof setTimeout>;
  _LIVE: ValueCell<boolean>;

  // count local subscribers for each query
  _sub: ValueCell<Map<RPCQueryKey, ValueCell<number>>>;
  // maps each query key to the raw query
  _queries: Map<RPCQueryKey, RawRPCQuery>;
  // maps each query key to the result cell
  _cache: MapCell<Cache, false>;
  // queue for cache
  _cacheQueue: ValueCell<Map<RPCQueryKey, ValueCell<CacheValue<RawRPCQuery>>>>;

  /**
   * optional validity for queries
   */
  _validity: Map<RPCQueryKey, number>;
  _retry: Map<RPCQueryKey, number>;
  readonly _expiry: ValueCell<Record<RPCQueryKey, number>>;

  /**
   * resolvers for cells being added
   * @todo types
   */
  _promises: Map<RPCQueryKey, ((data: RPCResult<RPCQuery>) => void)[]>;

  /**
   * actively tracked queries
   */
  _active: Set<RPCQueryKey>;
  _errors: Map<RPCQueryKey, RPCError>;

  /** counter of RPC calls */
  _counter: number;

  _convertToNative: (v: unknown) => unknown;
  _convertFromNative: (v: unknown) => unknown;

  constructor(proxy: SheetProxy, rpc: RPC, options: MultiChainRPCOptions) {
    this._sub = proxy.new(new Map(), "RPCCache._sub");
    this._cacheQueue = proxy.new(new Map(), "RPCCache._cacheList");

    this._queries = new Map();
    this._proxy = proxy;
    this._validity = new Map();
    this._retry = new Map();
    this._expiry = proxy.new({} as Record<RPCQueryKey, number>, "cache.expiry");
    this._promises = new Map();
    this._RPC = rpc;
    this._chain = rpc._chain;
    this._active = new Set();
    this._errors = new Map();
    this._counter = 0;

    // launch loop
    // @todo @later get Cell from options (create on default)
    this._LIVE = proxy.new(true, "cache.LIVE");

    const cl = clock(proxy, this._LIVE, options.loopDelay);
    this._cache = clockWork(
      proxy,
      cl,
      [this._expiry, this._sub, this._cacheQueue, rpc._options],
      async (
        exp: Record<RPCQueryKey, number>,
        sub: Map<RPCQueryKey, ValueCell<number>>,
        cacheQueue: Map<RPCQueryKey, ValueCell<RPCResult<RPCQuery>>>,
        rpcOptions: ChainRPCOptions,
        prev: Cache
      ) => {
        const updateExpiry = {} as Record<string, Promise<number>>;
        const now = await options.now();
        // expired queries
        const expired = Object.entries(exp)
          .filter(([k, v]) => v < now)
          .map(([k, _]) => k);
        // new queries in sub vs queries in cache
        const diff = Array.from(sub.entries())
          .filter(([k, v]) => !prev?.[k] && v.value > 0)
          .map((v) => v[0]);
        // diff queries not valid in cache
        const unavailable = diff.filter(
          (q) => !this._valid(q, now, exp, prev, options)
        );
        // list of queries that will be requested
        // if no requested queries we return current cache or null
        // if first time
        const requested = [...new Set([...unavailable, ...expired])];
        if (!requested.length) return prev || null;
        console.log({ cl: cl.value, requested });
        if (options?.timeOut) {
          const timeout = nowPlus(options.now, options.timeOut);
          for (const key of requested) updateExpiry[key] = timeout;
        }

        const enumerated = requested?.length
          ? this._RPC._enumerate(requested, this._queries, rpcOptions)
          : [null];
        const [inputs, mck, mid] = enumerated;
        // non multicall
        const requestedOthers =
          requested && enumerated
            ? requested.filter((key) => !mck.includes(key))
            : [];
        this._counter++;
        // RPC call
        const outputs = await this._RPC.call(inputs);
        if (!outputs) return;

        // list of call / multicall data
        // matching input requests with outputs
        const actions = outputs.reduce((actions, output) => {
          // no match
          const idx = inputs.findIndex((input) => input.id === output.id);
          if (idx === -1) {
            actions.push({
              type: "error",
              message: "multicall failed"
            });
            return actions; // Skip irrelevant outputs
          }

          // multicall match
          if (mid && output.id === mid) {
            if ("error" in output) {
              actions.push({
                type: "error",
                message: "multicall failed"
              });
              return actions;
            }

            const v =
              rpcOptions.chain === "starknet"
                ? decodeStarkMultiCall(output.id, output.result as string[])
                : decodeMultiCall(output.id, output?.result as `0x${string}`);

            if (v.length !== mck.length) {
              actions.push({ type: "error", message: "length mismatch" });
              return actions;
            }
            const multicallActions = v.map((value, j) => ({
              type: "set",
              key: mck[j],
              value
            }));
            // biome-ignore lint/performance/noAccumulatingSpread: convenience
            return [...actions, ...multicallActions];
          }
          // non multicall
          const key = requestedOthers[idx - (mck.length ? 1 : 0)];
          if (key === undefined) return actions;
          actions.push({ type: "set", key, value: output });
          return actions;
        }, []);

        const setActions = actions.filter(
          (action) => action.type === "set"
        ) as ActionSet[];
        const setErrors = actions.filter(
          (action) => action.type === "error"
        ) as ActionError[];
        // error due to whole rpc error
        if (setErrors.length) {
          this._RPC._rotate();
          return;
        }
        const newCache = setActions.reduce((acc, { key, value }) => {
          if (isErrorResult(value) || value?.result === null) {
            // we rotate rpc and retry on a set of errors
            const err = "error" in value && value.error;
            if (retryCodes.includes(err.code)) {
              this._retry.set(key, 1);
              this._RPC._rotate();
            }
          }
          // Resolve all promises, notifications.
          const pr = this._promises.get(key);
          //  If there are promises, resolve them and delete them.
          if (pr) {
            this._promises.delete(key);
            for (const p of pr) p(value);
          }
          // Update the cell itself that must exist by calling `cell` before.
          const cell = (prev?.[key] ||
            cacheQueue.get(key)) as ValueCell<unknown>;
          // The cell does not exist when it did not exist previously
          // and there was an error before its creation in `cacheQueue`.
          if (!cell) return acc;
          // If the query is retry-able, we set a new expiry to be
          // picked up by the loop.
          if (
            this._retry.has(key) &&
            (isErrorResult(value) || value?.result === null)
          ) {
            updateExpiry[key] = nowPlus(
              options.now,
              this._validity.has(key)
                ? this._validity.get(key)
                : this._retry.get(key)
            );
          } else {
            // if validity => update expiry with now + validity to
            // be picked up by the loop
            if (this._validity.has(key)) {
              updateExpiry[key] = nowPlus(
                options.now,
                this._validity.has(key)
                  ? this._validity.get(key)
                  : this._retry.get(key)
              );
            } else {
              updateExpiry[key] = undefined;
            }
            this._retry.delete(key);
            cell.set(value);
          }
          this._remove(key);
          acc[key] = cell;
          return acc;
        }, {});

        const entries = Object.entries(updateExpiry);
        const updateExpiryResolved = Object.fromEntries(
          (await Promise.all(entries.map(([_, v]) => v)))
            .map((v, i) => [entries[i][0], v] as [string, number])
            .filter(([_, v]) => v !== undefined)
        );

        // update expiries after work and before new tick to prevent cancellation
        proxy._sheet.queue(this._expiry, updateExpiryResolved);

        return {
          ...(prev || ({} as Cache)),
          ...newCache
        } as Cache;
      },
      "_cache"
    );
  }

  private cachedCell = async (key: RPCQueryKey) => {
    const cache = await this._cache.get();
    if (cache instanceof Error) throw cache;
    if (cache?.[key]) return cache[key];
    const queue = await this._cacheQueue.get();
    if (queue?.has(key)) return queue.get(key);
    return null;
  };

  /**
   * retrieves or create a cell.
   * @param q
   * @param proxy
   * @param options
   * @returns wrapped cell for RPC response
   */
  public cell = async <Q extends RawRPCQuery>(
    q: Q,
    options?: RPCCacheOptions
  ) => {
    const key = await computeHash(q);
    const rpcOpts = await this._RPC._options.get();
    if (rpcOpts instanceof Error) throw rpcOpts;
    rpcOpts.RPCOptions.dev && console.log("cell=", { key, q, options });

    // @todo do we remove previous validity/retry if unset?
    if (options?.validity) this._validity.set(key, options?.validity);
    if (options?.retry) this._retry.set(key, options?.retry);
    // We already have the cell, we return it.
    const cached = (await this.cachedCell(key)) as ValueCell<CacheValue<Q>>;
    if (cached) return new WrappedCell(cached, this._proxy);

    // add query key in sub (increase count)
    this._append(key);
    // We create a new cell and a promise that will resolve with
    // the new cell value later.
    const pr = new Promise((resolve: (data: RPCResult<Q>) => void) => {
      // Append the promise to the list
      this._notify(key, resolve as (data: RPCResult<RPCQuery>) => void);
    });
    rpcOpts.RPCOptions.dev && console.log({ cache: "rpc", key, newCell: q });
    // add map of query key and query
    this._queries.set(key, q);
    // we probably want to be undefined first instead of null until its resolved
    const cell = this._proxy.new(undefined, `rpc:${q.method}`) as ValueCell<
      CacheValue<RawRPCQuery>
    >;
    this._cacheQueue.update((_c) => {
      _c.set(key, cell);
      return _c;
    });
    return new WrappedCell(cell as ValueCell<CacheValue<Q>>, this._proxy);
  };

  public activate = (key: RPCQueryKey, status = true) => {
    if (status) this._active.add(key);
    else this._active.delete(key);
  };

  /**
   * _notify appends promise that will be resolved when a given
   * key is available.
   * @param key hash of the RPC query
   * @param resolve promise
   * @todo handle rejections?
   */
  public _notify = (
    key: RPCQueryKey,
    resolve: (value: RPCResult<RPCQuery>) => void
  ) => {
    // console.log({ cache: "rpc", at: Date.now(), notify: key });
    const l = this._promises.get(key) || [];
    this._promises.set(key, [...l, resolve]);
  };

  /**
   * run starts or pauses a running loop. Run does _not_ restart
   * the loop after `_stop` is called.
   * @param live true to run, false to pause
   */
  run = (live: boolean) => {
    this._LIVE.set(live);
  };

  /**
   * cancel the running loop
   */
  _stop = () => {
    this._LIVE.set(false);
  };

  /**
   * hasValid checks if the query data is available and still valid in cache.
   * @param q
   * @param at
   * @returns
   */
  _valid(
    key: RPCQueryKey,
    now: number,
    expiry: Record<string, number>,
    cache: Cache,
    options: MultiChainRPCOptions
  ) {
    const v = cache?.[key];
    if (v === undefined) return false;
    const exp = expiry?.[key];
    const valid = !exp || exp >= now;
    options.dev &&
      console.log({
        cache: "rpc",
        at: Date.now(),
        key,
        exp,
        now,
        valid
      });
    return valid;
  }

  /**
   * append new query from a caller.
   * @param q
   * @todo migrate to Key
   */
  _append(q: RPCQueryKey) {
    this._sub.update((_sub) => {
      const counter = _sub.get(q);
      if (counter) counter.update((c) => c + 1);
      else _sub.set(q, this._proxy.new(1));
      return _sub;
    });
  }

  /**
   * remove queries, must be called only by local subscriptions
   * @param keys
   * @returns
   * @version previously unsubscribe
   *
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
  };

  async _invalidate(
    key: RPCQueryKey,
    options?: { replaceQuery?: RawRPCQuery }
  ) {
    const expiry = await this._expiry.get();
    if (expiry instanceof Error) throw expiry;
    expiry[key] = 0;
    if (options?.replaceQuery) this._queries.set(key, options.replaceQuery);
  }
}
