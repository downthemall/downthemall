"use strict";
// License: MIT

import { Prefs } from "../prefs";
import { EventEmitter } from "../events";

const DEFAULT = {
  concurrent: -1,
};

class Limit {
  public readonly domain: string;

  public concurrent: number;

  constructor(raw: any) {
    Object.assign(this, DEFAULT, raw);
    if (!this.domain) {
      throw new Error("No domain");
    }
    if (!isFinite(this.concurrent) ||
      (this.concurrent | 0) !== this.concurrent ||
      this.concurrent < -1) {
      throw new Error("Invalid concurrent");
    }
  }

  toJSON() {
    return {
      domain: this.domain,
      concurrent: this.concurrent
    };
  }
}

export const Limits = new class Limits extends EventEmitter {
  public concurrent: number;

  private limits: Map<string, Limit>;

  constructor() {
    super();
    this.concurrent = 4;
    this.limits = new Map();
    const onpref = this.onpref.bind(this);
    Prefs.on("concurrent", onpref);
    Prefs.on("limits", onpref);
  }

  *[Symbol.iterator]() {
    for (const [domain, v] of this.limits.entries()) {
      const {concurrent} = v;
      yield {
        domain,
        concurrent,
      };
    }
  }

  onpref(prefs: any, key: string, value: any) {
    switch (key) {
    case "limits":
      this.limits = new Map(value.map((e: any) => [e.domain, new Limit(e)]));
      break;

    case "concurrent":
      this.concurrent = value;
      break;
    }
    this.emit("changed");
  }

  async load() {
    this.concurrent = await Prefs.get("concurrent", this.concurrent);
    const rawlimits = await Prefs.get("limits");
    this.limits = new Map(rawlimits.map((e: any) => [e.domain, new Limit(e)]));
    this.load = (() => {}) as unknown as () => Promise<void>;
    this.emit("changed");
  }

  getConcurrentFor(domain: string) {
    let rv: number;
    const dlimit = this.limits.get(domain);
    if (dlimit) {
      rv = dlimit.concurrent;
    }
    else {
      const limit = this.limits.get("*");
      rv = limit && limit.concurrent || -1;
    }
    return rv > 0 ? rv : this.concurrent;
  }

  async saveEntry(domain: string, descriptor: any) {
    const limit = new Limit(Object.assign({}, descriptor, {domain}));
    this.limits.set(limit.domain, limit);
    await this.save();
  }

  async save() {
    const limits = JSON.parse(JSON.stringify(this));
    await Prefs.set("limits", limits);
  }

  async "delete"(domain: string) {
    if (!this.limits.delete(domain)) {
      return;
    }
    await this.save();
  }

  toJSON() {
    return Array.from(this.limits.values());
  }
}();
