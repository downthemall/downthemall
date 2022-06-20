"use strict";
// License: MIT

import { ALLOWED_SCHEMES } from "./constants";
import { TRANSFERABLE_PROPERTIES } from "./constants";

export interface BaseItem {
  url: string;
  usable: string;
  referrer?: string;
  usableReferrer?: string;
  description?: string;
  pageTitle?: string;
  title?: string;
  fileName?: string;
  batch?: number;
  idx?: number;
  mask?: string;
  subfolder?: string;
  startDate?: number;
  private?: boolean;
  postData?: string;
  paused?: boolean;
}

const OPTIONPROPS = Object.freeze([
  "referrer", "usableReferrer",
  "description", "title", "pageTitle",
  "fileName",
  "batch", "idx",
  "mask",
  "subfolder",
  "startDate",
  "private",
  "postData",
  "paused"
]);

function maybeAssign(options: any, what: any) {
  const type = typeof this[what];
  if (type === "number" || type === "string" || type === "boolean") {
    return;
  }
  if (type === "object" && this[what]) {
    return;
  }
  let val;
  if (what in options) {
    val = options[what];
  }
  this[what] = val;
}

export class Item implements BaseItem {
  public url: string;

  public usable: string;

  public referrer: string;

  public usableReferrer: string;

  public idx: number;

  constructor(raw: any, options?: any) {
    Object.assign(this, raw);
    OPTIONPROPS.forEach(maybeAssign.bind(this, options || {}));

    this.usable = Item.makeUsable(this.url, this.usable);
    this.usableReferrer = Item.makeUsable(this.referrer, this.usableReferrer);
  }

  static makeUsable(unusable: string, usable: string | boolean) {
    if (usable === true) {
      return unusable;
    }
    if (usable) {
      return usable;
    }
    try {
      return decodeURIComponent(unusable);
    }
    catch (ex) {
      return unusable;
    }
  }

  toString() {
    return `<Item(${this.url})>`;
  }
}

export class Finisher {
  public referrer: string;

  public usableReferrer: string;

  constructor(options: any) {
    this.referrer = options.baseURL;
    this.usableReferrer = Item.makeUsable(
      options.baseURL, options.usable || null);
  }

  finish(item: any) {
    if (!ALLOWED_SCHEMES.has(new URL(item.url).protocol)) {
      return null;
    }
    return new Item(item, this);
  }
}

function transfer(e: any, other: any) {
  for (const p of TRANSFERABLE_PROPERTIES) {
    if (!other[p] && e[p]) {
      other[p] = e[p];
    }
  }
}


export function makeUniqueItems(items: any[][], mapping?: Function) {
  const known = new Map();
  const unique = [];
  for (const itemlist of items) {
    for (const e of itemlist) {
      const other = known.get(e.url);
      if (other) {
        transfer(e, other);
        continue;
      }
      const finished = mapping ? mapping(e) : e;
      if (!finished) {
        continue;
      }
      known.set(finished.url, finished);
      unique.push(finished);
    }
  }
  return unique;
}
