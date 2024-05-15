export class RateLimiter {
  readonly _last: Record<string, number>;
  readonly _limit: number;

  constructor(limit: number) {
    this._last = {};
    this._limit = limit;
  }

  reset(key: string, now: number) {
    this._last[key] = now;
  }

  take(key: string) {
    const now = Date.now();
    const last = this._last[key] || 0;
    if (now - last < this._limit) return false;
    this.reset(key, now);
    return true;
  }
}
