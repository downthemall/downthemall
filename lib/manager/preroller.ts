"use strict";
// License: MIT

import MimeType from "whatwg-mimetype";
// eslint-disable-next-line no-unused-vars
import { Download } from "./download";
import { CHROME, webRequest } from "../browser";
import { CDHeaderParser } from "../cdheaderparser";
import { sanitizePath } from "../util";

const PREROLL_HEURISTICS = /dl|attach|download|name|file|get|retr|^n$|\.(php|asp|py|pl|action|htm|shtm)/i;
const PREROLL_HOSTS = /4cdn|chan/;
const PREROLL_TIMEOUT = 10000;
const PREROLL_NOPE = new Set<string>();
const CDPARSER = new CDHeaderParser();

export interface PrerollResults {
  error?: string;
  name?: string;
  mime?: string;
  finalURL?: string;
}

export class Preroller {
  private readonly download: Download

  constructor(download: Download) {
    this.download = download;
  }

  get shouldPreroll() {
    const {uURL, renamer} = this.download;
    const {pathname, search, host} = uURL;
    if (PREROLL_NOPE.has(host)) {
      return false;
    }
    if (!renamer.p_ext) {
      return true;
    }
    if (search.length) {
      return true;
    }
    if (uURL.pathname.endsWith("/")) {
      return true;
    }
    if (PREROLL_HEURISTICS.test(pathname)) {
      return true;
    }
    if (PREROLL_HOSTS.test(host)) {
      return true;
    }
    return false;
  }

  async roll() {
    try {
      return await (CHROME ? this.prerollChrome() : this.prerollFirefox());
    }
    catch (ex) {
      console.error("Failed to preroll", this, ex.toString(), ex.stack, ex);
    }
    return null;
  }

  private async prerollFirefox() {
    const controller = new AbortController();
    const {signal} = controller;
    const {uURL} = this.download;
    const res = await fetch(uURL.toString(), {
      method: "GET",
      headers: new Headers({
        Range: "bytes=0-1",
      }),
      mode: "same-origin",
      signal,
    });
    if (res.body) {
      res.body.cancel();
    }
    controller.abort();
    const {headers} = res;
    return this.finalize(headers, res);
  }

  private async prerollChrome() {
    let rid = "";
    const {uURL} = this.download;
    const rurl = uURL.toString();
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
      method: "GET",
      headers: new Headers({
        Range: "bytes=0-1",
      }),
      signal,
    });
    if (res.body) {
      res.body.cancel();
    }
    controller.abort();
    const headers = await p;
    return this.finalize(
      new Headers(headers.map(i => [i.name, i.value])), res);
  }

  private finalize(headers: Headers, res: Response): PrerollResults {
    const rv: PrerollResults = {};

    const type = MimeType.parse(headers.get("content-type") || "");
    if (type) {
      rv.mime = type.essence;
    }

    const dispHeader = headers.get("content-disposition");
    if (dispHeader) {
      const file = CDPARSER.parse(dispHeader);
      // Sanitize
      rv.name = sanitizePath(file.replace(/[/\\]+/g, "-"));
    }

    rv.finalURL = res.url;

    /* eslint-disable no-magic-numbers */
    const {status} = res;
    if (status === 404) {
      rv.error = "SERVER_BAD_CONTENT";
    }
    else if (status === 403) {
      rv.error = "SERVER_FORBIDDEN";
    }
    else if (status === 402 || status === 407) {
      rv.error = "SERVER_UNAUTHORIZED";
    }
    else if (status === 400 || status === 405 || status === 416) {
      PREROLL_NOPE.add(this.download.uURL.host);
      if (PREROLL_NOPE.size > 1000) {
        PREROLL_NOPE.delete(PREROLL_NOPE.keys().next().value);
      }
    }
    else if (status > 400 && status < 500) {
      rv.error = "SERVER_FAILED";
    }
    /* eslint-enable no-magic-numbers */

    return rv;
  }
}
