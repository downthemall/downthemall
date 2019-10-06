"use strict";
// License: MIT

import DEFAULT_PREFS from "../data/prefs.json";
import { EventEmitter } from "./events";
import { loadOverlay } from "./objectoverlay";
import { storage } from "./browser";

const PREFS = Symbol("PREFS");
const PREF_STORAGE = "prefs";
const TIMEOUT_SAVE = 100;

export const Prefs = new class extends EventEmitter {
  private [PREFS]: any;

  private scheduled: any;

  constructor() {
    super();
    this.save = this.save.bind(this);
    this[PREFS] = loadOverlay(
      PREF_STORAGE, false, DEFAULT_PREFS).then(r => {
      storage.onChanged.addListener((changes: any, area: string) => {
        if (area !== "local" || !("prefs" in changes)) {
          return;
        }
        for (const [k, v] of Object.entries(changes.prefs.newValue)) {
          if (JSON.stringify(r[k]) === JSON.stringify(v)) {
            continue;
          }
          r[k] = v;
          this.scheduleSave();
          this.emit(k, this, k, v);
        }
      });
      return this[PREFS] = r;
    }).catch(ex => {
      console.error("Failed to load prefs", ex.toString(), ex.stack);
      this[PREFS] = null;
      throw ex;
    });
  }

  async "get"(key: string, defaultValue?: any) {
    const prefs = await this[PREFS];
    return prefs[key] || defaultValue;
  }

  *[Symbol.iterator]() {
    yield *Object.keys(this[PREFS]);
  }

  async "set"(key: string, value: any) {
    if (typeof key === "undefined" || typeof value === "undefined") {
      throw Error("Tried to set undefined to a pref, probably a bug");
    }
    const prefs = await this[PREFS];
    prefs[key] = value;
    this.scheduleSave();
    this.emit(key, this, key, value);
  }

  async reset(key: string) {
    if (typeof key === "undefined") {
      throw Error("Tried to set undefined to a pref, probably a bug");
    }
    const prefs = await this[PREFS];
    delete prefs[key];
    this.scheduleSave();
    this.emit(key, this, key, prefs[key]);
  }

  scheduleSave() {
    if (this.scheduled) {
      return;
    }
    this.scheduled = setTimeout(this.save, TIMEOUT_SAVE);
  }

  async save() {
    this.scheduled = 0;
    const prefs = (await this[PREFS]).toJSON();
    await storage.local.set({prefs});
  }
}();

export class PrefWatcher {
  public readonly name: string;

  public value: any;

  constructor(name: string, defaultValue?: any) {
    this.name = name;
    this.value = defaultValue;
    this.changed = this.changed.bind(this);
    Prefs.on(name, this.changed);
    Prefs.get(name, defaultValue).then(val => this.changed(Prefs, name, val));
  }

  changed(prefs: any, key: string, value: any) {
    this.value = value;
  }
}
