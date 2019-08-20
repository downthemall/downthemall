"use strict";
// License: MIT

import { EventEmitter } from "../../lib/events";
import { runtime } from "../../lib/browser";

const PORT = new class Port extends EventEmitter {
  port: any;

  constructor() {
    super();
    this.port = runtime.connect(null, { name: "manager" });
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
    this.port.postMessage(Object.assign({msg}, data));
  }

  disconnect() {
    this.port.disconnect();
    this.port = null;
  }
}();

export default PORT;
