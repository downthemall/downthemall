"use strict";
// License: MIT

import ModalDialog from "../../uikit/lib/modal";
import { _, localize } from "../../lib/i18n";
import { Prefs } from "../../lib/prefs";
import { Keys } from "../keys";
import { $ } from "../winutil";

export class RemovalModalDialog extends ModalDialog {
  private readonly text: string;

  private readonly pref: string;

  private check: HTMLInputElement | null;

  constructor(text: string, pref: string) {
    super();
    this.text = text;
    this.pref = `confirmations.${pref}`;
    this.check = null;
  }

  async getContent() {
    const content = $<HTMLTemplateElement>("#removal-template").
      content.cloneNode(true) as DocumentFragment;
    await localize(content);
    this.check = content.querySelector(".removal-remember");
    $(".removal-text", content).textContent = this.text;
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

export class DeleteFilesDialog extends ModalDialog {
  private readonly paths: string[];

  constructor(paths: string[]) {
    super();
    this.paths = paths;
  }

  async getContent() {
    const content = $<HTMLTemplateElement>("#deletefiles-template").
      content.cloneNode(true) as DocumentFragment;
    await localize(content);
    const list = $(".deletefiles-list", content);
    for (const path of this.paths) {
      const li = document.createElement("li");
      li.textContent = path;
      list.appendChild(li);
    }
    return content;
  }

  get buttons() {
    return [
      {
        title: _("deletefiles_button"),
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
    Keys.suppressed = true;
    try {
      return await super.show();
    }
    finally {
      Keys.suppressed = false;
    }
  }

  shown() {
    this.focusDefault();
  }
}

