"use strict";
// License: MIT

import { EventEmitter } from "../../lib/events";
// eslint-disable-next-line no-unused-vars
import { runtime, RawPort } from "../../lib/browser";
import { WindowState } from "../windowstate";

const PORT = new class Port extends EventEmitter {
  port: RawPort | null;

  constructor() {
    super();
    this.port = runtime.connect(null, { name: "manager" });
    if (!this.port) {
      throw new Error("Could not connect");
    }
    new WindowState(this.port);
    addEventListener("beforeunload", () => {
      if (this.port) {
        this.port.postMessage({
          msg: "unload",
          left: window.screenX,
          top: window.screenY
        });
      }
    });

    this.port.onMessage.addListener((msg: any) => {
      if (typeof msg === "string") {
        this.emit(msg);
        return;
      }
      const {msg: message = null} = msg;
      if (message) {
        this.emit(message, msg.data);
      }
    });
  }

  post(msg: string, data?: any) {
    if (!this.port) {
      return;
    }
    this.port.postMessage(Object.assign({msg}, data));
  }

  disconnect() {
    if (!this.port) {
      return;
    }
    this.port.disconnect();
    this.port = null;
  }
}();

export default PORT;
