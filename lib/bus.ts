"use strict";
// License: MIT

import { EventEmitter } from "./events";
import {runtime, tabs} from "./browser";

export class Port extends EventEmitter {
  private port: any;

  constructor(port: any) {
    super();
    this.port = port;

    let disconnected = false;
    let tabListener: any;
    const disconnect = () => {
      if (tabListener) {
        tabs.onRemoved.removeListener(tabListener);
        tabListener = null;
      }
      if (disconnected) {
        return;
      }
      disconnected = true;
      this.port = null; // Break the cycle
      this.emit("disconnect", this, port);
    };
    // Nasty firefox bug, thus listen for tab removal explicitly
    if (port.sender && port.sender.tab && port.sender.tab.id) {
      const otherTabId = port.sender.tab.id;
      const tabListener = function(tabId: number) {
        if (tabId !== otherTabId) {
          return;
        }
        disconnect();
      };
      tabs.onRemoved.addListener(tabListener);
    }
    port.onMessage.addListener(this.onMessage.bind(this));
    port.onDisconnect.addListener(disconnect);
  }

  get name() {
    return this.port.name;
  }

  get id() {
    return this.port.sender && (
      this.port.sender.id || this.port.sender.extensionId);
  }

  get isSelf() {
    return this.id === runtime.id;
  }

  post(msg: string, ...data: any[]) {
    if (!data) {
      this.port.postMessage({msg});
      return;
    }
    if (data.length === 1) {
      [data] = data;
    }
    this.port.postMessage({msg, data});
  }

  onMessage(message: any) {
    if (Object.keys(message).includes("msg")) {
      this.emit(message.msg, message);
      return;
    }
    if (Array.isArray(message)) {
      message.forEach(this.onMessage, this);
      return;
    }
    if (typeof message === "string") {
      this.emit(message);
      return;
    }
    console.error(`Unhandled message in ${this.port.name}:`, message);
  }
}

export const Bus = new class extends EventEmitter {
  private readonly ports: EventEmitter;

  public readonly onPort: (event: string, port: (port: Port) => void) => void;

  public readonly offPort: Function;

  public readonly oncePort: (event: string, port: (port: Port) => void) => void;

  constructor() {
    super();
    this.ports = new EventEmitter();
    this.onPort = this.ports.on.bind(this.ports);
    this.offPort = this.ports.off.bind(this.ports);
    this.oncePort = this.ports.once.bind(this.ports);
    runtime.onMessage.addListener(this.onMessage.bind(this));
    runtime.onConnect.addListener(this.onConnect.bind(this));
  }

  onMessage(msg: any, sender: any, callback: any) {
    let {type = null} = msg;
    if (!type) {
      type = msg;
    }
    this.emit(type, msg, callback);
  }

  onConnect(port: any) {
    if (!port.name) {
      port.disconnect();
      return;
    }
    this.ports.emit(port.name, new Port(port));
  }
}();
