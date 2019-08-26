"use strict";
// License: MIT

export interface ColumnConfig {
  visible: boolean;
  width: number;
}
export type ColumnConfigs ={ [name: string]: ColumnConfig };

export interface TableConfig {
  version?: number;
  columns?: ColumnConfigs;
}
