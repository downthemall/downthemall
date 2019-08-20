"use strict";
// License: MIT

import {CellTypes} from "./constants";
import {EventEmitter} from "./events";

/**
 * Methods you may want to implement to actually make your tree useful at all.
 * @abstract
 */
export class AbstractTable extends EventEmitter {
  /**
   * How many rows does this table contain.
   */
  get rowCount() {
    return 0;
  }

  /**
   * Get CSS classes for a specific row.
   *
   * @param {int} rowid
   *
   * @returns {string[]}
   *   CSS classes (or null)
   */
  // eslint-disable-next-line no-unused-vars
  getRowClasses(rowid: number): string[] | null {
    return null;
  }

  /**
   * Get CSS classes for a specific cell within a specific row.
   *
   * @param {int} rowid
   * @param {int} colid
   *
   * @returns {string[]}
   *   CSS classes (or null)
   */
  // eslint-disable-next-line no-unused-vars
  getCellClasses(rowid: number, colid: number): string[] {
    return [];
  }

  /**
   * Get a cell's checkbox status, if the cell is TYPE_CHECK.
   *
   * @param {int} rowid
   * @param {int} colid
   *
   * @returns {boolean}
   *   Checkbox is checked.
   */
  // eslint-disable-next-line no-unused-vars
  getCellCheck(rowid: number, colid: number) {
    return false;
  }

  /**
   * Set a cell's checkbox status.
   *
   * @param {int} row
   * @param {int} col
   * @param {boolean} value
   *   Checkbox state
   */
  // eslint-disable-next-line no-unused-vars
  setCellCheck(rowid: number, colid: number, value: boolean) {
    // ignored
  }

  /**
   * Get a cell's associated icon (as CSS class).
   *
   * @param {int} rowid
   * @param {int} colid
   *
   * @returns {string}
   *   Icon string to add to css classes, if any
   */
  // eslint-disable-next-line no-unused-vars
  getCellIcon(rowid: number, colid: number): string | null {
    return null;
  }

  /**
   * Get a cell's progress, if the cell is TYPE_PROGRESS.
   *
   * @param {int} rowid
   * @param {int} colid
   *
   * @returns {double}
   *   Progress (between 0.0 and 1.0)
   */
  // eslint-disable-next-line no-unused-vars
  getCellProgress(rowid: number, colid: number) {
    return -1;
  }

  /**
   * Get a cell's text, for all cell types supporting text.
   *
   * @param {int} rowid
   * @param {int} colid
   *
   * @returns {string}
   */
  // eslint-disable-next-line no-unused-vars
  getCellText(rowid: number, colid: number) {
    return "";
  }

  /**
   * Get a cell's type.
   * @see CellTypes
   *
   * @param {int} row
   * @param {int} col
   *
   * @returns {CellTypes}
   *  This cell's type
   *
   */
  // eslint-disable-next-line no-unused-vars
  getCellType(rowid: number, colid: number) {
    return CellTypes.TYPE_TEXT;
  }
}

Object.assign(AbstractTable, CellTypes);
Object.assign(AbstractTable.prototype, CellTypes);
