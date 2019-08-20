"use strict";
// License: MIT

/* eslint-disable no-unused-vars */
import {CellTypes} from "./constants";
import {Row} from "./row";
import {addClass} from "./util";
/* eslint-enable no-unused-vars */

export class Cell {
  public type: CellTypes;

  public table: any;

  public row: Row;

  public colid: number;

  public icon: string | null;

  public cell: HTMLTableCellElement;

  public container: HTMLDivElement;

  public iconElem: HTMLSpanElement;

  constructor(type: CellTypes, row: any, colid: number) {
    this.type = type;
    this.table = row.table;
    this.row = row;
    this.colid = colid;
    this.icon = null;
    this.cell = document.createElement("td");
    this.container = document.createElement("div");
    addClass(this.container, "cell-container");
    this.cell.appendChild(this.container);
    this.cell.dataset.col = colid.toString();
    this.row.addCellClasses(colid, this.cell);
    this.icon = this.getCellIcon();
    if (this.icon) {
      this.iconElem = document.createElement("span");
      this.iconElem.className = this.icon;
      addClass(this.iconElem, "icon");
      this.container.appendChild(this.iconElem);
    }
  }

  static makeCell(type: CellTypes, row: any, colid: number) {
    /* eslint-disable @typescript-eslint/no-use-before-define */
    switch (type) {
    case CellTypes.TYPE_TEXT:
      return new TextCell(row, colid);

    case CellTypes.TYPE_CHECK:
      return new CheckCell(row, colid);

    case CellTypes.TYPE_PROGRESS:
      return new ProgressCell(row, colid);
    default:
      throw new Error(`Invalid cell type: ${type}`);
    }
    /* eslint-enable @typescript-eslint/no-use-before-define */
  }

  getCellIcon() {
    return this.table.getCellIcon(this.row.rowid, this.colid);
  }

  getCellText() {
    return this.table.getCellText(this.row.rowid, this.colid);
  }

  invalidate() {
    if (this.iconElem) {
      const icon = this.getCellIcon() || "";
      if (icon !== this.icon) {
        this.icon = icon;
        this.iconElem.className = this.icon || "";
        addClass(this.iconElem, "icon");
      }
    }
  }
}

class TextCell extends Cell {
  public value: string;

  public textElem: HTMLSpanElement;

  constructor(row: any, colid: number) {
    super(CellTypes.TYPE_TEXT, row, colid);
    this.textElem = document.createElement("span");
    addClass(this.textElem, "cell-text");
    this.container.appendChild(this.textElem);
    this.value = this.textElem.textContent = this.getCellText();
    if (!this.table.hover) {
      this.textElem.setAttribute("title", this.value);
    }
    Object.seal(this);
  }

  invalidate() {
    super.invalidate();
    const text = this.getCellText();
    if (text === this.value) {
      return;
    }
    this.value = this.textElem.textContent = text;
    if (!this.table.hover) {
      this.textElem.setAttribute("title", text);
    }
  }
}

export class CheckCell extends Cell {
  public value: boolean;

  public text: string;

  public lblElem: HTMLLabelElement;

  public cbElem: HTMLInputElement;

  public textElem: HTMLSpanElement;

  constructor(row: any, colid: number) {
    super(CellTypes.TYPE_CHECK, row, colid);

    this.lblElem = document.createElement("label");
    this.cbElem = document.createElement("input");
    this.cbElem.setAttribute("type", "checkbox");
    addClass(this.cbElem, "check-box");
    this.lblElem.appendChild(this.cbElem);

    this.textElem = document.createElement("span");
    addClass(this.textElem, "check-text");
    this.lblElem.appendChild(this.textElem);

    addClass(this.lblElem, "check-label");
    this.container.appendChild(this.lblElem);
    this.text = this.textElem.textContent = this.getCellText();
    if (!this.table.hover) {
      this.cell.setAttribute("title", this.text);
    }
    this.cbElem.checked = this.value = this.getCellCheck();
    addClass(this.cell, "check");
  }

  getCellCheck() {
    return !!this.table.getCellCheck(this.row.rowid, this.colid);
  }

  invalidate() {
    super.invalidate();
    const text = this.getCellText();
    if (text !== this.text) {
      this.text = this.textElem.textContent = text;
      if (!this.table.hover) {
        this.cell.setAttribute("title", text);
      }
    }
    const value = this.getCellCheck();
    if (value !== this.value) {
      this.cbElem.checked = this.value = value;
    }
  }
}

const PROGRESS_MAX = 100;

class ProgressCell extends Cell {
  public value: number;

  public contElem: HTMLDivElement;

  public meterElem: HTMLSpanElement;

  constructor(row: any, colid: number) {
    super(CellTypes.TYPE_PROGRESS, row, colid);
    this.value = this.getCellProgress();
    this.contElem = document.createElement("div");
    addClass(this.contElem, "progress-container");
    this.meterElem = document.createElement("span");
    if (!isFinite(this.value) || this.value < 0) {
      addClass(this.meterElem, "progress-bar", "progress-undetermined");
    }
    else {
      addClass(this.meterElem, "progress-bar");
      const progress = Math.min(
        PROGRESS_MAX, Math.max(0, this.value * PROGRESS_MAX));
      this.meterElem.style.width = `${progress.toFixed(2)}%`;
    }
    this.contElem.appendChild(this.meterElem);
    this.container.appendChild(this.contElem);

    addClass(this.cell, "progress");
  }

  getCellProgress() {
    return this.table.getCellProgress(this.row.rowid, this.colid);
  }

  invalidate() {
    super.invalidate();
    const value = this.getCellProgress();
    if (value === this.value) {
      return;
    }
    this.value = value;
    if (!isFinite(value) || value < 0) {
      this.meterElem.classList.add("virtualtable-progress-undetermined");
      this.meterElem.style.width = "";
    }
    else {
      this.meterElem.classList.remove("virtualtable-progress-undetermined");
      const progress = Math.min(
        PROGRESS_MAX, Math.max(0, value * PROGRESS_MAX));
      this.meterElem.style.width = `${progress.toFixed(2)}%`;
    }
  }
}
