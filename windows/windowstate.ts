"use strict";

// eslint-disable-next-line no-unused-vars
import { RawPort } from "../lib/browser";

// License: MIT

export class WindowState {
  private readonly port: RawPort;

  constructor(port: RawPort) {
    this.port = port;
    this.update = this.update.bind(this);
    addEventListener("resize", this.update);
    this.update();
  }

  update() {
    if (!this.port) {
      return;
    }
    this.port.postMessage("resized");
  }
}

