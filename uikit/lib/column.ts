"use strict";
// License: MIT

/* eslint-disable no-unused-vars */
import { TableEvents } from "./tableevents";
import {addClass, debounce, sum} from "./util";
import {EventEmitter} from "./events";
import {APOOL} from "./animationpool";
import { ColumnConfig, ColumnConfigs } from "./config";

const PIXLIT_WIDTH = 2;
const MIN_COL_WIDTH = 16;
const MOVE_DEBOUNCE = 40;

function toPixel(v: string | null, def?: number) {
  def = def || 0;
  if (!v || v === "none" || v === "auto") {
    return def;
  }
  const val = parseFloat(v.slice(0, -PIXLIT_WIDTH));
  if (!isFinite(val) || val < def) {
    return def;
  }
  return val;
}

export class Column extends EventEmitter {
  public readonly columns: Columns;

  public readonly elem: HTMLTableHeaderCellElement;

  public readonly id: number;

  private readonly baseWidth: number;

  public readonly canHide: boolean;

  public readonly containerElem: HTMLSpanElement;

  public readonly spanElem: HTMLSpanElement;

  public readonly spacerElem: HTMLSpanElement;

  public readonly iconElem: HTMLSpanElement;

  public readonly grippyElem: HTMLSpanElement;

  public minWidth: number;

  public maxWidth: number;

  constructor(
      columns: Columns,
      col: HTMLTableHeaderCellElement,
      id: number,
      config: ColumnConfig | null) {
    super();
    this.columns = columns;
    this.elem = col;
    this.id = id;
    this.baseWidth = this.currentWidth;
    this.canHide = col.dataset.hideable !== "false";

    addClass(this.elem, "column");
    const containerElem = this.containerElem = document.createElement("span");
    addClass(containerElem, "column-container");
    this.spanElem = document.createElement("span");
    for (const e of Array.from(col.childNodes)) {
      this.spanElem.appendChild(e);
    }
    this.spanElem.setAttribute("title", this.spanElem.textContent || "");
    addClass(this.spanElem, "column-content");
    containerElem.appendChild(this.spanElem);

    this.spacerElem = document.createElement("span");
    addClass(this.spacerElem, "column-spacer");
    containerElem.appendChild(this.spacerElem);

    this.iconElem = document.createElement("span");
    addClass(this.iconElem, "column-icon");
    containerElem.appendChild(this.iconElem);

    this.grippyElem = document.createElement("span");
    addClass(this.grippyElem, "column-grippy");
    containerElem.appendChild(this.grippyElem);

    this.elem.appendChild(containerElem);

    if (config) {
      this.visible = config.visible;
    }
    this.initWidths(config);

    this.clicked = this.clicked.bind(this);
    this.gripped = this.gripped.bind(this);
    this.loosened = this.loosened.bind(this);
    this.gripmoved = debounce(this.gripmoved.bind(this), MOVE_DEBOUNCE);

    Object.seal(this);

    this.elem.addEventListener("click", this.clicked, false);
    this.elem.addEventListener("dblclick", this.clicked, false);
    this.grippyElem.addEventListener("mousedown", this.gripped);
  }

  get visible() {
    const {display} = getComputedStyle(this.elem, null);
    return display !== "none";
  }

  set visible(nv) {
    this.elem.style.display = nv ? "table-cell" : "none";
    this.columns.computeVisible();
  }

  get currentWidth() {
    const style = getComputedStyle(this.elem, null);
    if (!style) {
      return 0;
    }
    const width = toPixel(style.width);
    return width;
  }

  get clampedWidth() {
    const {currentWidth} = this;
    return Math.max(
      this.minWidth, Math.min(currentWidth, this.maxWidth || currentWidth));
  }


  get outOfBounds() {
    const {currentWidth} = this;
    return currentWidth - this.minWidth < -1 ||
      (this.maxWidth && currentWidth - this.maxWidth > 1);
  }

  get expandWidth() {
    return this.maxWidth ?
      Math.max(0, this.maxWidth - this.currentWidth) :
      Number.MAX_SAFE_INTEGER;
  }

  get shrinkWidth() {
    return Math.max(0, this.currentWidth - this.minWidth);
  }

  get config(): ColumnConfig {
    return {
      visible: this.visible,
      width: this.currentWidth,
    };
  }

  initWidths(config: ColumnConfig | null) {
    const style = getComputedStyle(this.elem, null);
    this.minWidth = toPixel(style.getPropertyValue("min-width"), MIN_COL_WIDTH);
    this.maxWidth = toPixel(style.getPropertyValue("max-width"), 0);
    const width = (config && config.width) || this.baseWidth;
    this.setWidth(width);
  }

  get width() {
    const style = getComputedStyle(this.elem, null);
    return style.getPropertyValue("width");
  }

  setWidth(width: number) {
    if (this.maxWidth) {
      width = Math.min(this.maxWidth, width);
    }
    width = Math.max(
      MIN_COL_WIDTH, Math.max(
        this.minWidth, width));
    if (isFinite(width)) {
      this.elem.style.width = `${width}px`;
    }
  }

  clicked(evt: MouseEvent) {
    try {
      if (this.columns.table.emit("column-clicked", this.elem.id, evt, this)) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    }
    catch (ex) {
      console.error(ex);
    }
    return null;
  }

  gripped(evt: MouseEvent) {
    if (this.emit("gripped", this, evt)) {
      return null;
    }
    addEventListener("mouseup", this.loosened);
    addEventListener("mousemove", this.gripmoved);
    evt.preventDefault();
    return false;
  }

  loosened(evt: MouseEvent) {
    removeEventListener("mouseup", this.loosened);
    removeEventListener("mousemove", this.gripmoved);
    this.emit("loosened", this, evt);
    evt.preventDefault();
    return false;
  }

  gripmoved(evt: MouseEvent) {
    this.emit("gripmoved", this, evt);
  }

  toString() {
    return `<Column(${this.elem.id}, ${this.id})>`;
  }
}

export class Columns extends EventEmitter {
  private lastWidth: number;

  public readonly named: Map<string, Column>;

  public readonly scrollSpace: HTMLDivElement;

  private scrollWidth: number;

  public readonly cols: Column[];

  public table: TableEvents;

  public visible: Column[];

  constructor(table: any, config: ColumnConfigs | null) {
    config = config || {};
    super();
    this.table = table;
    this.lastWidth = 0;
    this.scrollWidth = 0;

    this.gripmoved = this.gripmoved.bind(this);
    this.named = new Map<string, Column>();
    this.cols = Array.from(table.elem.querySelectorAll("th")).
      map((colEl: HTMLTableHeaderCellElement, colid: number) => {
        const columnConfig = config && colEl.id in config ?
          config[colEl.id] :
          null;
        const col = new Column(this, colEl, colid, columnConfig);
        col.on("gripmoved", this.gripmoved);
        this.named.set(colEl.id, col);
        return col;
      });
    this.scrollSpace = document.createElement("div");
    addClass(this.scrollSpace, "columns-scrollspace");
    this.scrollSpace.style.width = `${this.scrollWidth.toString}px`;
    this.computeVisible();

    Object.seal(this);
  }

  get config(): ColumnConfigs {
    const rv: any = {};
    for (const c of this.cols) {
      rv[c.elem.id] = c.config;
    }
    return rv;
  }

  computeVisible() {
    if (!this.cols) {
      return;
    }
    this.visible = this.cols.filter(col => {
      col.elem.classList.remove("last");
      const {visible} = col;
      return visible;
    });
    this.visible[this.visible.length - 1].elem.classList.add("last");
  }

  gripmoved(col: Column, evt: MouseEvent) {
    const cols = this.visible.filter(c => c.id > col.id);
    const base = cols.map(c => c.currentWidth);

    // Calculate new width (contrained)
    const curwidth = col.currentWidth;
    const rect = col.elem.getBoundingClientRect();
    let ewidth = Math.floor(evt.pageX - rect.left - (rect.width - curwidth));
    ewidth = Math.max(col.minWidth, ewidth);
    ewidth = Math.min(ewidth, col.maxWidth || ewidth);
    const shrinking = ewidth < curwidth;
    let allowances;
    if (shrinking) {
      // Shrinking
      allowances = cols.map(c => c.expandWidth);
      const maxExpand = sum(allowances);
      ewidth = Math.max(ewidth, curwidth - maxExpand);
    }
    else {
      // Expanding
      allowances = cols.map(c => c.shrinkWidth);
      const maxShrink = sum(allowances);
      ewidth = Math.min(ewidth, curwidth + maxShrink);
    }
    const diff = Math.abs(ewidth - curwidth);
    if (diff <= 1) {
      return;
    }
    let widths = Columns.computeWidthDiffs(allowances, diff);
    if (shrinking) {
      widths = widths.map(w => -w);
    }
    cols.unshift(col);
    base.unshift(ewidth);
    widths.unshift(0);
    this.applyNewWidths(cols, base, widths);
  }

  reflow() {
    const {clientWidth} = this.table.head;
    const {clientWidth: currentWidth} = this.table.columns;
    const {clientWidth: visibleWidth} = this.table.body;
    const cols = this.visible;
    const base = cols.map(c => c.currentWidth);
    let widths;
    if (currentWidth > visibleWidth) {
      // Shrink
      const shrinks = cols.map(c => c.shrinkWidth);
      const diff = clientWidth - visibleWidth;
      widths = Columns.computeWidthDiffs(shrinks, diff);
    }
    else if (cols.some(c => c.outOfBounds) || currentWidth !== clientWidth) {
      const expands = cols.map(c => c.expandWidth);
      const stuffing = sum(
        cols.map((c, i) => c.elem.getBoundingClientRect().width - base[i]));
      const clamped = sum(cols.map(c => c.clampedWidth));
      const diff = clientWidth - stuffing - clamped;
      widths = Columns.computeWidthDiffs(expands, diff).map(w => -w);
    }
    else {
      return null;
    }
    return this.applyNewWidths(cols, base, widths);
  }

  async applyNewWidths(cols: Column[], base: number[], widths: number[]) {
    const len = widths.length;
    widths.forEach((w, i) => {
      const idx = len - i - 1;
      w = widths[idx];
      const col = cols[idx];
      const cw = base[idx];
      const finalWidth = cw - w;
      col.setWidth(finalWidth);
    });
    await APOOL.schedule(this.table, this.table.resized);
    this.resized();
  }

  setScrollWidth(width: number) {
    if (this.scrollWidth === width) {
      return;
    }
    this.scrollWidth = width;
    this.scrollSpace.style.width = `${this.scrollWidth}px`;
    this.reflow();
  }

  static computeWidthDiffs(arr: number[], diff: number) {
    const avg = diff / arr.length;
    let rcount = 0;
    let rejected = 0;
    for (const c of arr) {
      const r = Math.max(avg - Math.min(c, avg), 0);
      if (r) {
        rejected += r;
        rcount++;
      }
    }
    const corravg = avg + rejected / (arr.length - rcount);
    return arr.map(c => Math.min(c, corravg));
  }

  resized() {
    setTimeout(() => {
      const cw = this.table.visibleWidth;
      if (this.lastWidth && this.lastWidth === cw) {
        return;
      }
      this.lastWidth = cw;
      this.reflow();
    }, 0);
  }
}

Columns.prototype.applyNewWidths = APOOL.wrap(Columns.prototype.applyNewWidths);
