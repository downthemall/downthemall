/* eslint-disable no-magic-numbers */
"use strict";
// License: MIT

import { PrefWatcher } from "../lib/prefs";
import { theme } from "../lib/browser";
import { memoize } from "../lib/memoize";

const resolveColor = memoize(function(color) {
  try {
    const el = document.createElement("div");
    el.style.backgroundColor = color;
    el.style.display = "none";
    document.body.appendChild(el);
    try {
      const resolved = window.getComputedStyle(el, null).backgroundColor;
      return resolved;
    }
    finally {
      document.body.removeChild(el);
    }
  }
  catch {
    return undefined;
  }
}, 10, 1);

export const THEME = new class Theme extends PrefWatcher {
  public systemDark: boolean;

  public themeDark?: boolean;

  constructor() {
    super("theme", "default");
    if (theme && theme.onUpdated) {
      theme.onUpdated.addListener(this.onThemeUpdated.bind(this));
      theme.getCurrent().then((theme: any) => this.onThemeUpdated({theme}));
    }
    this.themeDark = undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemDark = query.matches;
    query.addListener(e => {
      this.systemDark = e.matches;
      this.recalculate();
    });
    this.recalculate();
  }

  get dark() {
    if (this.value === "dark") {
      return true;
    }
    if (this.value === "light") {
      return false;
    }
    if (typeof this.themeDark === "undefined") {
      return this.systemDark;
    }
    return this.themeDark;
  }

  changed(prefs: any, key: string, value: any) {
    const rv = super.changed(prefs, key, value);
    this.recalculate();
    return rv;
  }

  onThemeUpdated({theme}: {theme: any}) {
    try {
      if (!theme) {
        this.themeDark = undefined;
        return;
      }
      const {colors} = theme;
      if (!colors) {
        this.themeDark = undefined;
        return;
      }
      const color = resolveColor(
        colors.toolbar || colors.popup || colors.ntp_background);
      if (!color) {
        this.themeDark = undefined;
        return;
      }
      const pieces = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
      if (!pieces) {
        this.themeDark = undefined;
        return;
      }

      const r = parseInt(pieces[1], 10);
      const g = parseInt(pieces[2], 10);
      const b = parseInt(pieces[3], 10);
      // HSP (Highly Sensitive Poo) equation from
      // http://alienryderflex.com/hsp.html
      const hsp = Math.sqrt(
        0.299 * (r * r) +
      0.587 * (g * g) +
      0.114 * (b * b)
      );

      this.themeDark = hsp < 128;
    }
    finally {
      this.recalculate();
    }
  }

  recalculate() {
    document.documentElement.classList[this.dark ? "add" : "remove"]("dark");
  }
}();
