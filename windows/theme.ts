"use strict";
// License: MIT

import { PrefWatcher } from "../lib/prefs";

export const THEME = new class Theme extends PrefWatcher {
  public systemDark: boolean;

  public themeDark?: boolean;

  constructor() {
    super("theme", "default");
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
    console.warn("theme", this.value);
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

  recalculate() {
    console.warn("darkness", this.dark);
    document.documentElement.classList[this.dark ? "add" : "remove"]("dark");
  }
}();
