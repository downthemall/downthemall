"use strict";
// License: MIT

import {EventEmitter} from "../lib/events";
// eslint-disable-next-line no-unused-vars
import { ContextMenu } from "./contextmenu";
import { runtime } from "../lib/browser";

export const Keys = new class extends EventEmitter {
  private accel: string;

  public suppressed: boolean;

  constructor() {
    super();
    addEventListener("keydown", this.keypressed.bind(this), true);
    this.accel = "CTRL";
    (async () => {
      const info = await runtime.getPlatformInfo();
      if (info.os === "mac") {
        this.accel = "META";
      }
    })().catch(console.error);
    this.suppressed = false;
  }

  adoptContext(menu: ContextMenu) {
    menu.on("clicked", (item: string) => {
      const el = document.querySelector<HTMLElement>(`#${item}`);
      if (!el) {
        return;
      }
      const {key} = el.dataset;
      if (!key) {
        return;
      }
      if (el.classList.contains("disabled")) {
        return;
      }
      Keys.emit(key, {
        type: "keydown",
        target: el
      });
    });
  }

  adoptButtons(toolbar: HTMLElement) {
    const query = toolbar.querySelectorAll<HTMLElement>(".button[data-key]");
    for (const button of query) {
      const {key} = button.dataset;
      if (!key) {
        continue;
      }
      button.addEventListener("click", evt => {
        if (button.classList.contains("disabled")) {
          return;
        }
        this.emit(key, evt);
      });
    }
  }

  keypressed(event: KeyboardEvent) {
    if (this.suppressed) {
      return true;
    }
    const cls = [];
    try {
      if (event.ctrlKey) {
        cls.push("CTRL");
      }
      if (event.shiftKey) {
        cls.push("SHIFT");
      }
      if (event.altKey) {
        cls.push("ALT");
      }
      if (event.metaKey) {
        cls.push("META");
      }
      cls.push(event.code);
      const evt = cls.map(e => e === this.accel ? "ACCEL" : e).join("-");
      if (this.emit(evt, event)) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      return true;
    }
    catch (ex) {
      console.error(ex);
      return true;
    }
  }

  on(...args: any) {
    const cb = args.pop();
    for (const a of args) {
      super.on(a, cb);
    }
  }
}();
