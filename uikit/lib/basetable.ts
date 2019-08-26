"use stsrict";
// License: MIT

import { AbstractTable } from "./abstracttable";
import { APOOL } from "./animationpool";
import { ROW_CACHE_SIZE, ROW_REUSE_SIZE } from "./constants";
// eslint-disable-next-line no-unused-vars
import { Columns, Column } from "./column";
import { LRUMap } from "./lru";
import { Row } from "./row";
import { SelectionRange, TableSelection } from "./selection";
import {
  COLS, FIRSTROW, FOCUSROW, ROWCACHE, ROWHEIGHT, ROWREUSE, VISIBLE
} from "./tablesymbols";
import { InvalidatedSet, UpdateRecord } from "./tableutil";
import { addClass, clampUInt, IS_MAC } from "./util";
// eslint-disable-next-line no-unused-vars
import { TableConfig } from "./config";

const ROWS_SMALL_UPDATE = 5;
const PIXEL_PREC = 5;

interface KeyEvent extends UIEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

interface Invalidated {
  colid: number;
  row: Row;
}

export class BaseTable extends AbstractTable {
  public readonly version: number;

  elem: HTMLElement;

  invalidated: InvalidatedSet<Invalidated>;

  lastIdx: number;

  firstIdx: number;

  record: any;

  selStartRow: number;

  updateDOMId: Promise<void> | null;

  updating: number;

  singleSelect: boolean;

  hover: boolean;

  selection: TableSelection;

  selectionGrippy: HTMLDivElement;

  body: HTMLDivElement;

  table: HTMLTableElement;

  head: HTMLDivElement;

  columns: HTMLTableElement;

  [ROWCACHE]: LRUMap<number, Row>;

  [ROWREUSE]: Row[];

  [FIRSTROW]: Row | null;

  [FOCUSROW]: number;

  [ROWHEIGHT]: number;

  [VISIBLE]: Map<number, Row>;

  [COLS]: Columns;

  constructor(elem: any, config: TableConfig | null, version?: number) {
    config = (config && config.version === version && config) || {};
    super();

    this.version = version || 0;
    if (typeof elem === "string") {
      const sel = document.querySelector(elem) as HTMLElement;
      if (!sel) {
        throw new Error("Invalid selector");
      }
      this.elem = sel;
    }
    else {
      this.elem = elem;
    }

    this[ROWCACHE] = new LRUMap(ROW_CACHE_SIZE);
    const reuse: Row[] = this[ROWREUSE] = [];
    this[ROWCACHE].onpurge = (_: any, v: Row) => {
      if (v && reuse.length < ROW_REUSE_SIZE) {
        reuse.push(v);
      }
    };

    this.invalidated = new InvalidatedSet(this.processInvalidated.bind(this));
    this.lastIdx = this.firstIdx = 0;
    this.record = null;
    this.selStartRow = 0;
    this.updateDOMId = null;
    this.updating = 0;
    this[FIRSTROW] = null;
    this[FOCUSROW] = -1;
    this[ROWHEIGHT] = 0;
    this[VISIBLE] = new Map();
    this.update = APOOL.wrap(this.update);

    this.singleSelect = this.elem.dataset.singleselect === "true";
    this.hover = this.elem.dataset.hover === "true";
    this.selection = new TableSelection();
    this.makeDOM(config);
  }

  makeDOM(config: TableConfig) {
    const configColumns = "columns" in config ? config.columns : null;
    const cols = this[COLS] = new Columns(this, configColumns || null);

    const container = document.createElement("div");
    const thead = document.createElement("div");
    const columns = document.createElement("table");
    const colrow = document.createElement("tr");
    for (const c of cols.cols) {
      colrow.appendChild(c.elem);
    }
    addClass(colrow, "columnrow");
    columns.appendChild(colrow);
    addClass(columns, "columns");
    thead.appendChild(columns);
    addClass(thead, "head");
    thead.appendChild(cols.scrollSpace);
    const selectionGrippy = document.createElement("div");
    addClass(selectionGrippy, "column-selection-grippy");
    selectionGrippy.textContent = "☰";
    this.selectionGrippy = selectionGrippy;
    thead.appendChild(selectionGrippy);
    container.appendChild(thead);

    const tbody = this.body = document.createElement("div");
    const table = document.createElement("table");
    table.setAttribute("tabindex", "1");
    addClass(table, "table"),
    tbody.appendChild(table);
    addClass(tbody, "body");
    container.appendChild(tbody);

    addClass(container, "container");
    const {parentElement} = this.elem;
    if (parentElement) {
      parentElement.insertBefore(container, this.elem);
      parentElement.removeChild(this.elem);
    }

    this.table = table;
    this.head = thead;
    this.columns = columns;
    container.id = this.elem.id;
    this.elem = container;
  }

  init() {
    // ignored
  }

  /* do not override unless you know what you're doing */

  getColumnByName(id: string) {
    return this[COLS].named.get(id);
  }

  get focusRow() {
    return this[FOCUSROW];
  }

  set focusRow(rowid) {
    if (!isFinite(rowid)) {
      throw new Error("Invalid focus row");
    }
    if (this[FOCUSROW] === rowid) {
      return;
    }
    if (this[FOCUSROW] >= 0) {
      const ofr = this.getRow(this.focusRow);
      if (ofr) {
        ofr.focused(false);
      }
    }
    this[FOCUSROW] = rowid;
    const row = this.getRow(rowid);
    if (row) {
      row.focused(true);
    }
    this.scrollIntoView(rowid);
  }

  get visibleHeight() {
    return this.body.clientHeight;
  }

  get visibleWidth() {
    return this.body.clientWidth;
  }

  get visibleTop() {
    return this.body.scrollTop;
  }

  get rowHeight() {
    return this[ROWHEIGHT] || Number.MAX_SAFE_INTEGER;
  }

  resetRowHeight() {
    this[ROWHEIGHT] = Number.MAX_SAFE_INTEGER;
  }

  get totalHeight() {
    return this.rowCount * this.rowHeight;
  }

  get visibleRange() {
    const {rowHeight, visibleTop} = this;
    const inset = visibleTop % rowHeight;
    let top = visibleTop;
    let height = this.visibleHeight;
    if (inset) {
      top += rowHeight - inset;
      height -= rowHeight - inset;
    }
    const firstIdx = clampUInt(top / rowHeight);
    const lastIdx = firstIdx + clampUInt(
      Math.floor(height / rowHeight) - 1, this.rowCount - 1 - firstIdx);
    return new SelectionRange(firstIdx, lastIdx);
  }

  get config(): TableConfig {
    return {
      version: this.version,
      columns: this.columnConfig
    };
  }

  get columnConfig() {
    return this[COLS].config;
  }

  invalidate() {
    this.lastIdx = this.firstIdx = 0;
    this[VISIBLE].clear();
    this[ROWCACHE].clear();
    this[ROWREUSE].length = 0;
    this[FOCUSROW] = -1;
    this.selection.clear();
    this.update();
  }

  invalidateRow(rowid: number) {
    this.invalidateCell(rowid, -1);
  }

  invalidateCell(rowid: number, colid: number) {
    const row = this[VISIBLE].get(rowid) || this[ROWCACHE].get(rowid);
    if (!row) {
      return;
    }
    this.invalidated.add({row, colid});
  }

  processInvalidated() {
    for (const {colid, row} of this.invalidated) {
      if (colid >= 0) {
        row.invalidateCell(colid);
      }
      else {
        row.invalidate();
      }
    }
  }

  beginUpdate() {
    this.updating++;
  }

  _endUpdate() {
    return this.updating = Math.max(0, this.updating - 1);
  }

  endUpdate() {
    if (!this._endUpdate()) {
      this.update();
    }
  }

  createRow(rowid: number, cols: Column[]) {
    let row = this[ROWCACHE].get(rowid);
    if (row) {
      return row;
    }
    row = this[ROWREUSE].pop();
    if (row) {
      row.rowid = rowid;
      row.invalidate();
      return row;
    }
    return new Row(this, rowid, cols);
  }

  update() {
    if (this.updating) {
      return;
    }
    const record = new UpdateRecord(this, this[COLS].visible);

    const firstRemaining = record.firstVisibleIdx - this.firstIdx;
    const lastRemaining = this.lastIdx - record.lastVisibleIdx;
    const firstRequired = Math.min(record.firstVisibleIdx, ROWS_SMALL_UPDATE);
    const lastRequired = Math.min(
      this.rowCount - record.lastVisibleIdx - 1, ROWS_SMALL_UPDATE);
    if (record.rowHeight !== Number.MAX_SAFE_INTEGER &&
      firstRemaining >= firstRequired &&
      lastRemaining > lastRequired) {
      if (!this.rowCount) {
        this.record = record;
        if (!this.updateDOMId) {
          this.updateDOMId = APOOL.schedule(this, this.updateDOM);
        }
      }
      return;
    }
    this.beginUpdate();
    this[VISIBLE].clear();
    for (let i = record.firstIdx; i <= record.lastIdx; ++i) {
      const row = this.createRow(i, record.cols);
      row.selected(this.selection.contains(i));
      row.focused(this[FOCUSROW] === i);
      this[ROWCACHE].set(i, row);
      this[VISIBLE].set(i, row);
      record.add(row);
    }
    if (!record.rows) {
      this._endUpdate();
      return;
    }
    // We might have been re-run before we updated the DOM
    // Still need to apply this most recent changes
    this.record = record;
    if (!this.updateDOMId) {
      this.updateDOMId = APOOL.schedule(this, this.updateDOM);
    }
  }

  updateDOM() {
    this.updateDOMId = null;
    if (!this.record) {
      return;
    }
    const {record, table} = this;
    this.record = null;
    const [first] = record.rows;
    this[FIRSTROW] = first;
    try {
      if (table.firstChild) {
        for (const row of Array.from(table.children)) {
          if (!record.children.has(row)) {
            table.removeChild(row);
          }
        }
      }
      for (let i = 0, e = record.rows.length; i < e; ++i) {
        const row = record.rows[i];
        if (table.children[i] === row.elem) {
          continue;
        }
        table.insertBefore(row.elem, table.children[i + 1]);
      }
      if (first) {
        first.setWidths(record.cols);
      }
      if (record.rowHeight === Number.MAX_SAFE_INTEGER) {
        if (first) {
          setTimeout(() => {
            this[ROWHEIGHT] = first.elem.getBoundingClientRect().height;
            if ((this[ROWHEIGHT] | 0) !== this[ROWHEIGHT]) {
              console.warn(
                "Client height is not an integer, rounding errors ahead",
                this[ROWHEIGHT]);
            }

            if (this[ROWHEIGHT]) {
              this.update();
            }
          }, 0);
        }
      }
      else {
        this.firstIdx = record.firstIdx;
        this.lastIdx = record.lastIdx;

        table.style.marginTop = `${record.top.toFixed(PIXEL_PREC)}px`;
        table.style.marginBottom = `${record.bottom.toFixed(PIXEL_PREC)}px`;
      }
    }
    finally {
      this._endUpdate();
      this.emit("updated", this);
    }
  }

  setWidths() {
    const first = this[FIRSTROW];
    if (first) {
      first.setWidths(this[COLS].visible);
      const diff = this.head.clientWidth - this.body.clientWidth;
      this[COLS].setScrollWidth(diff);
    }
  }

  rowCountChanged(pos: number, items: number) {
    // Just clear, will be refilled by update anyway
    this[VISIBLE].clear();
    this[ROWCACHE].clear();

    this.selection.offset(pos, items); // adjust selection
    this.lastIdx = this.firstIdx = 0; // Make sure we update
    this.update(); // force an update
  }

  moveTo(rowid: number, evt: KeyEvent) {
    if (evt.ctrlKey || evt.metaKey) {
      // just move focus
    }
    else {
      this.selection.replace(rowid);
    }
    this.selStartRow = rowid;
    this.focusRow = rowid;
  }

  selectTo(rowid: number, evt: KeyEvent) {
    if ((!IS_MAC && evt.ctrlKey) || evt.metaKey) {
      this.selection.toggle(rowid);
      this.selStartRow = rowid;
    }
    else if (evt.shiftKey && this.focusRow >= 0) {
      if (this.selStartRow > rowid) {
        this.selection.replace(rowid, this.selStartRow);
      }
      else {
        this.selection.replace(this.selStartRow, rowid);
      }
    }
    else {
      this.selection.replace(rowid);
      this.selStartRow = rowid;
    }
    this.focusRow = rowid;
  }

  toggleCurrent() {
    const rowid = clampUInt(this.focusRow);
    this.selection.toggle(rowid);
    this.selStartRow = rowid;
    this.focusRow = rowid;
  }

  isCheckClick(evt: MouseEvent) {
    return /virtualtable-check/.test((evt.target as HTMLElement).className) &&
      !evt.ctrlKey && !evt.shiftKey && !evt.metaKey;
  }

  scrollIntoView(rowid: number) {
    const vrange = this.visibleRange;
    if (vrange.contains(rowid - 1) && vrange.contains(rowid + 1)) {
      return;
    }
    let newTop;
    if (rowid + 1 >= vrange.end) {
      // Move down
      const vrow = rowid - vrange.length + 2;
      newTop = vrow * this.rowHeight;
    }
    else {
      // Move up
      newTop = (rowid - 1) * this.rowHeight;
    }
    newTop = clampUInt(newTop, this.totalHeight);
    this.body.scrollTop = newTop;
  }

  navigate(rowid: number, evt: KeyEvent) {
    if (!this.singleSelect && evt.shiftKey) {
      this.selectTo(rowid, evt);
    }
    else {
      this.moveTo(rowid, evt);
    }
  }

  navigateUp(evt: KeyboardEvent) {
    const rowid = clampUInt(this.focusRow - 1, this.rowCount - 1);
    this.navigate(rowid, evt);
  }

  navigateDown(evt: KeyboardEvent) {
    const rowid = clampUInt(this.focusRow + 1, this.rowCount - 1);
    this.navigate(rowid, evt);
  }

  navigateTop(evt: KeyboardEvent) {
    this.navigate(0, evt);
  }

  navigateBottom(evt: KeyboardEvent) {
    const rowid = clampUInt(this.rowCount - 1);
    this.navigate(rowid, evt);
  }

  navigatePageUp(evt: KeyboardEvent) {
    const rowid = clampUInt(
      this.focusRow - this.visibleRange.length, this.rowCount - 1);
    this.navigate(rowid, evt);
  }

  navigatePageDown(evt: KeyboardEvent) {
    const rowid = clampUInt(
      this.focusRow + this.visibleRange.length, this.rowCount - 1);
    this.navigate(rowid, evt);
  }

  getRow(rowid: number) {
    return this[VISIBLE].get(rowid) || this[ROWCACHE].get(rowid);
  }

  toJSON() {
    return this.config;
  }
}
