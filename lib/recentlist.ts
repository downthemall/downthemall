"use strict";
// License: MIT

import { none } from "./util";
import { storage } from "./browser";

const LIST = Symbol("saved-list");

function unique(e: string) {
  if (typeof e !== "string" || this.has(e)) {
    return false;
  }
  this.add(e);
  return true;
}

export class RecentList {
  public readonly pref: string;

  public readonly defaults: string[];

  public readonly limit: number;

  private _inited: any;

  private [LIST]: string[];

  constructor(pref: string, defaults: string[] = []) {
    if (!pref) {
      throw Error("Invalid pref");
    }
    defaults = defaults || [];
    if (!Array.isArray(defaults)) {
      throw new Error("Invalid defaults");
    }
    this.pref = `savedlist-${pref}`;
    this.defaults = Array.from(defaults);
    this[LIST] = [];
    this.limit = 15;
  }

  get values() {
    return Array.from(this[LIST]);
  }

  get current() {
    return this[LIST][0] || "";
  }

  async _init() {
    const {[this.pref]: saved = []} = await storage.local.get(this.pref) || [];
    this[LIST] = [...saved, ...this.defaults].
      filter(unique, new Set()).
      slice(0, this.limit);
  }

  init() {
    if (!this._inited) {
      this._inited = this._init();
      this._inited.then(() => {
        this.init = none;
      });
    }
    return this._inited;
  }

  async reset() {
    this[LIST] = Array.from(this.defaults);
    await this.save();
  }

  async push(value: string) {
    if (value === null || typeof value === "undefined") {
      throw new Error("Invalid value");
    }
    const list = this[LIST];
    const idx = list.indexOf(value);
    if (idx === 0) {
      return;
    }
    if (idx > 0) {
      list.splice(idx, 1);
    }
    list.unshift(value);
    while (list.length > 10) {
      list.pop();
    }
    await this.save();
    return;
  }

  async save() {
    await storage.local.set({[this.pref]: this[LIST]});
  }

  *[Symbol.iterator]() {
    yield *this[LIST];
  }
}

export const MASK = new RecentList("mask", [
  "*name*.*ext*",
  "*num*_*name*.*ext*",
  "*url*-*name*.*ext*",
  "downthemall/*y*-*m*/*name*.*ext*",
  "*name* (*text*).*ext*"
]);
MASK.init().catch(console.error);

export const FASTFILTER = new RecentList("fastfilter", [
  "",
  "/\\.mp3$/",
  "/\\.(html|htm|rtf|doc|pdf)$/",
  "http://www.website.com/subdir/*.*",
  "http://www.website.com/subdir/pre*.???",
  "*.z??, *.css, *.html"
]);
FASTFILTER.init().catch(console.error);

export const SUBFOLDER = new RecentList("subfolder", [
  "",
  "downthemall",
]);
SUBFOLDER.init().catch(console.error);
