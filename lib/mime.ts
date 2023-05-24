"use strict";
// License: MIT

import mime from "../data/mime.json";

export class MimeInfo {
  public readonly type: string;

  public readonly extensions: Set<string>;

  public readonly major: string;

  public readonly minor: string;

  public readonly primary: string;

  constructor(type: string, extensions: string[]) {
    this.type = type;
    const [major, minor] = type.split("/", 2);
    this.major = major;
    this.minor = minor;
    [this.primary] = extensions;
    this.extensions = new Set(extensions);
    Object.freeze(this);
  }
}

export const MimeDB = new class MimeDB {
  private readonly mimeToExts: Map<string, MimeInfo>;

  private readonly registeredExtensions: Set<string>;

  constructor() {
    const exts = new Map<string, string[]>();
    for (const [prim, more] of Object.entries(mime.e)) {
      let toadd = more;
      if (!Array.isArray(toadd)) {
        toadd = [toadd];
      }
      toadd.unshift(prim);
      exts.set(prim, toadd);
    }
    this.mimeToExts = new Map(Array.from(
      Object.entries(mime.m),
      ([mime, prim]) => [mime, new MimeInfo(mime, exts.get(prim) || [prim])]
    ));
    const all = Array.from(
      this.mimeToExts.values(),
      m => Array.from(m.extensions, e => e.toLowerCase()));
    this.registeredExtensions = new Set(all.flat());
  }

  getPrimary(mime: string) {
    const info = this.mimeToExts.get(mime.trim().toLocaleLowerCase("en-US"));
    return info ? info.primary : "";
  }

  getMime(mime: string) {
    return this.mimeToExts.get(mime.trim().toLocaleLowerCase("en-US"));
  }

  hasExtension(ext: string) {
    return this.registeredExtensions.has(ext.toLowerCase());
  }
}();
