"use strict";
// License: MIT

/**
 * A least recently used (or rather set) map.
 *
 * Please note: Just getting or testing existance of a key will not bump it,
 * only setting it will.
 *
 * @extends Map
 */
export class LRUMap<TKey, TValue> extends Map<TKey, TValue> {
  private _limit: number;

  public onpurge: Function;

  /**
   * A new day, a new LRUMap.
   *
   * @param {int} limit
   *   Maximum items to keep in the map.
   * @param {*} values
   *   Initialize the map with these values, just like a regular |Map|
   */
  constructor(limit: number, values?: Iterable<any>) {
    if (!(limit > 1) || (limit !== (limit | 0))) {
      throw new Error("Invalid limit");
    }
    super(values && Array.from(values));
    Object.defineProperty(this, "_limit", {value: limit});
  }

  /**
   * Currently associated limit
   */
  get limit() {
    return this._limit;
  }

  /**
   * Currently associated limit
   */
  get capacity() {
    return this._limit;
  }

  /**
   * How many items can be added before some will be purged
   */
  get free() {
    return this._limit - this.size;
  }

  "set"(key: TKey, val: TValue) {
    if (this.has(key)) {
      super.delete(key);
      return super.set(key, val);
    }
    if (this.size === this._limit) {
      const key = this.keys().next().value;
      if (this.onpurge) {
        this.onpurge(key, this.get(key));
      }
      this.delete(key);
    }
    return super.set(key, val);
  }
}
