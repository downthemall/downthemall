"use strict";
// License: MIT

import { downloads } from "./browser";
import { EventEmitter } from "../uikit/lib/events";
import { PromiseSerializer } from "./pserializer";

const VERSION = 1;
const STORE = "iconcache";
// eslint-disable-next-line no-magic-numbers
const CACHE_SIZES = [16, 32, 64, 127];

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
  const icon = new URL(await downloads.getFileIcon(manId, {size}));
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
  private db: Promise<IDBDatabase>;

  private cache: Map<string, string>;

  constructor() {
    super();
    this.db = this.init();
    this.cache = new Map();
    this.get = PromiseSerializer.wrapNew(8, this, this.get);
    this.set = PromiseSerializer.wrapNew(1, this, this.set);
  }

  private async init() {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(STORE, VERSION);
      req.onupgradeneeded = evt => {
        const db = req.result;
        switch (evt.oldVersion) {
        case 0: {
          db.createObjectStore(STORE);
          break;
        }
        }
      };
      req.onerror = ex => reject(ex);
      req.onsuccess = () => {
        resolve(req.result);
      };
    });
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
    const db = await this.db;
    rv = this.cache.get(sext);
    if (rv) {
      return rv;
    }
    return await new Promise<string | undefined>(resolve => {
      const trans = db.transaction(STORE, "readonly");
      trans.onerror = () => resolve(undefined);
      const store = trans.objectStore(STORE);
      const req = store.get(sext);
      req.onerror = () => resolve(undefined);
      req.onsuccess = () => {
        const rv = this.cache.get(sext);
        if (rv) {
          resolve(rv);
          return;
        }
        let {result} = req;
        if (!result) {
          resolve(undefined);
          return;
        }
        if (typeof req.result !== "string") {
          result = URL.createObjectURL(result).toString();
        }
        this.cache.set(sext, result);
        this.cache.set(ext, "");
        resolve(result);
      };
    });
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
    }
    this.cache.set(ext, "");
    const db = await this.db;
    await new Promise((resolve, reject) => {
      const trans = db.transaction(STORE, "readwrite");
      trans.onerror = reject;
      trans.oncomplete = resolve;
      const store = trans.objectStore(STORE);
      for (const {size, icon} of urls) {
        store.put(icon, `${ext}-${size}`);
      }
    });
    this.emit("cached", ext);
  }
}();
