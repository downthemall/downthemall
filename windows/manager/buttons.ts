"use strict";
// License: MIT

import { EventEmitter } from "../../lib/events";
import { $ } from "../winutil";

export class Buttons extends EventEmitter {
  private readonly parent: HTMLElement;

  constructor(selector: string) {
    super();
    this.parent = $(selector);
    this.parent.addEventListener("click", this.clicked.bind(this));
  }

  clicked(evt: MouseEvent) {
    let target = evt.target as HTMLElement | null;
    while (target && target !== this.parent) {
      if (target.classList.contains("button")) {
        const {id} = target;
        if (id) {
          this.emit(id);
          return;
        }
      }
      target = target.parentElement;
    }
  }
}
