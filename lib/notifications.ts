"use strict";
// License: MIT

import { runtime, notifications } from "./browser";

import {EventEmitter} from "./events";

const DEFAULTS = {
  type: "basic",
  iconUrl: runtime.getURL("/style/icon64.png"),
  title: "DownThemAll!",
  message: "message",
};

const TIMEOUT = 4000;

let gid = 1;

export class Notification extends EventEmitter {
  private notification: any;

  private readonly generated: boolean;

  constructor(id: string | null, options = {}) {
    super();

    this.generated = !id;
    id = id || `DownThemAll-notification${++gid}`;
    if (typeof options === "string") {
      options = {message: options};
    }
    options = Object.assign(Object.assign({}, DEFAULTS), options);

    this.opened = this.opened.bind(this);
    this.closed = this.closed.bind(this);
    this.clicked = this.clicked.bind(this);

    this.notification = notifications.create(id, options);

    this.notification.then(this.opened).catch(console.error);
    notifications.onClosed.addListener(this.closed);
    notifications.onClicked.addListener(this.clicked);
    notifications.onButtonClicked.addListener(this.clicked);
  }

  opened(notification: any) {
    this.notification = notification;
    this.emit("opened", this);
    if (this.generated) {
      setTimeout(() => {
        notifications.clear(notification);
      }, TIMEOUT);
    }
  }

  clicked(notification: any, button?: number) {
    // We can only be clicked, when we were opened, at which point the
    // notification id is available
    if (notification !== this.notification) {
      return;
    }
    if (typeof button === "number") {
      this.emit("button", this, button);
      return;
    }
    this.emit("clicked", this);
    console.log("clicked", notification);
  }

  async closed(notification: any) {
    if (notification !== await this.notification) {
      return;
    }
    notifications.onClosed.removeListener(this.closed);
    notifications.onClicked.removeListener(this.clicked);
    this.emit("closed", this);
  }
}
