"use strict";
// License: MIT

import uuid from "./uuid";

import "./objectoverlay";
import { storage, i18n } from "./browser";
import { EventEmitter } from "./events";
import { Prefs } from "./prefs";
import { TYPE_LINK, TYPE_MEDIA, TYPE_ALL } from "./constants";
// eslint-disable-next-line no-unused-vars
import { Overlayable } from "./objectoverlay";
import * as DEFAULT_FILTERS from "../data/filters.json";

const REG_ESCAPE = /[{}()[\]\\^$.]/g;
const REG_FNMATCH = /[*?]/;
const REG_REG = /^\/(.+?)\/(i)?$/;
const REG_WILD = /\*/g;
const REG_WILD2 = /\?/g;

export const FAST = Symbol();

function mergeUnique(e: RegExp) {
  if (this.has(e.source)) {
    return false;
  }
  this.add(e.source);
  return e;
}

function mergeMap(e: RegExp) {
  if (e.unicode) {
    this.add("u");
  }
  if (e.ignoreCase) {
    this.add("i");
  }
  return `(?:${e.source})`;
}


function mergeRegexps(expressions: RegExp[]) {
  if (!expressions.length) {
    return null;
  }
  if (expressions.length < 2) {
    return expressions[0];
  }
  const filtered = expressions.filter(mergeUnique, new Set());
  const flags = new Set();
  const mapped = filtered.map(mergeMap, flags);
  return new RegExp(mapped.join("|"), Array.from(flags).join(""));
}

function consolidateRegexps(expressions: Iterable<RegExp>) {
  const nc = [];
  const ic = [];
  for (const expr of expressions) {
    if (expr.ignoreCase) {
      ic.push(expr);
    }
    else {
      nc.push(expr);
    }
  }
  return {
    sensitive: mergeRegexps(nc),
    insensitive: mergeRegexps(ic)
  };
}

function *parseIntoRegexpInternal(str: string): Iterable<RegExp> {
  str = str.trim();
  // Try complete regexp
  if (str.length > 2 && str[0] === "/") {
    try {
      const m = str.match(REG_REG);
      if (!m) {
        throw new Error("Invalid RegExp supplied");
      }
      if (!m[1].length) {
        return;
      }
      yield new RegExp(m[1], m[2]);
      return;
    }
    catch (ex) {
      // fall-through
    }
  }

  // multi-expression
  if (str.includes(",")) {
    for (const part in str.split(",")) {
      yield *parseIntoRegexpInternal(part);
    }
    return;
  }

  // might be an fnmatch
  const fnmatch = REG_FNMATCH.test(str);
  str = str.replace(REG_ESCAPE, "\\$&");
  if (fnmatch) {
    str = `^${str.replace(REG_WILD, ".*").replace(REG_WILD2, ".")}$`;
  }
  if (str.length) {
    yield new RegExp(str, "i");
  }
}

function parseIntoRegexp(expr: string) {
  const expressions = Array.from(parseIntoRegexpInternal(expr));
  if (!expressions.length) {
    throw new Error(
      "Invalid filtea rexpression did not yield a regular expression");
  }
  return expressions;
}

export class Matcher {
  match: (str: string) => boolean;

  private sensitive: RegExp;

  private insensitive: RegExp;

  constructor(expressions: Iterable<RegExp>) {
    Object.assign(this, consolidateRegexps(expressions));
    if (this.sensitive && this.insensitive) {
      this.match = this.matchBoth;
    }
    else if (this.sensitive) {
      this.match = this.matchSensitive;
    }
    else if (this.insensitive) {
      this.match = this.matchInsensitive;
    }
    else {
      this.match = this.matchNone;
    }
    Object.freeze(this);
  }

  static fromExpression(expr: string) {
    return new Matcher(parseIntoRegexp(expr));
  }

  *[Symbol.iterator]() {
    if (this.sensitive) {
      yield this.sensitive;
    }
    if (this.insensitive) {
      yield this.insensitive;
    }
  }

  matchBoth(str: string) {
    return this.sensitive.test(str) || this.insensitive.test(str);
  }

  matchSensitive(str: string) {
    return this.sensitive.test(str);
  }

  matchInsensitive(str: string) {
    return this.insensitive.test(str);
  }

  /* eslint-disable no-unused-vars */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  matchNone(_: string) {
    return false;
  }
  /* eslint-enable no-unused-vars */

  matchItem(item: any) {
    const {usable = "", title = "", description = "", fileName = ""} = item;
    return this.match(usable) || this.match(title) ||
             this.match(description) || this.match(fileName);
  }
}

export class Filter {
  private readonly owner: Filters;

  public readonly id: any;

  private readonly raw: any;

  private _label: string;

  private _reg: Matcher;

  constructor(owner: Filters, id: any, raw: any) {
    if (!owner || !id || !raw) {
      throw new Error("null argument");
    }
    this.owner = owner;
    this.id = id;
    this.raw = raw;
    this.init();
  }

  init() {
    this._label = this.raw.label;
    if (this.id !== FAST && this.id.startsWith("deffilter-") &&
      !this.raw.isOverridden("label")) {
      this._label = i18n.getMessage(this.id) || this._label;
    }
    this._reg = Matcher.fromExpression(this.expr);
    Object.seal(this);
  }

  get descriptor() {
    return {
      active: this.active,
      id: this.id,
      label: this.label,
      type: this.type,
    };
  }

  [Symbol.iterator]() {
    return this._reg[Symbol.iterator]();
  }

  get label() {
    return this._label;
  }

  set label(nv) {
    this.raw.label = this._label = nv;
  }

  get expr() {
    return this.raw.expr;
  }

  set expr(nv) {
    if (nv === this.raw.expr) {
      return;
    }
    const reg = Matcher.fromExpression(nv);
    this._reg = reg;
    this.raw.expr = nv;
  }

  get active() {
    return this.raw.active;
  }

  set active(nv) {
    this.raw.active = !!nv;
  }

  get type() {
    return this.raw.type;
  }

  set type(nv) {
    if (nv !== TYPE_ALL && nv !== TYPE_LINK && nv !== TYPE_MEDIA) {
      throw new Error("Invalid filter type");
    }
    this.raw.type = nv;
  }

  get icon() {
    return this.raw.icon;
  }

  set icon(nv) {
    this.raw.icon = nv;
  }

  async save() {
    return await this.owner.save();
  }

  get custom() {
    return !!this.raw.custom;
  }

  async reset() {
    if (this.raw.custom) {
      throw Error("Cannot reset non-default filter");
    }
    this.raw.reset();
    await this.owner.save();
    this.init();
  }

  async "delete"() {
    if (!this.raw.custom) {
      throw Error("Cannot delete default filter");
    }
    await this.owner.delete(this.id);
  }

  match(str: string) {
    return this._reg.match(str);
  }

  matchItem(item: any) {
    return this._reg.matchItem(item);
  }

  toJSON() {
    return this.raw.toJSON && this.raw.toJSON() || this.raw;
  }
}

class FastFilter extends Filter {
  constructor(owner: Filters, value: string) {
    if (!value) {
      throw new Error("Invalid fast filter value");
    }
    super(owner, FAST, {
      id: FAST,
      label: FAST,
      type: TYPE_ALL,
      active: true,
      expr: value,
    });
  }
}

class Collection {
  exprs: Filter[];

  constructor() {
    this.exprs = [];
  }

  push(filter: Filter) {
    this.exprs.push(filter);
  }

  *[Symbol.iterator]() {
    for (const e of this.exprs) {
      if (!e.active) {
        continue;
      }
      yield *e;
    }
  }
}


class Filters extends EventEmitter {
  private loaded: boolean;

  private filters: Filter[];

  private fastFilter: string | null;

  ignoreNext: boolean;

  private readonly typeMatchers: Map<number, Matcher>;

  constructor() {
    super();
    this.typeMatchers = new Map();
    this.loaded = false;
    this.filters = [];
    this.fastFilter = null;
    this.ignoreNext = false;
    this.regenerate();
    Prefs.on("fast-filter", this.updateFastFilter.bind(this));
    storage.onChanged.addListener(async (changes: any) => {
      if (this.ignoreNext) {
        this.ignoreNext = false;
        return;
      }
      if (!("userFilters" in changes)) {
        return;
      }
      await this.load();
    });
    Object.seal(this);
  }

  get all() {
    return Array.from(this.filters);
  }

  get linkFilters() {
    return this.filters.filter(f => f.type & TYPE_LINK);
  }

  get mediaFilters() {
    return this.filters.filter(f => f.type & TYPE_MEDIA);
  }

  get active() {
    return this.filters.filter(e => e.active);
  }

  [Symbol.iterator]() {
    return this.filters[Symbol.iterator]();
  }

  async create(label: string, expr: string, type: number) {
    const id = `custom-${uuid()}`;
    const filter = new Filter(this, id, {
      active: true,
      label,
      expr,
      type,
    });
    this.filters.push(filter);
    await this.save();
  }

  "get"(id: any) {
    return this.filters.find(e => e.id === id);
  }

  async "delete"(id: any) {
    const idx = this.filters.findIndex(e => e.id === id);
    if (idx < 0) {
      return;
    }
    this.filters.splice(idx, 1);
    await this.save();
  }

  async save() {
    if (!this.loaded) {
      throw new Error("Filters not initialized yet");
    }
    const json = this.toJSON();
    this.ignoreNext = true;
    await storage.local.set({userFilters: json});
    this.regenerate();
  }

  getFastFilterFor(value: string) {
    return new FastFilter(this, value);
  }

  getFastFilter() {
    if (!this.fastFilter) {
      throw new Error("Nothing stored");
    }
    return new FastFilter(this, this.fastFilter);
  }

  async setFastFilter(value: string) {
    this.fastFilter = value || "";
    await Prefs.set("fast-filter", this.fastFilter);
  }

  updateFastFilter(pref: any, key: string, value: string) {
    this.fastFilter = value || null;
    this.regenerate();
  }

  regenerate() {
    const all = new Collection();
    const links = new Collection();
    const media = new Collection();
    for (const current of this.filters) {
      try {
        if (current.type & TYPE_ALL) {
          all.push(current);
          links.push(current);
          media.push(current);
        }
        else if (current.type & TYPE_LINK) {
          links.push(current);
        }
        else if (current.type & TYPE_MEDIA) {
          media.push(current);
        }
        else {
          throw Error("Invalid type mask");
        }
      }
      catch (ex) {
        console.error("Filter", current.label || "unknown", ex);
      }
    }
    if (this.fastFilter) {
      try {
        const fastFilter = new FastFilter(this, this.fastFilter);
        all.push(fastFilter);
        links.push(fastFilter);
        media.push(fastFilter);
      }
      catch (ex) {
        console.error("fast filter", this.fastFilter, "is invalid", ex);
      }
    }
    this.typeMatchers.set(TYPE_ALL, new Matcher(all));
    this.typeMatchers.set(TYPE_LINK, new Matcher(links));
    this.typeMatchers.set(TYPE_MEDIA, new Matcher(media));
    this.emit("changed");
  }

  async load() {
    const defaultFilters = DEFAULT_FILTERS as any;
    let savedFilters = (await storage.local.get("userFilters"));
    if (savedFilters && "userFilters" in savedFilters) {
      savedFilters = savedFilters.userFilters;
    }
    else {
      savedFilters = {};
    }
    const stub = Object.freeze({custom: true});
    this.filters.length = 0;
    const known = new Set();
    for (const filter of Object.keys(savedFilters)) {
      let current;
      if (filter in defaultFilters) {
        current = defaultFilters[filter].overlay(savedFilters[filter]);
        known.add(filter);
      }
      else {
        current = (stub as unknown as Overlayable).overlay(
          savedFilters[filter]);
      }
      try {
        this.filters.push(new Filter(this, filter, current));
      }
      catch (ex) {
        console.error("Failed to load filter", filter, ex);
      }
    }
    for (const filter of Object.keys(defaultFilters)) {
      if (known.has(filter)) {
        continue;
      }
      const current = ({custom: false} as unknown as Overlayable).overlay(
        defaultFilters[filter]);
      this.filters.push(new Filter(this, filter, current));
    }
    this.fastFilter = await Prefs.get("fast-filter", null);
    this.loaded = true;
    this.regenerate();
  }

  filterItemsByType(items: any[], type: number) {
    const matcher = this.typeMatchers.get(type);
    return items.filter(function(item) {
      return matcher && matcher.matchItem(item);
    });
  }

  toJSON() {
    const rv: any = {};
    for (const filter of this.filters) {
      if (filter.id === FAST) {
        continue;
      }
      const tosave = filter.toJSON();
      if (!tosave) {
        continue;
      }
      rv[filter.id] = tosave;
    }
    return rv;
  }
}

let _filters: any;

export async function filters(): Promise<Filters> {
  if (!_filters) {
    _filters = new Filters();
    await _filters.load();
  }
  return _filters;
}
