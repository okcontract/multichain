import type { AnyCell } from "@okcontract/cells";

export class RateLimiter {
  readonly _last: Record<string, number>;
  readonly _endpoints: AnyCell<string[]>;
  readonly _limit: number;

  constructor(endpoints: AnyCell<string[]>, limit: number) {
    this._last = {};
    this._limit = limit;
    endpoints.subscribe((l) => {
      if (l instanceof Error) return;
      for (const elt of l) if (!this._last[elt]) this._last[elt] = 0;
    });
  }

  reset(key: string, now: number) {
    this._last[key] = now;
  }

  take(key: string) {
    const now = Date.now();
    const last = this._last[key];
    if (now - last < this._limit) return false;
    this.reset(key, now);
    return true;
  }
}
