"use strict";
// License: MIT

import { localize } from "../lib/i18n";
import { runtime } from "../lib/browser";

addEventListener("DOMContentLoaded", () => {
  localize(document.documentElement);

  document.body.addEventListener("click", e => {
    let target = e.target as HTMLElement;
    if (!target) {
      return;
    }
    while (target) {
      const {action} = target.dataset;
      if (!action) {
        target = target.parentElement as HTMLElement;
        continue;
      }
      runtime.sendMessage(action);
      close();
      return;
    }
  });
});
