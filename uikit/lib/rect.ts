"use strict";
// License: MIT

export class Rect {
  public left: number;

  public right: number;

  public top: number;

  public bottom: number;

  constructor(left = 0, top = 0, right = 0, bottom = 0, width = 0, height = 0) {
    this.left = left || 0;
    this.top = top || 0;
    if (width) {
      this.width = width;
    }
    else {
      this.right = right || 0;
    }
    if (height) {
      this.height = height;
    }
    else {
      this.bottom = bottom || 0;
    }
  }

  get width() {
    return this.right - this.left + 1;
  }

  set width(nv) {
    this.right = this.left + nv - 1;
  }

  get height() {
    return this.bottom - this.top + 1;
  }

  set height(nv) {
    this.bottom = this.top + nv - 1;
  }

  expand(dim: number) {
    this.left -= dim;
    this.right += dim;
    this.top -= dim;
    this.right -= dim;
  }

  move(x: number, y: number) {
    this.right = this.left + x;
    this.left = x;
    this.bottom = this.top + x;
    this.top = y;
  }

  offset(x: number, y: number) {
    this.left += x;
    this.right += x;
    this.top += y;
    this.bottom += y;
  }
}
