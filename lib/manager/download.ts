"use strict";
// License: MIT

import MimeType from "whatwg-mimetype";
import { debounce } from "../../uikit/lib/util";
import { CHROME, downloads, webRequest } from "../browser";
import { Prefs } from "../prefs";
import { PromiseSerializer } from "../pserializer";
import { filterInSitu, parsePath, sanitizePath } from "../util";
import { BaseDownload } from "./basedownload";
// eslint-disable-next-line no-unused-vars
import { Manager } from "./man";
import Renamer from "./renamer";
import {
  CANCELABLE,
  CANCELED,
  DONE,
  FORCABLE,
  MISSING,
  PAUSABLE,
  PAUSED,
  QUEUED,
  RUNNING
} from "./state";

const PREROLL_HEURISTICS = /dl|attach|download|name|file|get|retr|^n$|\.(php|asp|py|pl|action|htm|shtm)/i;
const PREROLL_TIMEOUT = 10000;
const SHELF_TIMEOUT = 2000;


const setShelfEnabled = downloads.setShelfEnabled || function() {
  // ignored
};

function parseDisposition(disp: MimeType) {
  if (!disp) {
    return "";
  }
  let encoding = (disp.parameters.get("charset") || "utf-8").trim();
  let file = (disp.parameters.get("filename") || "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!file) {
    const encoded = disp.parameters.get("filename*");
    if (!encoded) {
      return "";
    }
    const pieces = encoded.split("'", 3);
    if (pieces.length !== 3) {
      return "";
    }
    encoding = pieces[0].trim() || encoding;
    file = (pieces[3] || "").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  file = file.trim();
  if (!file) {
    return "";
  }

  try {
    // And now for the tricky part...
    // First unescape the string, to get the raw bytes
    // not utf-8-interpreted bytes
    // Then convert the string into an uint8[]
    // Then decode
    return new TextDecoder(encoding).decode(
      new Uint8Array(unescape(file).split("").map(e => e.charCodeAt(0)))
    );
  }
  catch (ex) {
    console.error("Cannot decode", encoding, file, ex);
  }
  return "";
}

const reenableShelf = debounce(() => setShelfEnabled(true), SHELF_TIMEOUT, true);

type Header = {name: string; value: string};
interface Options {
  conflictAction: string;
  filename: string;
  saveAs: boolean;
  url: string;
  method?: string;
  body?: string;
  incognito?: boolean;
  headers: Header[];
}

export class Download extends BaseDownload {
  public manager: Manager;

  public manId: number;

  public removed: boolean;

  public position: number;

  public error: string;

  constructor(manager: Manager, options: any) {
    super(options);
    this.manager = manager;
    this.start = PromiseSerializer.wrapNew(1, this, this.start);
    this.removed = false;
    this.position = -1;
  }

  markDirty() {
    this.renamer = new Renamer(this);
    this.manager.setDirty(this);
  }

  changeState(newState: number) {
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }
    this.state = newState;
    this.error = "";
    this.manager.changedState(this, oldState, this.state);
    this.markDirty();
  }

  async start() {
    if (this.state !== QUEUED) {
      throw new Error("invalid state");
    }
    if (this.manId) {
      const {manId: id} = this;
      try {
        const state = await downloads.search({id});
        if (state[0].state === "in_progress") {
          this.changeState(RUNNING);
          this.updateStateFromBrowser();
          return;
        }
        if (state[0].state == "complete") {
          this.changeState(DONE);
          this.updateStateFromBrowser();
          return;
        }
        if (!state[0].canResume) {
          throw new Error("Cannot resume");
        }
        // Cannot await here
        // Firefox bug: will not return until download is finished
        downloads.resume(id).catch(() => {});
        this.changeState(RUNNING);
        return;
      }
      catch (ex) {
        this.manager.removeManId(this.manId);
        this.removeFromBrowser();
      }
    }
    if (this.state !== QUEUED) {
      throw new Error("invalid state");
    }
    console.log("starting", this.toString(), this.toMsg());
    this.changeState(RUNNING);

    // Do NOT await
    this.reallyStart();
  }

  private async reallyStart() {
    try {
      if (!this.prerolled) {
        await this.maybePreroll();
        if (this.state !== RUNNING) {
          // Aborted by preroll
          return;
        }
      }
      const options: Options = {
        conflictAction: await Prefs.get("conflict-action"),
        filename: this.dest.full,
        saveAs: false,
        url: this.url,
        headers: [],
      };
      if (!CHROME && this.private) {
        options.incognito = true;
      }
      if (this.postData) {
        options.body = this.postData;
        options.method = "POST";
      }
      if (!CHROME && this.referrer) {
        options.headers.push({
          name: "Referer",
          value: this.referrer
        });
      }
      if (this.manId) {
        this.manager.removeManId(this.manId);
      }

      setShelfEnabled(false);
      try {
        try {
          this.manager.addManId(
            this.manId = await downloads.download(options), this);
        }
        catch (ex) {
          if (!this.referrer) {
            throw ex;
          }
          // Re-attempt without referrer
          filterInSitu(options.headers, h => h.name !== "Referer");
          this.manager.addManId(
            this.manId = await downloads.download(options), this);
        }
      }
      finally {
        reenableShelf();
      }
      this.markDirty();
    }
    catch (ex) {
      console.error("failed to start download", ex.toString(), ex);
      this.changeState(CANCELED);
      this.error = ex.toString();
    }
  }

  private get shouldPreroll() {
    const {pathname, search} = this.uURL;
    if (!this.renamer.p_ext) {
      return true;
    }
    if (this.uURL.pathname.endsWith("/")) {
      return true;
    }
    if (PREROLL_HEURISTICS.test(pathname)) {
      return true;
    }
    if (search.length) {
      return true;
    }
    return false;
  }

  private async maybePreroll() {
    try {
      if (this.prerolled) {
        // Check again, just in case, async and all
        return;
      }
      if (!this.shouldPreroll) {
        return;
      }
      await (CHROME ? this.prerollChrome() : this.prerollFirefox());
    }
    catch (ex) {
      console.error("Failed to preroll", this, ex.toString(), ex.stack, ex);
    }
    finally {
      if (this.state === RUNNING) {
        this.prerolled = true;
        this.markDirty();
      }
    }
  }

  private async prerollFirefox() {
    const controller = new AbortController();
    const {signal} = controller;
    const res = await fetch(this.uURL.toString(), {
      method: "HEAD",
      mode: "same-origin",
      signal,
    });
    controller.abort();
    const {headers} = res;
    this.prerollFinialize(headers, res);
  }

  async prerollChrome() {
    let rid = "";
    const rurl = this.uURL.toString();
    let listener: any;
    const wr = new Promise<any[]>(resolve => {
      listener = (details: any) => {
        const {url, requestId, statusCode} = details;
        if (rid !== requestId && url !== rurl) {
          return;
        }
        // eslint-disable-next-line no-magic-numbers
        if (statusCode >= 300 && statusCode < 400) {
          // Redirect, continue tracking;
          rid = requestId;
          return;
        }
        resolve(details.responseHeaders);
      };
      webRequest.onHeadersReceived.addListener(
        listener, {urls: ["<all_urls>"]}, ["responseHeaders"]);
    });
    const p = Promise.race([
      wr,
      new Promise<any[]>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), PREROLL_TIMEOUT))
    ]);

    p.finally(() => {
      webRequest.onHeadersReceived.removeListener(listener);
    });
    const controller = new AbortController();
    const {signal} = controller;
    const res = await fetch(rurl, {
      method: "HEAD",
      signal,
    });
    controller.abort();
    const headers = await p;
    this.prerollFinialize(
      new Headers(headers.map(i => [i.name, i.value])), res);
  }


  private prerollFinialize(headers: Headers, res: Response) {
    const type = MimeType.parse(headers.get("content-type") || "");
    const dispHeader = headers.get("content-disposition");
    let file = "";
    if (dispHeader) {
      const disp = new MimeType(`${type && type.toString() || "application/octet-stream"}; ${dispHeader}`);
      file = parseDisposition(disp);
      // Sanitize
      file = sanitizePath(file.replace(/[/\\]+/g, "-"));
    }
    if (type) {
      this.mime = type.essence;
    }
    this.serverName = file;
    this.markDirty();
    const {status} = res;
    /* eslint-disable no-magic-numbers */
    if (status === 404) {
      this.cancel();
      this.error = "SERVER_BAD_CONTENT";
    }
    else if (status === 403) {
      this.cancel();
      this.error = "SERVER_FORBIDDEN";
    }
    else if (status === 402 || status === 407) {
      this.cancel();
      this.error = "SERVER_UNAUTHORIZED";
    }
    else if (status >= 400) {
      this.cancel();
      this.error = "SERVER_FAILED";
    }
    /* eslint-enable no-magic-numbers */
  }

  resume(forced = false) {
    if (!(FORCABLE & this.state)) {
      return;
    }
    if (this.state !== QUEUED) {
      this.changeState(QUEUED);
    }
    if (forced) {
      this.manager.startDownload(this);
    }
  }

  async pause() {
    if (!(PAUSABLE & this.state)) {
      return;
    }
    if (this.state === RUNNING && this.manId) {
      try {
        await downloads.pause(this.manId);
      }
      catch (ex) {
        console.error("pause", ex.toString(), ex);
        return;
      }
    }
    this.changeState(PAUSED);
  }

  reset() {
    this.prerolled = false;
    this.manId = 0;
    this.written = this.totalSize = 0;
    this.mime = this.serverName = this.browserName = "";
  }

  async removeFromBrowser() {
    const {manId: id} = this;
    try {
      await downloads.cancel(id);
    }
    catch (ex) {
      // ingored
    }
    await new Promise(r => setTimeout(r, 1000));
    try {
      await downloads.erase({id});
    }
    catch (ex) {
      console.error(id, ex.toString(), ex);
      // ingored
    }
  }

  cancel() {
    if (!(CANCELABLE & this.state)) {
      return;
    }
    if (this.manId) {
      this.manager.removeManId(this.manId);
      this.removeFromBrowser();
    }
    this.reset();
    this.changeState(CANCELED);
  }

  setMissing() {
    if (this.manId) {
      this.manager.removeManId(this.manId);
      this.removeFromBrowser();
    }
    this.reset();
    this.changeState(MISSING);
  }

  async maybeMissing() {
    if (!this.manId) {
      return null;
    }
    const {manId: id} = this;
    try {
      const dls = await downloads.search({id});
      if (!dls.length) {
        this.setMissing();
        return this;
      }
    }
    catch (ex) {
      console.error("oops", id, ex.toString(), ex);
      this.setMissing();
      return this;
    }
    return null;
  }

  adoptSize(state: any) {
    const {
      bytesReceived,
      totalBytes,
      fileSize
    } = state;
    this.written = Math.max(0, bytesReceived);
    this.totalSize = Math.max(0, fileSize >= 0 ? fileSize : totalBytes);
  }

  async updateStateFromBrowser() {
    try {
      const state = (await downloads.search({id: this.manId})).pop();
      const {filename, error} = state;
      const path = parsePath(filename);
      this.browserName = path.name;
      this.adoptSize(state);
      if (!this.mime && state.mime) {
        this.mime = state.mime;
      }
      this.markDirty();
      switch (state.state) {
      case "in_progress":
        if (error) {
          this.cancel();
          this.error = error;
        }
        else {
          this.changeState(RUNNING);
        }
        break;

      case "interrupted":
        if (state.paused) {
          this.changeState(PAUSED);
        }
        else {
          this.cancel();
          this.error = error || "";
        }
        break;

      case "complete":
        this.changeState(DONE);
        break;
      }
    }
    catch (ex) {
      console.error("failed to handle state", ex.toString(), ex.stack, ex);
      this.setMissing();
    }
  }
}
