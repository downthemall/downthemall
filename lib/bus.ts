"use strict";
// License: MIT

import { EventEmitter } from "./events";
// eslint-disable-next-line no-unused-vars
import {runtime, tabs, RawPort, MessageSender} from "./browser";

export class Port extends EventEmitter {
  private port: RawPort | null;

  private disconnected = false;

  constructor(port: RawPort) {
    super();
    this.port = port;

    // Nasty firefox bug, thus listen for tab removal explicitly
    if (port.sender && port.sender.tab && port.sender.tab.id) {
      const otherTabId = port.sender.tab.id;
      const tabListener = (tabId: number) => {
        if (tabId !== otherTabId) {
          return;
        }
        this.disconnect();
      };
      tabs.onRemoved.addListener(tabListener);
    }
    port.onMessage.addListener(this.onMessage.bind(this));
    port.onDisconnect.addListener(this.disconnect.bind(this));
  }

  disconnect() {
    if (this.disconnected) {
      return;
    }
    this.disconnected = true;
    const {port} = this;
    this.port = null; // Break the cycle
    this.emit("disconnect", this, port);
  }

  get name() {
    if (!this.port) {
      return null;
    }
    return this.port.name;
  }

  get id() {
    if (!this.port || !this.port.sender) {
      return null;
    }
    return this.port.sender.id;
  }

  get isSelf() {
    return this.id === runtime.id;
  }

  post(msg: string, ...data: any[]) {
    if (!this.port) {
      return;
    }
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
    if (!this.port) {
      return;
    }
    if (Array.isArray(message)) {
      message.forEach(this.onMessage, this);
      return;
    }
    if (Object.keys(message).includes("msg")) {
      this.emit(message.msg, message);
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

  onMessage(msg: any, sender: MessageSender, callback: any) {
    let {type = null} = msg;
    if (!type) {
      type = msg;
    }
    this.emit(type, msg, callback);
  }

  onConnect(port: RawPort) {
    if (!port.name) {
      port.disconnect();
      return;
    }
    const wrapped = new Port(port);
    if (!this.ports.emit(port.name, wrapped)) {
      wrapped.disconnect();
    }
  }
}();
