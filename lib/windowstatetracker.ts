"use strict";
// License: MIT

import { Prefs } from "./prefs";
import { windows } from "./browser";
// eslint-disable-next-line no-unused-vars
import { Port } from "./bus";


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
    try {
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
    catch {
      // ignored
    }
  }

  track(windowId: number, port?: Port) {
    if (port) {
      port.on("resized", this.update);
      port.on("unload", e => this.finalize(e));
      port.on("disconnect", this.finalize.bind(this));
    }
    this.windowId = windowId;
  }

  async finalize(state?: any) {
    if (state) {
      if (state.left > 0) {
        this.left = state.left;
      }
      if (state.top > 0) {
        this.top = state.top;
      }
    }
    await this.update();
    this.windowId = 0;
    if (state) {
      await this.save();
    }
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
