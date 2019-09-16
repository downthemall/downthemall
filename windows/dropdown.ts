"use strict";
// License: MIT

import { EventEmitter } from "../lib/events";
import { debounce } from "../lib/util";

const TIMEOUT_INPUT = 100;

export class Dropdown extends EventEmitter {
  container: HTMLDivElement;

  input: HTMLInputElement;

  select: HTMLSelectElement;

  constructor(el: string, options: string[] = []) {
    super();
    let input = document.querySelector(el);
    if (!input || !input.parentElement) {
      throw new Error("Invalid input element");
    }

    this.container = document.createElement("div");
    this.container.classList.add("dropdown");
    if (input.id) {
      this.container.id = `${input.id}-dropdown`;
    }

    input = input.parentElement.replaceChild(this.container, input);
    this.input = input as HTMLInputElement;
    this.container.appendChild(this.input);

    this.select = document.createElement("select");
    for (const option of options) {
      const elem = document.createElement("option");
      elem.setAttribute("value", elem.textContent = option);
      this.select.appendChild(elem);
    }
    this.container.insertBefore(this.select, this.input);

    this.select.addEventListener("change", () => {
      this.input.value = this.select.value;
      this.input.focus();
      this.input.select();
      this.emit("changed");
    });
    this.input.value = this.select.value;
    this.input.addEventListener("change", () => {
      this.emit("changed");
    });
    this.input.addEventListener("input", debounce(() => {
      this.emit("changed");
    }, TIMEOUT_INPUT));
  }

  get value() {
    return this.input.value;
  }

  set value(nv) {
    this.input.value = nv || "";
  }
}
