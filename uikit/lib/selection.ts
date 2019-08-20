"use strict";
// License: MIT

import { EventEmitter } from "./events";

export class SelectionRange {
  public start: number;

  public end: number;

  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
    if (this.start > this.end) {
      throw new Error(`Invalid range ${this.start} - ${this.end}`);
    }
    Object.freeze(this);
  }

  get first() {
    return this.start;
  }

  *[Symbol.iterator]() {
    for (let i = this.start; i <= this.end; ++i) {
      yield i;
    }
  }

  get length() {
    return this.end - this.start + 1;
  }

  contains(idx: number, border?: number) {
    if (border) {
      const rv = this.start <= idx && idx <= this.end;
      if (rv) {
        return rv;
      }
      idx -= border;
    }
    return this.start <= idx && idx <= this.end;
  }
}

export class TableSelection extends EventEmitter {
  public ranges: SelectionRange[];

  constructor() {
    super();
    this.ranges = [];
    Object.freeze(this);
  }

  get empty() {
    return this.ranges.length === 0;
  }

  get first() {
    return this.ranges[0].first;
  }

  *[Symbol.iterator]() {
    for (const r of Array.from(this.ranges)) {
      yield *r;
    }
  }

  _findContainingRange(idx: number, border?: number) {
    if (!this.ranges.length) {
      return null;
    }
    let low = 0;
    let high = this.ranges.length - 1;
    while (low <= high) {
      const mid = ((high + low) / 2) | 0;
      const r = this.ranges[mid];
      if (r.contains(idx, border)) {
        return {range: r, pos: mid};
      }
      if (r.end < idx) {
        low = mid + 1;
      }
      else {
        high = mid - 1;
      }
    }
    return null;
  }

  _findInsertionPoint(range: SelectionRange) {
    const end = this.ranges.length - 1;
    let low = 0;
    let high = end;
    while (low <= high) {
      const mid = ((high + low) / 2) | 0;
      const r = this.ranges[mid];
      if (range.start < r.start) {
        if (mid >= end) {
          return mid;
        }
        const next = this.ranges[mid + 1];
        if (next.start > range.end) {
          return mid;
        }
      }
      if (r.end > range.start) {
        high = mid - 1;
      }
      else {
        low = mid + 1;
      }
    }
    return this.ranges.length;
  }

  _sanity(sidx: number, eidx: number) {
    if (!isFinite(sidx) || !isFinite(eidx) || sidx < 0 || eidx < sidx) {
      throw new Error(`Invalid Range ${sidx} - ${eidx}`);
    }
  }

  contains(idx: number) {
    return !!this._findContainingRange(idx);
  }

  _add(sidx: number, eidx: number) {
    const rs = this._findContainingRange(sidx, 1);
    let re;
    if (rs && rs.range.contains(eidx)) {
      re = rs;
    }
    else {
      re = this._findContainingRange(eidx, -1);
    }

    if (rs && re) {
      // Already present
      if (rs.pos === re.pos) {
        // ... and one range
        return false;
      }
      // Need to merge
      const rn = new SelectionRange(rs.range.start, re.range.end);
      this.ranges.splice(rs.pos, re.pos - rs.pos + 1, rn);
      return true;
    }
    if (rs) {
      // extend
      const rn = new SelectionRange(rs.range.start, eidx);
      let {pos} = rs;
      for (; pos < this.ranges.length; ++pos) {
        if (this.ranges[pos].start > rn.end) {
          break;
        }
      }
      this.ranges.splice(rs.pos, pos - rs.pos, rn);
      return true;
    }
    if (re) {
      // extend
      const rn = new SelectionRange(sidx, re.range.end);
      let {pos} = re;
      for (; pos >= 0; --pos) {
        if (this.ranges[pos].end < rn.start) {
          break;
        }
      }
      this.ranges.splice(pos + 1, re.pos - pos, rn);
      return true;
    }
    const rn = new SelectionRange(sidx, eidx);
    const ip = this._findInsertionPoint(rn);
    let pos = ip;
    for (; pos < this.ranges.length; ++pos) {
      if (this.ranges[pos].start > rn.end) {
        break;
      }
    }
    this.ranges.splice(ip, pos - ip, rn);
    return true;
  }

  _delete(sidx: number, eidx: number) {
    // Let's just add the entire range (which will merge stuff for us) and then
    // remove it again
    this._add(sidx, eidx);
    const cr = this._findContainingRange(sidx);
    if (!cr) {
      return false;
    }
    const {pos, range} = cr;
    this.ranges.splice(pos, 1);
    if (range.start === sidx && range.end === eidx) {
      // Entire range affected, shortcut
      return true;
    }
    if (range.start < sidx && range.end > eidx) {
      // Need to re-add head and tail
      this.ranges.splice(pos, 0,
        new SelectionRange(range.start, sidx - 1),
        new SelectionRange(eidx + 1, range.end));
      return true;
    }
    if (range.start < sidx) {
      // Need to re-add only head
      this.ranges.splice(pos, 0,
        new SelectionRange(range.start, sidx - 1));
      return true;
    }
    // Need to re-add only tail
    this.ranges.splice(pos, 0,
      new SelectionRange(eidx + 1, range.end));
    return true;
  }

  add(sidx: number, eidx?: number) {
    if (typeof eidx === "undefined") {
      eidx = sidx;
    }
    this._sanity(sidx, eidx);
    if (this._add(sidx, eidx)) {
      this.emit("selection-added", new SelectionRange(sidx, eidx));
    }
  }

  delete(sidx: number, eidx?: number) {
    if (typeof eidx === "undefined") {
      eidx = sidx;
    }
    this._sanity(sidx, eidx);
    if (this._delete(sidx, eidx)) {
      this.emit("selection-deleted", new SelectionRange(sidx, eidx));
    }
  }

  toggle(sidx: number, eidx?: number) {
    if (typeof eidx === "undefined") {
      eidx = sidx;
    }
    if (!isFinite(eidx)) {
      eidx = sidx;
    }
    this._sanity(sidx, eidx);
    if (sidx === eidx) {
      // just toggle directly
      if (this.contains(sidx)) {
        this.delete(sidx);
      }
      else {
        this.add(sidx);
      }
      return;
    }
    const range = new SelectionRange(sidx, eidx);
    const ranges = this.ranges.
      filter(r => {
        return range.contains(r.start) || range.contains(r.end);
      }).
      map(r => {
        return [r.start, r.end];
      });
    const changed = new TableSelection();
    changed._add(sidx, eidx);
    this._add(sidx, eidx);
    for (const [s, e] of ranges) {
      this._delete(s, e);
    }
    this.emit("selection-toggled", changed);
  }

  offset(pos: number, offset: number) {
    if (offset === 0) {
      return;
    }
    const newSelection = new TableSelection();
    for (const r of this.ranges) {
      if (pos > r.end) {
        newSelection._add(r.start, r.end);
        continue;
      }
      if (pos <= r.end && pos <= r.start) {
        if (pos > r.start + offset) {
          const sidx = Math.max(pos, r.start + offset);
          const eidx = Math.max(pos, r.end + offset);
          newSelection._add(sidx, eidx);
        }
        else {
          newSelection._add(r.start + offset, r.end + offset);
        }
        continue;
      }
      if (pos - 1 >= r.start) {
        newSelection._add(r.start, pos - 1);
      }
      if (offset >= 0) {
        newSelection._add(pos + offset, r.end + offset);
        continue;
      }
      if (r.end + offset < r.start) {
        continue;
      }
      newSelection._add(pos, r.end + offset);
    }
    this.ranges.length = 0;
    this.ranges.push(...newSelection.ranges);
  }

  clear() {
    this.ranges.length = 0;
    this.emit("selection-cleared", this);
  }

  replace(sidx: number, eidx?: number) {
    this.clear();
    this.add(sidx, eidx);
  }
}
