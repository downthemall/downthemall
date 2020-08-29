"use strict";
// License: MIT

import { downloads, CHROME } from "./browser";
import { EventEmitter } from "../uikit/lib/events";
import { PromiseSerializer } from "./pserializer";
import lf from "localforage";


const STORE = "iconcache";

// eslint-disable-next-line no-magic-numbers
const CACHE_SIZES = CHROME ? [16, 32] : [16, 32, 64, 127];

const BLACKLISTED = Object.freeze(new Set([
  "",
  "ext",
  "ico",
  "pif",
  "scr",
  "ani",
  "cur",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "cpl",
  "desktop",
  "app",
]));

async function getIcon(size: number, manId: number) {
  const raw = await downloads.getFileIcon(manId, {size});
  const icon = new URL(raw);
  if (icon.protocol === "data:") {
    const res = await fetch(icon.toString());
    const blob = await res.blob();
    return {size, icon: blob};
  }
  return {size, icon};
}

const SYNONYMS = Object.freeze(new Map<string, string>([
  ["jpe", "jpg"],
  ["jpeg", "jpg"],
  ["jfif", "jpg"],
  ["mpe", "mpg"],
  ["mpeg", "mpg"],
  ["m4v", "mp4"],
]));

export const IconCache = new class IconCache extends EventEmitter {
  private db = lf.createInstance({name: STORE});

  private cache: Map<string, string>;

  constructor() {
    super();
    this.cache = new Map();
    this.get = PromiseSerializer.wrapNew(8, this, this.get);
    this.set = PromiseSerializer.wrapNew(1, this, this.set);
  }

  private normalize(ext: string) {
    ext = ext.toLocaleLowerCase();
    return SYNONYMS.get(ext) || ext;
  }

  // eslint-disable-next-line no-magic-numbers
  async get(ext: string, size = 16) {
    ext = this.normalize(ext);
    if (BLACKLISTED.has(ext)) {
      return undefined;
    }
    const sext = `${ext}-${size}`;
    let rv = this.cache.get(sext);
    if (rv) {
      return rv;
    }
    rv = this.cache.get(sext);
    if (rv) {
      return rv;
    }
    let result = await this.db.getItem<any>(sext);
    if (!result) {
      return this.cache.get(sext);
    }
    rv = this.cache.get(sext);
    if (rv) {
      return rv;
    }
    if (typeof result !== "string") {
      result = URL.createObjectURL(result).toString();
    }

    this.cache.set(sext, result);
    this.cache.set(ext, "");
    return result;
  }

  async set(ext: string, manId: number) {
    ext = this.normalize(ext);
    if (BLACKLISTED.has(ext)) {
      return;
    }
    if (this.cache.has(ext)) {
      // already processed in this session
      return;
    }
    // eslint-disable-next-line no-magic-numbers
    const urls = await Promise.all(CACHE_SIZES.map(
      size => getIcon(size, manId)));
    if (this.cache.has(ext)) {
      // already processed in this session
      return;
    }
    for (const {size, icon} of urls) {
      this.cache.set(`${ext}-${size}`, URL.createObjectURL(icon));
      await this.db.setItem(`${ext}-${size}`, icon);
    }
    this.cache.set(ext, "");
    this.emit("cached", ext);
  }
}();
