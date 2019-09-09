/**
 * (c) 2017 Rob Wu <rob@robwu.nl> (https://robwu.nl)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
/* eslint-disable max-len,no-magic-numbers */
// License: MPL-2

/**
  * This typescript port was done by Nils Maier based on
  * https://github.com/Rob--W/open-in-browser/blob/83248155b633ed41bc9cdb1205042653e644abd2/extension/content-disposition.js
  * Special thanks goes to Rob doing all the heavy lifting and putting
  * it together in a reuseable, open source'd library.
  */

const R_RFC6266 = /(?:^|;)\s*filename\*\s*=\s*([^";\s][^;\s]*|"(?:[^"\\]|\\"?)+"?)/i;
const R_RFC5987 = /(?:^|;)\s*filename\s*=\s*([^";\s][^;\s]*|"(?:[^"\\]|\\"?)+"?)/i;

function unquoteRFC2616(value: string) {
  if (!value.startsWith("\"")) {
    return value;
  }

  const parts = value.slice(1).split("\\\"");
  // Find the first unescaped " and terminate there.
  for (let i = 0; i < parts.length; ++i) {
    const quotindex = parts[i].indexOf("\"");
    if (quotindex !== -1) {
      parts[i] = parts[i].slice(0, quotindex);
      // Truncate and stop the iteration.
      parts.length = i + 1;
    }
    parts[i] = parts[i].replace(/\\(.)/g, "$1");
  }
  value = parts.join("\"");
  return value;
}

export class CDHeaderParser {
  private needsFixup: boolean;

  // We need to keep this per instance, because of the global flag.
  // Hence we need to reset it after a use.
  private R_MULTI = /(?:^|;)\s*filename\*((?!0\d)\d+)(\*?)\s*=\s*([^";\s][^;\s]*|"(?:[^"\\]|\\"?)+"?)/gi;

  /**
   * Parse a content-disposition header, with relaxed spec tolerance
   *
   * @param {string} header Header to parse
   * @returns {string} Parsed header
   */
  parse(header: string) {
    this.needsFixup = true;

    // filename*=ext-value ("ext-value" from RFC 5987, referenced by RFC 6266).
    {
      const match = R_RFC6266.exec(header);
      if (match) {
        const [, tmp] = match;
        let filename = unquoteRFC2616(tmp);
        filename = unescape(filename);
        filename = this.decodeRFC5897(filename);
        filename = this.decodeRFC2047(filename);
        return this.maybeFixupEncoding(filename);
      }
    }

    // Continuations (RFC 2231 section 3, referenced by RFC 5987 section 3.1).
    // filename*n*=part
    // filename*n=part
    {
      const tmp = this.getParamRFC2231(header);
      if (tmp) {
        // RFC 2047, section
        const filename = this.decodeRFC2047(tmp);
        return this.maybeFixupEncoding(filename);
      }
    }

    // filename=value (RFC 5987, section 4.1).
    {
      const match = R_RFC5987.exec(header);
      if (match) {
        const [, tmp] = match;
        let filename = unquoteRFC2616(tmp);
        filename = this.decodeRFC2047(filename);
        return this.maybeFixupEncoding(filename);
      }
    }
    return "";
  }

  private maybeDecode(encoding: string, value: string) {
    if (!encoding) {
      return value;
    }
    const bytes = Array.from(value, c => c.charCodeAt(0));
    if (!bytes.every(code => code <= 0xff)) {
      return value;
    }
    try {
      value = new TextDecoder(encoding, {fatal: true}).
        decode(new Uint8Array(bytes));
      this.needsFixup = false;
    }
    catch {
      // TextDecoder constructor threw - unrecognized encoding.
    }
    return value;
  }

  private maybeFixupEncoding(value: string) {
    if (!this.needsFixup && /[\x80-\xff]/.test(value)) {
      return value;
    }

    // Maybe multi-byte UTF-8.
    value = this.maybeDecode("utf-8", value);
    if (!this.needsFixup) {
      return value;
    }

    // Try iso-8859-1 encoding.
    return this.maybeDecode("iso-8859-1", value);
  }

  private getParamRFC2231(value: string) {
    const matches: string[][] = [];

    // Iterate over all filename*n= and filename*n*= with n being an integer
    // of at least zero. Any non-zero number must not start with '0'.
    let match;
    this.R_MULTI.lastIndex = 0;
    while ((match = this.R_MULTI.exec(value)) !== null) {
      const [, num, quot, part] = match;
      const n = parseInt(num, 10);
      if (n in matches) {
        // Ignore anything after the invalid second filename*0.
        if (n === 0) {
          break;
        }
        continue;
      }
      matches[n] = [quot, part];
    }

    const parts: string[] = [];
    for (let n = 0; n < matches.length; ++n) {
      if (!(n in matches)) {
        // Numbers must be consecutive. Truncate when there is a hole.
        break;
      }
      const [quot, rawPart] = matches[n];
      let part = unquoteRFC2616(rawPart);
      if (quot) {
        part = unescape(part);
        if (n === 0) {
          part = this.decodeRFC5897(part);
        }
      }
      parts.push(part);
    }
    return parts.join("");
  }

  private decodeRFC2047(value: string) {
    // RFC 2047-decode the result. Firefox tried to drop support for it, but
    // backed out because some servers use it - https://bugzil.la/875615
    // Firefox's condition for decoding is here:

    // eslint-disable-next-line max-len
    // https://searchfox.org/mozilla-central/rev/4a590a5a15e35d88a3b23dd6ac3c471cf85b04a8/netwerk/mime/nsMIMEHeaderParamImpl.cpp#742-748

    // We are more strict and only recognize RFC 2047-encoding if the value
    // starts with "=?", since then it is likely that the full value is
    // RFC 2047-encoded.

    // Firefox also decodes words even where RFC 2047 section 5 states:
    // "An 'encoded-word' MUST NOT appear within a 'quoted-string'."

    // eslint-disable-next-line no-control-regex
    if (!value.startsWith("=?") || /[\x00-\x19\x80-\xff]/.test(value)) {
      return value;
    }
    // RFC 2047, section 2.4
    // encoded-word = "=?" charset "?" encoding "?" encoded-text "?="
    // charset = token (but let's restrict to characters that denote a
    //           possibly valid encoding).
    // encoding = q or b
    // encoded-text = any printable ASCII character other than ? or space.
    //                ... but Firefox permits ? and space.
    return value.replace(
      /=\?([\w-]*)\?([QqBb])\?((?:[^?]|\?(?!=))*)\?=/g,
      (_, charset, encoding, text) => {
        if (encoding === "q" || encoding === "Q") {
          // RFC 2047 section 4.2.
          text = text.replace(/_/g, " ");
          text = text.replace(/=([0-9a-fA-F]{2})/g,
            (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
          return this.maybeDecode(charset, text);
        }

        // else encoding is b or B - base64 (RFC 2047 section 4.1)
        try {
          text = atob(text);
        }
        catch {
          // ignored
        }
        return this.maybeDecode(charset, text);
      });
  }

  private decodeRFC5897(extValue: string) {
    // Decodes "ext-value" from RFC 5987.
    const extEnd = extValue.indexOf("'");
    if (extEnd < 0) {
      // Some servers send "filename*=" without encoding'language' prefix,
      // e.g. in https://github.com/Rob--W/open-in-browser/issues/26
      // Let's accept the value like Firefox (57) (Chrome 62 rejects it).
      return extValue;
    }
    const encoding = extValue.slice(0, extEnd);
    const langvalue = extValue.slice(extEnd + 1);
    // Ignore language (RFC 5987 section 3.2.1, and RFC 6266 section 4.1 ).
    return this.maybeDecode(encoding, langvalue.replace(/^[^']*'/, ""));
  }
}
