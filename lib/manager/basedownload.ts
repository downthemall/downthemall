"use strict";
// License: MIT

// eslint-disable-next-line no-unused-vars
import { parsePath, URLd } from "../util";
import { QUEUED, RUNNING, PAUSED } from "./state";
import Renamer from "./renamer";

const SAVEDPROPS = [
  "state",
  "url",
  "usable",
  "referrer",
  "usableReferrer",
  "fileName",
  "mask",
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
  // other options
  "private",
  "fromMetalink",
  "cleanRequest",
  // db
  "manId",
  "dbId",
  "position",
];

const DEFAULTS = {
  state: QUEUED,
  error: "",
  serverName: "",
  fileName: "",
  totalSize: 0,
  written: 0,
  manId: 0,
};

let sessionId = 0;


export class BaseDownload {
  public state: number;

  public sessionId: number;

  public renamer: Renamer;

  public uURL: URLd;

  public url: string;

  public uReferrer: URLd;

  public referrer: string;

  public startDate: Date;

  public fileName: string;

  public error: string;

  public postData: any;

  public private: boolean;

  public written: number;

  public totalSize: number;

  public serverName: string;

  public mask: string;


  constructor(options: any) {
    Object.assign(this, DEFAULTS);
    this.assign(options);
    if (this.state === RUNNING) {
      this.state = QUEUED;
    }
    this.sessionId = ++sessionId;
    this.renamer = new Renamer(this);
  }

  assign(options: any) {
    const self: any = this;
    for (const prop of SAVEDPROPS) {
      if (prop in options) {
        self[prop] = options[prop];
      }
    }
    this.uURL = <URLd> new URL(this.url);
    this.uReferrer = <URLd> (this.referrer && new URL(this.referrer));
    this.startDate = new Date(options.startDate || Date.now());
    if (options.paused) {
      this.state = PAUSED;
    }
    if (!this.startDate) {
      this.startDate = new Date(Date.now());
    }
  }

  get finalName() {
    return this.serverName || this.fileName || this.urlName || "index.html";
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
    rv.error = this.error;
    return rv;
  }
}
