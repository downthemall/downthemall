"use strict";
// License: MIT

import { localize } from "../lib/i18n";
import { runtime } from "../lib/browser";

const $ = document.querySelector.bind(document);


addEventListener("DOMContentLoaded", () => {
  localize(document.documentElement);

  $("#regular"). addEventListener("click", () => {
    runtime.sendMessage("do-regular");
    close();
  });

  $("#turbo"). addEventListener("click", () => {
    runtime.sendMessage("do-turbo");
    close();
  });

  $("#single"). addEventListener("click", () => {
    runtime.sendMessage("do-single");
    close();
  });

  $("#manager"). addEventListener("click", () => {
    runtime.sendMessage("open-manager");
    close();
  });

  $("#prefs"). addEventListener("click", () => {
    runtime.sendMessage("open-prefs");
    close();
  });
});
