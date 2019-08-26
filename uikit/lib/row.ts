"use strict";
// License: MIT

/* eslint-disable no-unused-vars */
import { CellTypes } from "./constants";
import { Cell, CheckCell } from "./cell";
import { Column } from "./column";
import {addClass} from "./util";
import {APOOL} from "./animationpool";
/* eslint-enable no-unused-vars */


const HOVER_TIME = 1000;

function makeStateChanger(ctx: Row, cls: string) {
  const prop = Symbol(cls);
  let state = false;
  const rv = function(newState: boolean) {
    state = newState;
    return ctx.changedState(prop, cls, state);
  };
  Object.defineProperty(rv, "state", {get() {
    return state;
  }});
  return rv;
}

const CELLS = new WeakMap<HTMLElement, Row>();

class Hover {
  private readonly row: Row;

  private readonly elem: HTMLElement;

  private x: number;

  private y: number;

  private hovering: boolean;

  private timer: number | null;

  constructor(row: Row) {
    this.row = row;
    this.elem = row.elem;

    this.onenter = this.onenter.bind(this);
    this.onleave = this.onleave.bind(this);
    this.onmove = this.onmove.bind(this);
    this.onhover = this.onhover.bind(this);

    this.elem.addEventListener("mouseenter", this.onenter, {passive: true});
    this.elem.addEventListener("mouseleave", this.onleave, {passive: true});

    this.x = -1;
    this.y = -1;
    this.hovering = false;
    this.timer = null;
  }

  onenter(evt: MouseEvent) {
    this.elem.addEventListener("mousemove", this.onmove, {passive: true});
    this.x = evt.clientX;
    this.y = evt.clientY;
    this.timer = window.setTimeout(this.onhover, HOVER_TIME);
  }

  onleave() {
    this.elem.removeEventListener("mousemove", this.onmove, {});
    this.x = -1;
    this.y = -1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.hovering) {
      this.row.table.emit("hover-done", {rowid: this.row.rowid});
    }
    this.hovering = false;
  }

  onmove(evt: MouseEvent) {
    this.x = evt.clientX;
    this.y = evt.clientY;
    if (this.hovering) {
      this.row.table.emit("hover-change", {
        rowid: this.row.rowid,
        x: this.x,
        y: this.y
      });
    }
    else {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = window.setTimeout(this.onhover, HOVER_TIME);
    }
  }

  onhover() {
    this.timer = null;
    this.hovering = true;
    this.row.table.emit("hover", {
      rowid: this.row.rowid,
      x: this.x,
      y: this.y
    });
  }
}

export class Row {
  public table: any;

  public rowid: number;

  public readonly elem: HTMLTableRowElement;

  private cols: Map<number, Cell>;

  public selected: any;

  public focused: any;

  constructor(table: any, rowid: number, cols: Column[]) {
    this.table = table;
    this.rowid = rowid;
    this.cols = new Map();
    this.selected = makeStateChanger(this, "virtualtable-selected");
    this.focused = makeStateChanger(this, "virtualtable-focused");
    this.elem = document.createElement("tr");
    this.addClasses();
    for (const col of cols) {
      this.elem.appendChild(this.makeCellFor(col.id));
    }
    if (table.hover) {
      new Hover(this);
    }
    Object.seal(this);
  }

  static getRowFor(cell: HTMLElement) {
    while (cell) {
      const result = CELLS.get(cell);
      if (result) {
        return result;
      }
      if (!cell.parentElement) {
        return null;
      }
      cell = cell.parentElement;
    }
    return null;
  }

  processCheckEvent(colid: number, evt: Event) {
    const value = (evt.target as HTMLInputElement).checked;
    const col = this.cols.get(colid) as CheckCell;
    col.value = value;
    this.table.setCellCheck(this.rowid, colid, value);
  }

  addClasses() {
    if (this.elem.className) {
      this.elem.className = "";
    }
    if (this.selected.state) {
      addClass(this.elem, "row", "selected");
    }
    else {
      addClass(this.elem, "row");
    }
    if (this.focused.state) {
      addClass(this.elem, "row", "focused");
    }
    const rcls = this.table.getRowClasses(this.rowid);
    if (rcls) {
      this.elem.classList.add(...rcls);
    }
  }

  addCellClasses(colid: number, cell: HTMLElement) {
    if (cell.className) {
      cell.className = "";
    }
    const ccls = this.table.getCellClasses(this.rowid, colid);
    if (ccls) {
      cell.classList.add(
        "virtualtable", "virtualtable-cell", `virtualtable-column-${colid}`,
        ...ccls);
    }
    else {
      cell.classList.add(
        "virtualtable", "virtualtable-cell", `virtualtable-column-${colid}`);
    }
  }

  makeCellFor(colid: number, type?: CellTypes) {
    const {table} = this;
    const resolvedType = type ||
      table.getCellType(this.rowid, colid) ||
      CellTypes.TYPE_TEXT;
    const cell = Cell.makeCell(resolvedType, this, colid);
    this.cols.set(colid, cell);
    CELLS.set(cell.cell, this);
    return cell.cell;
  }

  invalidateCell(colid: number, cv?: Cell) {
    const {table} = this;
    const ctype = table.getCellType(this, colid);
    cv = cv || this.cols.get(colid);
    if (!cv) {
      return;
    }
    if (ctype !== cv.type) {
      const newcell = this.makeCellFor(colid, ctype);
      this.elem.insertBefore(newcell, cv.cell);
      this.elem.removeChild(cv.cell);
      return;
    }
    cv.invalidate();
  }

  invalidate() {
    this.addClasses();
    for (const c of Array.from(this.cols)) {
      const [colid, cv] = c;
      this.invalidateCell(colid, cv);
    }
  }

  setWidths(cols: any[]) {
    APOOL.schedule(null, () => {
      cols = Array.from(cols, e => {
        return {
          id: e.id,
          width: e.width
        };
      }).reverse();
      cols.forEach(col => {
        const w = col.width;
        const c = this.cols.get(col.id);
        if (!c) {
          return;
        }
        const {cell} = c;
        cell.style.width = w;
        if (w !== "auto") {
          cell.style.maxWidth = w;
        }
      });
    });
  }

  changedState(prop: symbol, cls: string, state: boolean) {
    state = !!state;
    this.elem.classList[state ? "add" : "remove"](cls);
  }
}
