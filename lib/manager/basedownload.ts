"use strict";
// License: MIT

// eslint-disable-next-line no-unused-vars
import { parsePath, URLd } from "../util";
import { QUEUED, RUNNING, PAUSED } from "./state";
import Renamer from "./renamer";
// eslint-disable-next-line no-unused-vars
import { BaseItem } from "../item";

const SAVEDPROPS = [
  "state",
  "url",
  "usable",
  "referrer",
  "usableReferrer",
  "fileName",
  "mask",
  "subfolder",
  "date",
  // batches
  "batch",
  "idx",
  // meta data
  "description",
  "title",
  "postData",
  // progress
  "totalSize",
  "written",
  // server stuff
  "serverName",
  "browserName",
  "mime",
  "prerolled",
  // other options
  "private",
  "pageTitle",
  // db
  "manId",
  "dbId",
  "position",
];

const DEFAULTS = {
  state: QUEUED,
  error: "",
  serverName: "",
  browserName: "",
  fileName: "",
  totalSize: 0,
  written: 0,
  manId: 0,
  mime: "",
  prerolled: false,
  retries: 0,
  deadline: 0
};

let sessionId = 0;


export class BaseDownload {
  public state: number;

  public sessionId: number;

  public renamer: Renamer;

  public uURL: URLd;

  public url: string;

  public pageTitle?: string;

  public usable: string;

  public uReferrer: URLd;

  public referrer: string;

  public usableReferrer: string;

  public startDate: Date;

  public fileName: string;

  public description?: string;

  public title?: string;

  public batch: number;

  public idx: number;

  public error: string;

  public postData: any;

  public private: boolean;

  public written: number;

  public totalSize: number;

  public serverName: string;

  public browserName: string;

  public mime: string;

  public mask: string;

  public subfolder: string;

  public prerolled: boolean;

  public retries: number;

  constructor(options: BaseItem) {
    Object.assign(this, DEFAULTS);
    this.assign(options);
    if (this.state === RUNNING) {
      this.state = QUEUED;
    }
    this.sessionId = ++sessionId;
    this.renamer = new Renamer(this);
    this.retries = 0;
  }

  assign(options: BaseItem) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;
    const other: any = options;
    for (const prop of SAVEDPROPS) {
      if (prop in options) {
        self[prop] = other[prop];
      }
    }
    this.uURL = new URL(this.url) as URLd;
    this.uReferrer = (this.referrer && new URL(this.referrer)) as URLd;
    this.startDate = new Date(options.startDate || Date.now());
    if (options.paused) {
      this.state = PAUSED;
    }
    if (!this.startDate) {
      this.startDate = new Date(Date.now());
    }
  }

  get finalName() {
    return this.fileName ||
      this.serverName ||
      this.browserName ||
      this.urlName ||
      "index.html";
  }

  get currentName() {
    return this.browserName || this.dest.name || this.finalName;
  }

  get urlName() {
    const path = parsePath(this.uURL);
    if (path.name) {
      return path.name;
    }
    return parsePath(path.path).name;
  }

  get dest() {
    return parsePath(this.renamer.toString());
  }

  toString() {
    return `Download(${this.url})`;
  }

  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;
    const rv: any = {};
    for (const prop of SAVEDPROPS) {
      if (prop in self) {
        rv[prop] = self[prop];
      }
    }
    rv.startDate = +self.startDate;
    return rv;
  }

  toMsg() {
    const rv = this.toJSON();
    rv.sessionId = this.sessionId;
    rv.finalName = this.finalName;
    const {dest} = this;
    rv.destName = dest.name;
    rv.destPath = dest.path;
    rv.destFull = dest.full;
    rv.currentName = this.browserName || rv.destName || rv.finalName;
    rv.currentFull = `${dest.path}/${rv.currentName}`;
    rv.error = this.error;
    rv.ext = this.renamer.p_ext;
    rv.retries = this.retries;
    return rv;
  }
}
