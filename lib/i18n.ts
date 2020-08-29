"use strict";
// License: MIT

import {memoize} from "./memoize";
import langs from "../_locales/all.json";
import { sorted, naturalCaseCompare } from "./sorting";
import lf from "localforage";

export const ALL_LANGS = Object.freeze(new Map<string, string>(
  sorted(Object.entries(langs), e => {
    return [e[1], e[0]];
  }, naturalCaseCompare)));

let CURRENT = "en";
export function getCurrentLanguage() {
  return CURRENT;
}

declare let browser: any;
declare let chrome: any;

const CACHE_KEY = "_cached_locales";
const CUSTOM_KEY = "_custom_locale";

const normalizer = /[^A-Za-z0-9_]/g;

interface JSONEntry {
  message: string;
  placeholders: any;
}

class Entry {
  private message: string;

  constructor(entry: JSONEntry) {
    if (!entry.message.includes("$")) {
      throw new Error("Not entry-able");
    }
    let hit = false;
    this.message = entry.message.replace(/\$[A-Z0-9]+\$/g, (r: string) => {
      hit = true;
      const id = r.substr(1, r.length - 2).toLocaleLowerCase();
      const placeholder = entry.placeholders[id];
      if (!placeholder || !placeholder.content) {
        throw new Error(`Invalid placeholder: ${id}`);
      }
      return `${placeholder.content}$`;
    });
    if (!hit) {
      throw new Error("Not entry-able");
    }
  }

  localize(args: any[]) {
    return this.message.replace(/\$\d+\$/g, (r: string) => {
      const idx = parseInt(r.substr(1, r.length - 2), 10) - 1;
      return args[idx] || "";
    });
  }
}

class Localization {
  private strings: Map<string, Entry | string>;

  constructor(baseLanguage: any, ...overlayLanguages: any) {
    this.strings = new Map();
    const mapLanguage = (lang: any) => {
      for (const [id, entry] of Object.entries<JSONEntry>(lang)) {
        if (!entry.message) {
          continue;
        }
        try {
          if (entry.message.includes("$")) {
            this.strings.set(id, new Entry(entry));
          }
          else {
            this.strings.set(id, entry.message);
          }
        }
        catch (ex) {
          this.strings.set(id, entry.message);
        }
      }
    };
    mapLanguage(baseLanguage);
    overlayLanguages.forEach(mapLanguage);
  }

  localize(id: string, ...args: any[]) {
    const entry = this.strings.get(id.replace(normalizer, "_"));
    if (!entry) {
      return "";
    }
    if (typeof entry === "string") {
      return entry;
    }
    if (args.length === 1 && Array.isArray(args)) {
      [args] = args;
    }
    return entry.localize(args);
  }
}

function checkBrowser() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (typeof browser !== "undefined" && browser.i18n) {
    return;
  }
  if (typeof chrome !== "undefined" && chrome.i18n) {
    return;
  }
  throw new Error("not in a webext");
}

async function fetchLanguage(code: string) {
  try {
    const resp = await fetch(`/_locales/${code}/messages.json`);
    return await resp.json();
  }
  catch {
    return null;
  }
}


async function loadCached(): Promise<any> {
  const cached = await lf.getItem<string>(CACHE_KEY);
  if (!cached) {
    return null;
  }
  const parsed = JSON.parse(cached);
  if (!Array.isArray(parsed) || !parsed[0].CRASH || !parsed[0].CRASH.message) {
    console.warn("rejecting cached locales", parsed);
    return null;
  }
  return parsed;
}

async function loadRawLocales() {
  // en is the base locale, always to be loaded
  // The loader will override string from it with more specific string
  // from other locales
  const langs = new Set<string>(["en"]);

  const uiLang: string = (typeof browser !== "undefined" ? browser : chrome).
    i18n.getUILanguage();

  // Chrome will only look for underscore versions of locale codes,
  // while Firefox will look for both.
  // So we better normalize the code to the underscore version.
  // However, the API seems to always return the dash-version.

  // Add all base locales into ascending order of priority,
  // starting with the most unspecific base locale, ending
  // with the most specific locale.
  // e.g. this will transform ["zh", "CN"] -> ["zh", "zh_CN"]
  uiLang.split(/[_-]/g).reduce<string[]>((prev, curr) => {
    prev.push(curr);
    langs.add(prev.join("_"));
    return prev;
  }, []);

  if (CURRENT && CURRENT !== "default") {
    langs.delete(CURRENT);
    langs.add(CURRENT);
  }

  const valid = Array.from(langs).filter(e => ALL_LANGS.has(e));
  const fetched = await Promise.all(Array.from(valid, fetchLanguage));
  return fetched.filter(e => !!e);
}

async function load(): Promise<Localization> {
  try {
    checkBrowser();
    try {
      let currentLang: any = "";
      if (typeof browser !== "undefined") {
        currentLang = await browser.storage.sync.get("language");
      }
      else {
        currentLang = await new Promise(
          resolve => chrome.storage.sync.get("language", resolve));
      }
      if ("language" in currentLang) {
        currentLang = currentLang.language;
      }
      if (!currentLang || !currentLang.length) {
        currentLang = "default";
      }
      CURRENT = currentLang;
      // en is the base locale
      let valid = await loadCached();
      if (!valid) {
        valid = await loadRawLocales();
        await lf.setItem(CACHE_KEY, JSON.stringify(valid));
      }
      if (!valid.length) {
        throw new Error("Could not load ANY of these locales");
      }

      const custom = await lf.getItem<string>(CUSTOM_KEY);
      if (custom) {
        try {
          valid.push(JSON.parse(custom));
        }
        catch (ex) {
          console.error(ex);
          // ignored
        }
      }

      const base = valid.shift();
      const rv = new Localization(base, ...valid);
      return rv;
    }
    catch (ex) {
      console.error("Failed to load locale", ex.toString(), ex.stack, ex);
      return new Localization({});
    }
  }
  catch {
    // We might be running under node for tests

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messages = require("../_locales/en/messages.json");

    return new Localization(messages);
  }
}

type MemoLocalize = (id: string, ...args: any[]) => string;

export const locale = load();
let loc: Localization | null;
let memoLocalize: MemoLocalize | null = null;
locale.then(l => {
  loc = l;
  memoLocalize = memoize(loc.localize.bind(loc), 10 * 1000, 10);
});

/**
 * Localize a message
 * @param {string} id Identifier of the string to localize
 * @param {string[]} [subst] Message substitutions
 * @returns {string} Localized message
 */
export function _(id: string, ...subst: any[]) {
  if (!loc || !memoLocalize) {
    console.trace("TOO SOON");
    throw new Error("Called too soon");
  }
  if (!subst.length) {
    return memoLocalize(id);
  }
  return loc.localize(id, subst);
}

function localize_<T extends HTMLElement | DocumentFragment>(elem: T): T {
  for (const tmpl of elem.querySelectorAll<HTMLTemplateElement>("template")) {
    localize_(tmpl.content);
  }

  for (const el of elem.querySelectorAll<HTMLElement>("*[data-i18n]")) {
    const {i18n: i} = el.dataset;
    if (!i) {
      continue;
    }
    for (let piece of i.split(",")) {
      piece = piece.trim();
      if (!piece) {
        continue;
      }
      const idx = piece.indexOf("=");
      if (idx < 0) {
        let childElements;
        if (el.childElementCount) {
          childElements = Array.from(el.children);
        }
        el.textContent = _(piece);
        if (childElements) {
          childElements.forEach(e => el.appendChild(e));
        }
        continue;
      }
      const attr = piece.substr(0, idx).trim();
      piece = piece.substr(idx + 1).trim();
      el.setAttribute(attr, _(piece));
    }
  }
  for (const el of document.querySelectorAll("*[data-l18n]")) {
    console.error("wrong!", el);
  }
  return elem as T;
}

/**
 * Localize a DOM
 * @param {Element} elem DOM to localize
 * @returns {Element} Passed in element (fluent)
 */
export async function localize<T extends HTMLElement | DocumentFragment>(
    elem: T): Promise<T> {
  await locale;
  return localize_(elem);
}

export async function saveCustomLocale(data?: string) {
  if (!data) {
    await lf.removeItem(CUSTOM_KEY);
    return;
  }
  new Localization(JSON.parse(data));
  await localStorage.setItem(CUSTOM_KEY, data);
}
