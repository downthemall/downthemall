"use strict";
// License: MIT

/* eslint-disable no-unused-vars */
import { Column } from "./column";
import { Row } from "./row";
/* eslint-enable no-unused-vars */
import {APOOL} from "./animationpool";
import {ROW_CACHE_SIZE, ROW_REUSE_SIZE} from "./constants";
import {clampUInt} from "./util";
// eslint-disable-next-line no-unused-vars
import { BaseTable } from "./basetable";


export class InvalidatedSet<T> extends Set<T> {
  private scheduled: boolean;

  private callback: Function;

  constructor(callback: Function) {
    super();
    this.scheduled = false;
    this.callback = APOOL.wrap(() => {
      this.scheduled = false;
      try {
        callback(this);
      }
      finally {
        this.clear();
      }
    });
  }

  add(val: T) {
    if (!super.add(val).size || this.scheduled) {
      return this;
    }
    this.callback();
    this.scheduled = true;
    return this;
  }
}

export class UpdateRecord {
  rowCount: number;

  scrollTop: number;

  rowHeight: number;

  height: number;

  totalHeight: number;

  cols: Column[];

  rows: Row[];

  children: Set<HTMLElement>;

  nitems: number;

  lastIdx: number;

  firstVisibleIdx: number;

  lastVisibleIdx: number;

  firstIdx: number;

  top: number;

  bottom: number;

  constructor(table: BaseTable, cols: Column[]) {
    this.rowCount = table.rowCount;
    this.scrollTop = table.visibleTop;
    this.rowHeight = table.rowHeight;
    this.height = table.visibleHeight;
    this.totalHeight = this.rowHeight * this.rowCount;
    this.cols = cols;
    this.rows = [];
    this.children = new Set();
    const maxLastIdx = Math.max(
      this.rowCount - 1,
      Math.floor((this.totalHeight - this.height) / this.rowHeight));
    const inset = this.scrollTop % this.rowHeight;
    this.nitems = clampUInt(
      Math.ceil((this.height + inset) / this.rowHeight),
      this.rowCount);
    this.lastIdx = Math.min(
      maxLastIdx,
      Math.floor(this.scrollTop / this.rowHeight) + this.nitems - 1);
    this.firstVisibleIdx = Math.max(0, this.lastIdx - this.nitems);
    this.lastVisibleIdx = this.lastIdx;
    if (this.rowHeight === Number.MAX_SAFE_INTEGER ||
      this.rowCount > ROW_CACHE_SIZE) {
      this.firstIdx = Math.max(
        0, this.lastIdx - this.nitems - ROW_REUSE_SIZE);
      this.lastIdx = Math.min(
        maxLastIdx, this.lastIdx + ROW_REUSE_SIZE);
      this.top = this.firstIdx * this.rowHeight;
      this.bottom = this.totalHeight - ((this.lastIdx + 1) * this.rowHeight);
    }
    else {
      // Manifest entire table
      this.firstIdx = 0;
      this.lastIdx = this.rowCount - 1;
      this.top = 0;
      this.bottom = 0;
    }
    Object.seal(this);
  }

  add(row: Row) {
    this.rows.push(row);
    this.children.add(row.elem);
  }
}
