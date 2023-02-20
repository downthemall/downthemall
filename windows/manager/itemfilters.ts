/* eslint-disable no-magic-numbers */
"use strict";
// License: MIT

import {
  ContextMenu,
  MenuItem,
  MenuSeparatorItem,
  // eslint-disable-next-line no-unused-vars
  MenuItemBase,
  // eslint-disable-next-line no-unused-vars
  MenuPosition,
} from "../contextmenu";
import {EventEmitter} from "../../lib/events";
// eslint-disable-next-line no-unused-vars
import {filters, Matcher, Filter} from "../../lib/filters";
import {sort, defaultCompare, naturalCaseCompare} from "../../lib/sorting";
// eslint-disable-next-line no-unused-vars
import {DownloadItem, DownloadTable} from "./table";
import {formatSize} from "../../lib/formatters";
import {_} from "../../lib/i18n";
import {$} from "../winutil";

const TIMEOUT_SEARCH = 750;

class ItemFilter {
  public readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  // eslint-disable-next-line no-unused-vars
  allow(_: DownloadItem) {
    return true;
  }
}

export class TextFilter extends ItemFilter {
  private owner: FilteredCollection;

  private box: HTMLInputElement;

  private timer: number | null;

  private current: string;

  private expr: RegExp;

  constructor(owner: FilteredCollection) {
    super("text"); // There can be only one anyway
    this.owner = owner;
    this.box = $("#filter");
    this.timer = null;
    this.current = this.box.value = "";

    this.box.addEventListener("input", () => {
      if (this.timer) {
        return;
      }
      this.timer = window.setTimeout(() => this.update(), TIMEOUT_SEARCH);
    });
    this.box.addEventListener("keydown", e => {
      if (e.key !== "Escape") {
        return true;
      }
      this.current = this.box.value = "";
      this.box.blur();
      this.owner.removeFilter(this);
      e.stopPropagation();
      e.preventDefault();
      return false;
    });
  }

  update() {
    this.timer = null;
    const {value} = this.box;
    if (this.current === value) {
      return;
    }
    this.current = value;
    if (!value) {
      this.owner.removeFilter(this);
      return;
    }
    this.expr = new RegExp(value.
      replace(/^\s+|\s+$/g, "").
      replace(/([/{}()[\]\\^$.])/g, "\\$1").
      replace(/\*/g, ".*").
      replace(/\?/g, "."),
    "i");
    this.owner.addFilter(this);
  }

  allow(item: DownloadItem) {
    const {expr} = this;
    return expr.test(item.currentName) ||
      expr.test(item.usable) ||
      expr.test(item.description);
  }
}

interface MenuFilterItem {
  item: MenuItemBase;
  callback?: Function;
}

export class MenuFilter extends ItemFilter {
  items: Map<string, MenuFilterItem>;

  menu: ContextMenu;

  // eslint-disable-next-line no-unused-vars
  sort(_: boolean) {
    throw new Error("Method not implemented.");
  }

  constructor(id: string) {
    super(id);
    this.items = new Map();
    const tmpl = $<HTMLTemplateElement>("#menufilter-template").
      content.cloneNode(true);
    this.menu = new ContextMenu(
      (tmpl as HTMLElement).firstElementChild);
    this.menu.on("clicked", this.onclicked.bind(this));
    this.menu.on("ctx-menufilter-invert", () => this.invert());
    this.menu.on("ctx-menufilter-clear", () => this.clear());
    this.menu.on("ctx-menufilter-sort-ascending", () => this.sort(false));
    this.menu.on("ctx-menufilter-sort-descending", () => this.sort(true));
  }

  async show(evt: MenuPosition) {
    Array.from(this.menu).
      filter(e => e.startsWith("ctx-menufilter-item-")).
      forEach(e => this.menu.remove(e));
    this.items.clear();
    await this.populate();
    for (const {item} of Array.from(this.items.values()).reverse()) {
      this.menu.prepend(item);
    }
    this.menu.show(evt);
  }

  populate() {
    throw new Error("Method not implemented.");
  }

  addItem(text: string, callback?: Function, checked?: boolean) {
    const id = `ctx-menufilter-item-${this.items.size.toString()}`;
    if (text === "-") {
      const item = new MenuSeparatorItem(this.menu, id);
      this.items.set(id, {item, callback});
      return;
    }
    const item = new MenuItem(this.menu, id, text, {
      autoHide: "false",
    });
    item.iconElem.textContent = checked ? "✓" : "";
    this.items.set(id, {item, callback});
  }

  invert() {
    for (const {item, callback} of this.items.values()) {
      if (!callback) {
        continue;
      }
      if (!(item instanceof MenuItem)) {
        continue;
      }
      this.toggleItem(item);
      callback.apply(this);
    }
  }

  clear() {
    for (const {item} of this.items.values()) {
      if (!item.iconElem) {
        continue;
      }
      item.iconElem.textContent = "";
    }
  }

  toggleItem(item: MenuItem) {
    if (!item.iconElem) {
      return;
    }
    item.iconElem.textContent = !item.iconElem.textContent ? "✓" : "";
  }

  onclicked(evt: string) {
    const {item = null, callback = null} = this.items.get(evt) || {};
    if (!item) {
      return;
    }
    if (!(item instanceof MenuItem)) {
      return;
    }
    this.toggleItem(item);
    if (callback) {
      callback.call(this);
    }
  }
}

type ChainedFunction = (item: DownloadItem) => boolean;

interface ChainedItem {
  text: string;
  fn: ChainedFunction;
}

class FixedMenuFilter extends MenuFilter {
  collection: FilteredCollection;

  selected: Set<ChainedItem>;

  fixed: Set<ChainedItem>;

  chain: ChainedFunction | null;

  constructor(
      id: string, collection: FilteredCollection, items: ChainedItem[]) {
    super(id);
    this.collection = collection;
    this.selected = new Set();
    this.fixed = new Set(items);
    this.chain = null;
  }

  populate() {
    Array.from(this.fixed).forEach(item => {
      this.addItem(
        item.text, this.toggle.bind(this, item), this.selected.has(item));
    });
  }

  toggle(item: ChainedItem) {
    if (this.selected.has(item)) {
      this.selected.delete(item);
    }
    else {
      this.selected.add(item);
    }
    this.regenerate();
  }

  regenerate() {
    if (!this.selected.size) {
      this.collection.removeFilter(this);
      return;
    }
    this.chain = null;
    this.chain = Array.from(this.selected).reduce(
      (prev: ChainedFunction | null, curr) => {
        return (item: DownloadItem) => {
          return curr.fn(item) || (prev !== null && prev(item));
        };
      }, this.chain);
    this.collection.addFilter(this);
  }

  allow(item: DownloadItem) {
    return this.chain !== null && this.chain(item);
  }

  clear() {
    this.selected.clear();
    this.regenerate();
    super.clear();
  }
}

export class StateMenuFilter extends FixedMenuFilter {
  constructor(
      collection: FilteredCollection,
      StateTexts: Readonly<Map<number, string>>) {
    const items = Array.from(StateTexts.entries()).map(([state, text]) => {
      return {
        state,
        text,
        fn: (item: DownloadItem) => item.state === state,
      };
    });
    super("menufilter-state", collection, items);
  }

  sort(descending: boolean) {
    this.collection.sort(i => i.state, descending);
  }
}

export class SizeMenuFilter extends FixedMenuFilter {
  constructor(collection: FilteredCollection) {
    const items = [
      {text: "size-unknown", start: -1, stop: 1},
      {text: "sizes-small", start: 1, stop: 1 << 20},
      {text: "sizes-medium", start: 1 << 20, stop: 250 << 20},
      {text: "sizes-large", start: 250 << 20, stop: 1024 << 20},
      {text: "sizes-huge", start: 1024 << 20},
    ].map(i => {
      const {text, start, stop} = i;
      const astop = stop || 0;
      const fn = typeof stop !== undefined ?
        ((item: DownloadItem) =>
          item.totalSize >= start && item.totalSize < astop) :
        ((item: DownloadItem) => item.totalSize >= start);

      return Object.assign(i, {
        fn,
        text: _(text, formatSize(start, false), stop && formatSize(stop, false))
      });
    });
    super("mneufilter-size", collection, items);
  }

  sort(descending: boolean) {
    this.collection.sort(i => i.totalSize, descending);
  }
}

export class UrlMenuFilter extends MenuFilter {
  collection: FilteredCollection;

  filters: Set<Filter>;

  domains: Set<string>;

  cmatcher: Matcher | null;

  matcher: Matcher | null;

  constructor(collection: FilteredCollection) {
    super("menufilter-url");
    this.collection = collection;
    this.filters = new Set();
    this.domains = new Set();
    this.cmatcher = null;
  }

  async populate() {
    const filts = await filters();
    for (const i of filts.all.filter(e => e.id !== "deffilter-all")) {
      this.addItem(
        i.label, this.toggleRegularFilter.bind(this, i), this.filters.has(i));
    }
    const domains = sort(
      Array.from(new Set(this.collection.items.map(e => e.domain))),
      undefined,
      naturalCaseCompare
    );
    if (!domains.length) {
      return;
    }
    this.addItem("-");
    domains.forEach(e => {
      this.addItem(
        e, this.toggleDomainFilter.bind(this, e), this.domains.has(e));
    });
  }

  toggleRegularFilter(filter: Filter) {
    if (this.filters.has(filter)) {
      this.filters.delete(filter);
    }
    else {
      this.filters.add(filter);
    }
    this.regenerate();
  }

  toggleDomainFilter(domain: string) {
    if (this.domains.has(domain)) {
      this.domains.delete(domain);
    }
    else {
      this.domains.add(domain);
    }
    this.regenerate();
  }

  regenerate() {
    if (!this.domains.size && !this.filters.size) {
      this.matcher = null;
      this.collection.removeFilter(this);
      return;
    }

    if (!this.filters.size) {
      this.matcher = null;
    }
    else {
      const exprs = Array.from(this.filters).map(f => Array.from(f)).flat();
      this.matcher = new Matcher(exprs);
    }

    this.collection.addFilter(this);
  }

  allow(item: DownloadItem) {
    if (this.domains.has(item.domain)) {
      return true;
    }
    return !!(this.matcher && this.matcher.match(item.usable));
  }

  clear() {
    this.domains.clear();
    this.filters.clear();
    this.regenerate();
    super.clear();
  }

  sort(descending: boolean) {
    this.collection.sort(i => i.usable, descending, true);
  }
}

export class FilteredCollection extends EventEmitter {
  private readonly table: DownloadTable;

  items: DownloadItem[];

  filtered: DownloadItem[];

  private filters: ItemFilter[];

  constructor(table: DownloadTable) {
    super();
    this.table = table;
    this.items = [];
    this.filtered = [];
    this.filters = [];
  }

  addFilter(filter: ItemFilter) {
    // Remove any old filters
    this.filters = this.filters.filter(f => f.id !== filter.id);
    this.filters.push(filter);
    this.recalculate();
    this.emit("filter-active", filter.id);
  }

  removeFilter(filter: ItemFilter) {
    this.filters = this.filters.filter(f => f.id !== filter.id);
    this.recalculate();
    this.emit("filter-inactive", filter.id);
  }

  clearFilters() {
    this.filters.forEach(filter => {
      this.emit("filter-inactive", filter.id);
    });
    this.filters = [];
    this.recalculate();
  }

  _reassignPositions() {
    this.filtered = this.filtered.map((item, index) => {
      item.filteredPosition = index;
      return item;
    });
  }

  recalculate() {
    const selection = new Set(this.table.selection);
    const {focusRow} = this.table;
    const {filters} = this;
    let idx = 0;

    const selected = new Set<DownloadItem>();
    let focused: DownloadItem | undefined;

    if (selection.size) {
      this.filtered.forEach(item => {
        const {filteredPosition} = item;

        if (selection.has(filteredPosition)) {
          selected.add(item);
        }
        if (focusRow === filteredPosition) {
          focused = item;
        }
      });
    }

    function allow(item: DownloadItem) {
      if (!filters.every(f => f.allow(item))) {
        delete item.filteredPosition;
        return false;
      }
      item.filteredPosition = idx++;
      return true;
    }

    if (this.filters.length) {
      this.filtered = this.items.filter(allow);
    }
    else {
      this.filtered = this.items.slice();
      this._reassignPositions();
    }
    this.table.invalidate();
    if (!selection.size) {
      this.emit("changed");
      return;
    }
    for (const i of this.filtered) {
      if (selected.has(i)) {
        this.table.selection.add(i.filteredPosition);
      }
    }
    if (focused && focused.isFiltered) {
      this.table.focusRow = focused.filteredPosition;
      this.table.once("updated", () => {
        if (focused && focused.isFiltered) {
          this.table.scrollIntoView(focused.filteredPosition);
        }
      });
    }
    this.emit("changed");
  }

  add(items: DownloadItem[]) {
    if (!Array.isArray(items)) {
      items = [items];
    }
    const cur = this.filtered.length;
    items = items.filter(item => {
      item.position = this.items.push(item) - 1;
      this.emit("added", item);
      if (this.filters.length && !this.filters.every(f => f.allow(item))) {
        delete item.filteredPosition;
        return false;
      }

      item.filteredPosition = this.filtered.push(item) - 1;
      return true;
    });
    if (items.length) {
      this.table.rowCountChanged(cur, items.length);
      this.emit("changed");
    }
  }

  set(items: DownloadItem[]) {
    this.items = items.map((item, pos) => {
      item.position = pos;
      return item;
    });
    this.recalculate();
  }

  _reinsert(item: DownloadItem) {
    if (item.isFiltered) {
      return;
    }
    // Find insertion point
    const idx = this.filtered.findIndex(i => i.position > item.position);
    if (idx <= 0) {
      // last item
      item.filteredPosition = this.filtered.push(item) - 1;
      this.table.rowCountChanged(item.filteredPosition, 1);
      return;
    }
    this.filtered.splice(idx - 1, 0, item);
    this._reassignPositions();
    this.table.rowCountChanged(item.filteredPosition, 1);
    this.emit("changed");
  }

  _remove(item: DownloadItem) {
    if (!item.isFiltered) {
      return;
    }
    this.filtered.splice(item.filteredPosition, 1);
    this._reassignPositions();
    delete item.filteredPosition;
    this.table.rowCountChanged(item.filteredPosition, -1);
    this.emit("changed");
  }

  recalculateItem(item: DownloadItem) {
    if (this.filters.length && !this.filters.every(f => f.allow(item))) {
      this._remove(item);
    }
    else {
      this._reinsert(item);
    }
  }

  /**
   * Sort all items
   *
   * @param {Function} keyfn How to derivce sort keys
   * @param {boolean} [descending] Sort descending
   * @param {boolean} [natural] Sort naturally
   */
  sort(keyfn: (i: DownloadItem) => any, descending = false, natural = false) {
    const cmp = natural ? naturalCaseCompare : defaultCompare;
    let cmpfn = cmp;
    if (descending) {
      cmpfn = (a, b) => -cmp(a, b);
    }
    this.set(sort(this.items, keyfn, cmpfn));
    this.emit("sorted");
  }

  mapFilteredToAbsolute(indexes: number[]) {
    return indexes.map(i => this.filtered[i].position);
  }

  moveTop(indexes: number[]) {
    let swapped = false;
    this.mapFilteredToAbsolute(indexes).reverse().forEach((id, idx) => {
      id += idx;
      if (id === 0) {
        return;
      }
      const [item] = this.items.splice(id, 1);
      this.items.unshift(item);
      swapped = true;
    });
    if (swapped) {
      this.set(this.items);
      this.emit("sorted");
    }
  }

  moveBottom(indexes: number[]) {
    let swapped = false;
    const {length} = this.items;
    this.mapFilteredToAbsolute(indexes).forEach((id, idx) => {
      id -= idx;
      if (id >= length - 1) {
        return;
      }
      const [item] = this.items.splice(id, 1);
      this.items.push(item);
      swapped = true;
    });
    if (swapped) {
      this.set(this.items);
      this.emit("sorted");
    }
  }

  moveUp(indexes: number[]) {
    let swapped = false;
    this.mapFilteredToAbsolute(indexes).forEach((id, idx) => {
      if (id - idx === 0) {
        return;
      }
      const tmp = this.items[id - 1];
      this.items[id - 1] = this.items[id];
      this.items[id] = tmp;
      swapped = true;
    });
    if (swapped) {
      this.set(this.items);
      this.emit("sorted");
    }
  }

  moveDown(indexes: number[]) {
    const {length} = this.items;
    let swapped = false;
    this.mapFilteredToAbsolute(indexes).reverse().forEach((id, idx) => {
      if (id + idx === length - 1) {
        return;
      }
      const tmp = this.items[id + 1];
      this.items[id + 1] = this.items[id];
      this.items[id] = tmp;
      swapped = true;
    });
    if (swapped) {
      this.set(this.items);
      this.emit("sorted");
    }
  }

  invalidateIcons() {
    this.items.forEach(item => item.clearFontIcons());
    this.recalculate();
  }
}

module.exports = {
  TextFilter,
  UrlMenuFilter,
  StateMenuFilter,
  SizeMenuFilter,
  FilteredCollection
};
