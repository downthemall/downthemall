"use strict";
// License: MIT

import { storage } from "./browser";

function toJSON(overlay: any, object: any) {
  const result: any = {};
  for (const key of Object.keys(overlay)) {
    const val: any = overlay[key];
    if (val !== object[val]) {
      result[key] = val;
    }
  }
  return result;
}

function isOverridden(overlay: any, object: any, name: string) {
  return name in overlay && name in object && overlay[name] !== object[name];
}

class Handler {
  private readonly base: any;

  constructor(base: any) {
    this.base = base;
  }

  "has"(target: any, name: string) {
    if (name === "toJSON") {
      return true;
    }
    if (name === "isOverridden") {
      return true;
    }
    return name in target || name in this.base;
  }

  "get"(target: any, name: string) {
    if (name === "toJSON") {
      return toJSON.bind(null, target, this.base);
    }
    if (name === "isOverridden") {
      return isOverridden.bind(null, target, this.base);
    }
    if (name === "reset") {
      return () => {
        Object.keys(target).forEach(k => delete target[k]);
      };
    }
    if (name in target) {
      return target[name];
    }
    if (name in this.base) {
      return this.base[name];
    }
    return null;
  }

  getOwnPropertyDescriptor(target: any, name: string) {
    let res = Object.getOwnPropertyDescriptor(target, name);
    if (!res) {
      res = Object.getOwnPropertyDescriptor(this.base, name);
    }
    if (res) {
      res.enumerable = res.writable = res.configurable = true;
    }
    return res;
  }

  "set"(target: any, name: string, value: any) {
    target[name] = value;
    return true;
  }

  ownKeys(target: any) {
    const result = Object.keys(target);
    result.push(...Object.keys(this.base));
    return Array.from(new Set(result));
  }
}

export function overlay(top: object) {
  return new Proxy(top, new Handler(this));
}

export async function loadOverlay(
    storageKey: string, sync: boolean, defaults: object) {
  const bottom = Object.freeze(defaults);
  const top = await storage[sync ? "sync" : "local"].get(storageKey);
  return overlay.call(bottom, top[storageKey] || {});
}

export interface Overlayable {
  overlay: Function;
}

Object.defineProperty(Object.prototype, "overlay", {
  value: overlay
});

Object.defineProperty(Object, "loadOverlay", {
  value: loadOverlay
});
