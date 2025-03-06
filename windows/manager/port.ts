"use strict";
// License: MIT

import { EventEmitter } from "../../lib/events";
// eslint-disable-next-line no-unused-vars
import { runtime, RawPort } from "../../lib/browser";
import { WindowState } from "../windowstate";

const PING_INTERVAL = 10000;

const PORT = new class Port extends EventEmitter {
  port: RawPort | null;

  constructor() {
    super();
    this.connect();
    if (!this.port) {
      throw new Error("Could not connect");
    }
    new WindowState(this.port);
    addEventListener("beforeunload", () => {
      this.post("unload", {
        left: window.screenX,
        top: window.screenY
      });
    });
    setInterval(() => this.post("ping"), PING_INTERVAL);
    this.on("pong", () => {
      // ignored
    });
  }

  connect() {
    this.port = null;
    this.port = runtime.connect(null, { name: "manager" });
    this.port?.onMessage.addListener((msg: any) => {
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
    const message = Object.assign({msg}, data);
    try {
      this.port.postMessage(message);
    }
    catch (ex) {
      try {
        this.connect();
        if (!this.port) {
          throw new Error("failed to reconnect");
        }

        this.port.postMessage(message);
      }
      catch (iex) {
        console.error("Failed to post message", message, ex);
      }
    }
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
