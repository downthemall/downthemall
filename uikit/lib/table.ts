
import { TableEvents } from "./tableevents";
import { CellTypes } from "./constants";

export class VirtualTable extends TableEvents {
  init() {
    this.resized();
  }
}

Object.assign(VirtualTable, CellTypes);
