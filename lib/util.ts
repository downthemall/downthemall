"use strict";
// License: MIT

import * as psl from "psl";
import { identity, memoize } from "./memoize";
import { IPReg } from "./ipreg";
export { debounce } from "../uikit/lib/util";

export class Promised {
  private promise: Promise<any>;

  resolve: (value?: any) => void;

  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  then(
      resolve: (value: any) => any,
      reject: (reason: any) => PromiseLike<never>) {
    return this.promise.then(resolve).catch(reject);
  }
}

export function timeout<T>(to: number) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => reject(new Error("timeout")), to);
  });
}

export function lazy<T>(object: any, name: string, fun: (...any: any[]) => T) {
  Object.defineProperty(object, name, {
    get() {
      const value = fun();
      Object.defineProperty(object, name, {
        value,
        enumerable: true, writable: true, configurable: true
      });
      return value;
    },
    enumerable: true, configurable: true
  });
  return object;
}

export function none() { /* ignored */ }

export function sanitizePathGeneric(path: string) {
  return path.
    replace(/:+/g, "ː").
    replace(/\?+/g, "_").
    replace(/\*+/g, "_").
    replace(/<+/g, "◄").
    replace(/>+/g, "▶").
    replace(/"+/g, "'").
    replace(/\|+/g, "¦").
    replace(/[.\s]+$/g, "").
    trim();
}

const REG_TRIMMORE = /^[\s.]+|[\s.]+$/g;
const REG_RESERVED = new RegExp(
  `^(?:${"CON, PRN, AUX, NUL, COM1, COM2, COM3, COM4, COM5, COM6, COM7, COM8, COM9, LPT1, LPT2, LPT3, LPT4, LPT5, LPT6, LPT7, LPT8, LPT9".split(", ").join("|")})(?:\\..*)$`,
  "i");

export function sanitizePathWindows(path: string) {
  path = path.
    replace(/:+/g, "ː").
    replace(/\?+/g, "_").
    replace(/\*+/g, "_").
    replace(/<+/g, "◄").
    replace(/>+/g, "▶").
    replace(/"+/g, "'").
    replace(/\|+/g, "¦").
    replace(/#+/g, "♯").
    replace(/[.\s]+$/g, "").
    replace(REG_TRIMMORE, "");
  // Legacy file names
  if (REG_RESERVED.test(path)) {
    path = `!${path}`;
  }
  return path;
}

// Cannot use browser.runtime here
export const IS_WIN = typeof navigator !== "undefined" &&
  navigator.platform &&
  navigator.platform.includes("Win");


export const sanitizePath = identity(
  IS_WIN ? sanitizePathWindows : sanitizePathGeneric);

export class PathInfo {
  private baseField: string;

  private extField: string;

  private pathField: string;

  private nameField: string;

  private fullField: string;

  constructor(base: string, ext: string, path: string) {
    this.baseField = base;
    this.extField = ext;
    this.pathField = path;
    this.update();
  }

  get base() {
    return this.baseField;
  }

  set base(nv) {
    this.baseField = sanitizePath(nv);
    this.update();
  }

  get ext() {
    return this.extField;
  }

  set ext(nv) {
    this.extField = sanitizePath(nv);
    this.update();
  }

  get name() {
    return this.nameField;
  }

  get path() {
    return this.pathField;
  }

  set path(nv) {
    this.pathField = sanitizePath(nv);
    this.update();
  }

  get full() {
    return this.fullField;
  }

  private update() {
    this.nameField = this.extField ? `${this.baseField}.${this.extField}` : this.baseField;
    this.fullField = this.pathField ? `${this.pathField}/${this.nameField}` : this.nameField;
  }

  clone() {
    return new PathInfo(this.baseField, this.extField, this.pathField);
  }
}

// XXX cleanup + test
export const parsePath = memoize(function parsePath(
    path: string | URL): PathInfo {
  if (path instanceof URL) {
    path = decodeURIComponent(path.pathname);
  }
  path = path.trim().replace(/\\/g, "/");
  const pieces = path.split("/").
    map((e: string) => sanitizePath(e)).
    filter((e: string) => e && e !== ".");

  const name = path.endsWith("/") ? "" : pieces.pop() || "";
  const idx = name.lastIndexOf(".");
  let base = name;
  let ext = "";
  if (idx >= 0) {
    base = sanitizePath(name.slice(0, idx));
    ext = sanitizePath(name.slice(idx + 1));
  }

  for (let i = 0; i < pieces.length;) {
    if (pieces[i] !== "..") {
      ++i;
      continue;
    }
    if (i === 0) {
      throw Error("Invalid traversal");
    }
    pieces.slice(i - 1, 2);
  }

  path = pieces.join("/");
  return new PathInfo(base, ext, path);
});

export class CoalescedUpdate<T> extends Set<T> {
  private readonly to: number;

  private readonly cb: Function;

  private triggerTimer: any;

  constructor(to: number, cb: Function) {
    super();
    this.to = to;
    this.cb = cb;
    this.triggerTimer = 0;
    this.trigger = this.trigger.bind(this);
    Object.seal(this);
  }

  add(s: T) {
    if (!this.triggerTimer) {
      this.triggerTimer = setTimeout(this.trigger, this.to);
    }
    return super.add(s);
  }

  trigger() {
    this.triggerTimer = 0;
    if (!this.size) {
      return;
    }
    const a = Array.from(this);
    this.clear();
    this.cb(a);
  }
}

export const hostToDomain = memoize(psl.get, 1000);

export interface URLd extends URL {
  domain: string;
}

Object.defineProperty(URL.prototype, "domain", {
  get() {
    try {
      const {hostname} = this;
      return IPReg.test(hostname) ?
        hostname :
        hostToDomain(hostname) || hostname;
    }
    catch (ex) {
      console.error(ex);
      return this.host;
    }
  },
  enumerable: true,
  configurable: false,
});

/**
 * Filter arrays in-situ. Like Array.filter, but in place
 *
 * @param {Array} arr
 * @param {Function} cb
 * @param {Object} tp
 * @returns {Array} Filtered array (identity)
 */
export function filterInSitu<T>(
    arr: (T | null | undefined)[], cb: (value: T) => boolean, tp?: any) {
  tp = tp || null;
  let i; let k; let e;
  const carr = arr as unknown as T[];
  for (i = 0, k = 0, e = arr.length; i < e; i++) {
    const a = arr[i]; // replace filtered items
    if (!a) {
      continue;
    }
    if (cb.call(tp, a, i, arr)) {
      carr[k] = a;
      k += 1;
    }
  }
  carr.length = k; // truncate
  return carr;
}

/**
 * Map arrays in-situ. Like Array.map, but in place.
 * @param {Array} arr
 * @param {Function} cb
 * @param {Object} tp
 * @returns {Array} Mapped array (identity)
 */
export function mapInSitu<TRes, T>(arr: T[], cb: (value: T) => TRes, tp?: any) {
  tp = tp || null;
  const carr = arr as unknown as TRes[];

  for (let i = 0, e = arr.length; i < e; i++) {
    carr[i] = cb.call(tp, arr[i], i, arr);
  }
  return carr;
}

/**
 * Filters and then maps an array in-situ
 * @param {Array} arr
 * @param {Function} filterStep
 * @param {Function} mapStep
 * @param {Object} tp
 * @returns {Array} Filtered and mapped array (identity)
 */
export function filterMapInSitu<TRes, T>(
    arr: T[],
    filterStep: (value: T) => boolean,
    mapStep: (value: T) => TRes,
    tp?: any) {
  tp = tp || null;
  const carr = arr as unknown as TRes[];

  let i; let k; let e;
  for (i = 0, k = 0, e = arr.length; i < e; i++) {
    const a = arr[i]; // replace filtered items
    if (a && filterStep.call(tp, a, i, arr)) {
      carr[k] = mapStep.call(tp, a, i, arr);
      k += 1;
    }
  }
  carr.length = k; // truncate
  return carr;
}

/**
 * Map and then filter an array in place
 *
 * @param {Array} arr
 * @param {Function} mapStep
 * @param {Function} filterStep
 * @param {Object} tp
 * @returns {Array} Mapped and filtered array (identity)
 */
export function mapFilterInSitu<TRes, T>(
    arr: T[],
    mapStep: (value: T) => TRes | null | undefined,
    filterStep: (value: T) => boolean,
    tp?: any) {
  tp = tp || null;
  const carr = arr as unknown as TRes[];

  let i; let k; let e;
  for (i = 0, k = 0, e = arr.length; i < e; i++) {
    const a = carr[k] = mapStep.call(tp, arr[i], i, arr);
    if (a && filterStep.call(tp, a, i, arr)) {
      k += 1;
    }
  }
  carr.length = k; // truncate
  return carr;
}

/**
 * Get a random integer
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
export function randint(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}


export function validateSubFolder(folder: string) {
  if (!folder) {
    return;
  }
  folder = folder.replace(/[/\\]+/g, "/");
  if (folder.startsWith("/")) {
    throw new Error("error.noabsolutepath");
  }
  if (/^[a-z]:\//i.test(folder)) {
    throw new Error("error.noabsolutepath");
  }
  if (/^\.+\/|\/\.+\/|\/\.+$/g.test(folder)) {
    throw new Error("error.nodotsinpath");
  }
}
