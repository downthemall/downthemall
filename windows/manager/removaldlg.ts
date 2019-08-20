"use strict";
// License: MIT

import ModalDialog from "../../uikit/lib/modal";
import { _, localize } from "../../lib/i18n";
import { Prefs } from "../../lib/prefs";
import { Keys } from "../keys";

const $ = document.querySelector.bind(document);

export default class RemovalModalDialog extends ModalDialog {
  private readonly text: string;

  private readonly pref: string;

  private check: HTMLInputElement | null;

  constructor(text: string, pref: string) {
    super();
    this.text = text;
    this.pref = `confirmations.${pref}`;
    this.check = null;
  }

  get content() {
    const content = $("#removal-template").content.cloneNode(true);
    localize(content);
    this.check = content.querySelector(".removal-remember");
    content.querySelector(".removal-text").textContent = this.text;
    return content;
  }

  get buttons() {
    return [
      {
        title: _("remove-downloads"),
        value: "ok",
        default: true,
        dismiss: false,
      },
      {
        title: _("cancel"),
        value: "cancel",
        default: false,
        dismiss: true,
      }
    ];
  }

  async show() {
    if (await Prefs.get(this.pref)) {
      return "ok";
    }
    Keys.suppressed = true;
    try {
      const res = await super.show();
      if (this.check && this.check.checked) {
        await Prefs.set(this.pref, true);
      }
      return res;
    }
    finally {
      Keys.suppressed = false;
    }
  }

  shown() {
    this.focusDefault();
  }
}
