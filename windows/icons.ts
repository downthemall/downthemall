"use strict";
// License: MIT

export class Icons extends Map {
  private readonly sheet: CSSStyleSheet;

  private running: number;

  constructor(el: HTMLStyleElement) {
    super();
    this.sheet = el.sheet as CSSStyleSheet;
    this.running = 0;
  }

  // eslint-disable-next-line no-magic-numbers
  "get"(url: string) {
    if (url.startsWith("icon-")) {
      return url;
    }
    let cls = super.get(url);
    if (!cls) {
      cls = `iconcache-${++this.running}`;
      const rule = `.${cls} { background-image: url(${url}); }`;
      this.sheet.insertRule(rule);
      super.set(url, cls);
    }
    return cls;
  }
}
