"use strict";
// License: MIT

import { Keys } from "./keys";
import { $ } from "./winutil";

export class Broadcaster {
  private readonly els: HTMLElement[];

  public onaction: Function;

  constructor(...els: string[]) {
    this.els = els.map(e => $(`#${e}`));
    this.onkey = this.onkey.bind(this);
    const keys = new Set(this.els.map(el => el.dataset.key));
    if (keys.size) {
      keys.forEach(key => {
        Keys.on(key, this.onkey);
      });
    }
  }

  get disabled() {
    return this.els[0].classList.contains("disabled");
  }

  set disabled(val) {
    if (val) {
      for (const el of this.els) {
        el.classList.add("disabled");
      }
      return;
    }
    for (const el of this.els) {
      el.classList.remove("disabled");
    }
  }

  onkey(evt: KeyboardEvent) {
    const { localName } = evt.target as HTMLElement;
    if (localName === "input" || localName === "textarea") {
      return undefined;
    }
    if (this.onaction) {
      this.onaction();
    }
    return true;
  }
}
