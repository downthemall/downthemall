/* eslint-disable no-unused-vars */
"use strict";
// License: MIT

export enum CellTypes {
  TYPE_TEXT = 1 << 0,
  TYPE_CHECK = 1 << 1,
  TYPE_PROGRESS = 1 << 2,
}

export const ROW_CACHE_SIZE = 5000;
export const ROW_REUSE_SIZE = 20;
