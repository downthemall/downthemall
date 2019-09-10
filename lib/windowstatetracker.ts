"use strict";
// License: MIT

import { Prefs } from "./prefs";
import { windows } from "./browser";


const VALID_WINDOW_STATES = Object.freeze(new Set(["normal", "maximized"]));

interface Constraints {
  minWidth: number;
  minHeight: number;
  left?: number;
  top?: number;
}

export class WindowStateTracker {
  private width: number;

  private height: number;

  private readonly minWidth: number;

  private readonly minHeight: number;

  private left: number;

  private top: number;

  private state: string;

  private readonly key: string;

  private windowId: number;

  constructor(windowType: string, constraints: Constraints) {
    // eslint-disable-next-line no-magic-numbers
    const {minWidth = 500, minHeight = 400, left = -1, top = -1} = constraints;
    this.width = this.minWidth = minWidth;
    this.height = this.minHeight = minHeight;
    this.left = left;
    this.top = top;
    this.state = "normal";
    this.key = `window-state-${windowType}`;
    this.update = this.update.bind(this);
  }

  async init() {
    const initialState = await Prefs.get(this.key);
    if (initialState) {
      Object.assign(this, initialState);
    }
    this.validate();
  }

  getOptions(options: any) {
    const result = Object.assign(options, {
      state: this.state,
    });
    if (result.state !== "maximized") {
      result.width = this.width;
      result.height = this.height;
      if (this.top >= 0) {
        result.top = this.top;
        result.left = this.left;
      }
    }
    return result;
  }

  validate() {
    this.width = Math.max(this.minWidth, this.width) || this.minWidth;
    this.height = Math.max(this.minHeight, this.height) || this.minHeight;
    this.top = Math.max(-1, this.top) || -1;
    this.left = Math.max(-1, this.left) || -1;
    this.state = VALID_WINDOW_STATES.has(this.state) ? this.state : "normal";
  }

  async update() {
    if (!this.windowId) {
      return;
    }
    const window = await windows.get(this.windowId);
    if (!VALID_WINDOW_STATES.has(window.state)) {
      return;
    }
    const previous = JSON.stringify(this);
    this.width = window.width;
    this.height = window.height;
    this.left = window.left;
    this.top = window.top;
    this.state = window.state;
    this.validate();
    if (previous === JSON.stringify(this)) {
      // Nothing changed
      return;
    }
    await this.save();
  }

  track(windowId: number, port: any) {
    if (port) {
      port.on("resized", this.update);
    }
    this.windowId = windowId;
  }

  async finalize() {
    await this.update();
    this.windowId = 0;
  }

  async save() {
    await Prefs.set(this.key, this.toJSON());
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      top: this.top,
      left: this.left,
      state: this.state,
    };
  }
}
