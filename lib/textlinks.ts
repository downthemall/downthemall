"use strict";
// License: MIT

import { textlinks as rtextlinks } from "../data/xregexps.json";

const SCHEME_DEFAULT = "https";

// Link matcher
const regLinks = new RegExp(rtextlinks.source, rtextlinks.flags);
// Match more exactly or more than 3 dots.
// Links are then assumed "cropped" and will be ignored.
const regShortened = /\.{3,}/;
// http cleanup
const regHttp = /^h(?:x+|tt)?p(s?)/i;
// ftp cleanup
const regFtp = /^f(?:x+|t)p/i;
// www (sans protocol) match
const regWWW = /^www/i;
// Right-trim (sanitize) link
const regDTrim = /[<>._-]+$|#.*?$/g;

function mapper(e: string) {
  try {
    if (regShortened.test(e)) {
      return null;
    }
    if (regWWW.test(e)) {
      if (e.indexOf("/") < 0) {
        e = `${SCHEME_DEFAULT}://${e}/`;
      }
      else {
        e = `${SCHEME_DEFAULT}://${e}`;
      }
    }
    return e.replace(regHttp, "http$1").
      replace(regFtp, "ftp").
      replace(regDTrim, "");
  }
  catch (ex) {
    return null;
  }
}

/**
 * Minimal Link representation (partially) implementing DOMElement
 *
 * @param {string} url URL (href) of the Links
 * @param {string} title Optional. Title/description
 * @see DOMElement
 */
export class FakeLink {
  public readonly src: string;

  public readonly href: string;

  public readonly title: string;

  public readonly fake: boolean;

  public childNodes: readonly Node[];

  constructor (url: string, title?: string) {
    this.src = this.href = url;
    if (title) {
      this.title = title;
    }
    this.fake = true;
    Object.freeze(this);
  }

  hasAttribute(attr: string) {
    return (attr in this);
  }

  getAttribute(attr: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;
    return (attr in self) ? self[attr] : null;
  }

  toString() {
    return this.href;
  }
}

FakeLink.prototype.childNodes = Object.freeze([]);

/**
 * Parses a text looking for any URLs with supported protocols
 *
 * @param {string} text Text to parse
 * @param {boolean} [fakeLinks]
 *   Whether an array of plain text links will be returned or
 *   an array of FakeLinks.
 * @returns {string[]} results
 */
export function getTextLinks(text: string, fakeLinks = false) {
  const rv: any = text.match(regLinks);
  if (!rv) {
    return [];
  }
  let i; let k; let e;
  for (i = 0, k = 0, e = rv.length; i < e; i++) {
    const a = mapper(rv[i]);
    if (a) {
      rv[k] = fakeLinks ? new FakeLink(a) : a;
      k += 1;
    }
  }
  rv.length = k; // truncate
  return rv;
}
