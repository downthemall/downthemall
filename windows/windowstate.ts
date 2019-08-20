"use strict";
// License: MIT

export class WindowState {
  private readonly port: any;

  constructor(port: any) {
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

