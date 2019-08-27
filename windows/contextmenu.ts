"use strict";
// License: MIT

export * from "../uikit/lib/contextmenu";
import { Keys } from "../uikit/lib/contextmenu";
import { IS_MAC } from "../uikit/lib/util";
import { locale, _ } from "../lib/i18n";

locale.then(() => {
  Keys.clear();
  [
    ["ACCEL", IS_MAC ? "⌘" : _("key-ctrl")],
    ["CTRL", _("key-ctrl")],
    ["ALT", IS_MAC ? "⌥" : _("key-alt")],
    ["DELETE", _("key-delete")],
    ["PAGEUP", _("key-pageup")],
    ["PAGEDOWN", _("key-pagedown")],
    ["HOME", _("key-home")],
    ["END", _("key-end")],
    ["SHIFT", "⇧"],
  ].forEach(([k, v]) => Keys.set(k, v));
});
