"use strict";
// License: MIT

import {
  ALL_LANGS,
  _,
  getCurrentLanguage,
  localize,
  saveCustomLocale,
} from "../lib/i18n";
import { Prefs, PrefWatcher } from "../lib/prefs";
import { hostToDomain } from "../lib/util";
import { filters } from "../lib/filters";
import {Limits} from "../lib/manager/limits";
// eslint-disable-next-line no-unused-vars
import ModalDialog, { ModalButton } from "../uikit/lib/modal";
import { TYPE_LINK, TYPE_MEDIA } from "../lib/constants";
import { iconForPath, visible } from "../lib/windowutils";
import { VirtualTable } from "../uikit/lib/table";
import { Icons } from "./icons";
import { $ } from "./winutil";
import { runtime, storage, OPERA } from "../lib/browser";
import "./theme";

const ICON_BASE_SIZE = 16;


class UIPref<T extends HTMLElement> extends PrefWatcher {
  id: string;

  pref: string;

  elem: T;

  constructor(id: string, pref: string) {
    super(pref);
    this.id = id;
    this.pref = pref;
    this.elem = $(`#${id}`);
    if (!this.elem) {
      throw new Error(`Invalid id: ${id}`);
    }
  }

  async save(value: any) {
    await Prefs.set(this.pref, value);
  }
}

class BoolPref extends UIPref<HTMLInputElement> {
  constructor(id: string, pref: string) {
    super(id, pref);
    this.elem.addEventListener("change", this.change.bind(this));
  }

  change() {
    this.save(!!this.elem.checked);
  }

  changed(prefs: any, key: string, value: any) {
    this.elem.checked = !!value;
    return super.changed(prefs, key, value);
  }
}

class IntPref extends UIPref<HTMLInputElement> {
  constructor(id: string, pref: string) {
    super(id, pref);
    this.elem.addEventListener("change", this.change.bind(this));
  }

  change() {
    if (!this.elem.checkValidity()) {
      return;
    }
    this.save(this.elem.value);
  }

  changed(prefs: any, key: string, value: any) {
    this.elem.value = value;
    return super.changed(prefs, key, value);
  }
}

class OptionPref extends UIPref<HTMLElement> {
  options: HTMLInputElement[];

  constructor(id: string, pref: string) {
    super(id, pref);
    this.options = Array.from(this.elem.querySelectorAll<HTMLInputElement>(`*[name='${id}']`));
    this.options.forEach(o => {
      o.addEventListener("change", () => this.change());
    });
  }

  change() {
    const opt = this.options.find(e => e.checked);
    if (opt && opt.value) {
      this.save(opt.value);
    }
  }

  changed(prefs: any, key: string, value: any) {
    const opt = this.options.find(e => e.value === value);
    if (opt) {
      opt.checked = true;
    }
    return super.changed(prefs, key, value);
  }
}

class CreateFilterDialog extends ModalDialog {
  label: HTMLInputElement;

  expr: HTMLInputElement;

  link: HTMLInputElement;

  media: HTMLInputElement;

  getContent() {
    const rv = $<HTMLTemplateElement>("#create-filter-template").
      content.cloneNode(true) as DocumentFragment;
    this.label = $("#filter-create-label", rv);
    this.expr = $("#filter-create-expr", rv);
    this.link = $("#filter-create-type-link", rv);
    this.media = $("#filter-create-type-media", rv);
    return rv;
  }

  get buttons() {
    return [
      {
        title: _("create-filter"),
        value: "ok",
        default: true
      },
      {
        title: _("cancel"),
        value: "cancel",
        dismiss: true
      }
    ];
  }

  shown() {
    this.label.focus();
  }

  done(b: ModalButton) {
    if (!b || !b.default) {
      return super.done(b);
    }
    const label = this.label.value.trim();
    const expr = this.expr.value.trim();
    let type = 0;
    if (this.link.checked) {
      type |= TYPE_LINK;
    }
    if (this.media.checked) {
      type |= TYPE_MEDIA;
    }

    let valid = true;
    if (!label) {
      valid = false;
      this.label.setCustomValidity(_("cannot-be-empty"));
    }
    else {
      this.label.setCustomValidity("");
    }
    if (!expr) {
      valid = false;
      this.expr.setCustomValidity(_("cannot-be-empty"));
    }
    else {
      this.expr.setCustomValidity("");
    }
    if (!type) {
      valid = false;
      this.link.setCustomValidity(_("filter-at-least-one"));
      this.media.setCustomValidity(_("filter-at-least-one"));
    }
    else {
      this.link.setCustomValidity("");
      this.media.setCustomValidity("");
    }
    if (!valid) {
      return undefined;
    }

    filters().then(async filters => {
      await filters.create(label, expr, type);
    }).catch(console.error);


    return super.done(b);
  }

  async show() {
    await super.show();
  }
}

class FiltersUI extends VirtualTable {
  filters: any[];

  icons: Icons;

  edit: {
    label: HTMLInputElement;
    expr: HTMLInputElement;
    link: HTMLInputElement;
    media: HTMLInputElement;
    filter: any;
    row: number;
  };

  ignoreNext: boolean;

  constructor() {
    super("#filters", null);
    this.filters = [];
    this.icons = new Icons($("#icons"));
    const filter: any = null;
    this.edit = {
      label: $("#filter-edit-label"),
      expr: $("#filter-edit-expr"),
      link: $("#filter-edit-type-link"),
      media: $("#filter-edit-type-media"),
      filter,
      row: filter,
    };
    this.edit.label.addEventListener("input", () => {
      if (!this.edit.filter) {
        return;
      }
      if (!this.edit.label.checkValidity() ||
       this.edit.label.value.length <= 0) {
        return;
      }
      this.edit.filter.label = this.edit.label.value;
      this.ignoreNext = true;
      this.saveFilter(this.edit.filter, this.edit.row);
    }, true);
    this.edit.expr.addEventListener("input", () => {
      if (!this.edit.filter) {
        return;
      }
      if (!this.edit.expr.checkValidity() || this.edit.expr.value.length <= 0) {
        return;
      }
      this.edit.filter.expr = this.edit.expr.value;
      this.ignoreNext = true;
      this.saveFilter(this.edit.filter, this.edit.row);
    }, true);
    const updateTypes = () => {
      if (!this.edit.filter) {
        return;
      }
      const link = this.edit.link.checked ? TYPE_LINK : 0;
      const media = this.edit.media.checked ? TYPE_MEDIA : 0;
      const type = link | media;
      if (!type) {
        return;
      }
      this.edit.filter.type = type;
      this.ignoreNext = true;
      this.saveFilter(this.edit.filter, this.edit.row);
    };
    this.edit.link.addEventListener("change", updateTypes);
    this.edit.media.addEventListener("change", updateTypes);
    this.on("selection-changed", () => {
      this.edit.filter = null;
      if (this.selection.empty) {
        this.resetEdits();
        return;
      }
      this.edit.row = this.selection.first;
      const f = this.edit.filter = this.filters[this.edit.row];
      if (!this.edit.filter) {
        this.resetEdits();
        return;
      }
      $("#filter-edit").classList.remove("hidden");
      this.edit.label.value = f.label;
      this.edit.expr.value = f.expr;
      this.edit.link.checked = !!(f.type & TYPE_LINK);
      this.edit.media.checked = !!(f.type & TYPE_MEDIA);
      if (this.edit.filter.custom) {
        $("#filter-delete").classList.remove("hidden");
        $("#filter-reset").classList.add("hidden");
      }
      else {
        $("#filter-delete").classList.add("hidden");
        $("#filter-reset").classList.remove("hidden");
      }
    });
    $("#filter-delete").addEventListener("click", () => {
      if (!this.edit.filter) {
        return;
      }
      this.edit.filter.delete().
        then(this.reload.bind(this)).
        catch(console.error);
    });
    $("#filter-reset").addEventListener("click", () => {
      if (!this.edit.filter) {
        return;
      }
      this.edit.filter.reset().
        then(this.reload.bind(this)).
        catch(console.error);
    });
    this.reload().catch(console.error);

    $("#filter-create-button").addEventListener("click", () => {
      new CreateFilterDialog().show().catch(console.error);
    });

    filters().then(filters => {
      filters.on("changed", () => {
        this.reload().catch(console.error);
      });
    });
  }

  async reload() {
    if (this.ignoreNext) {
      return;
    }
    this.ignoreNext = false;

    this.resetEdits();
    this.filters = (await filters()).all;
    this.init();
    this.invalidate();
  }

  resetEdits() {
    this.edit.label.value = "";
    this.edit.expr.value = "";
    this.edit.link.checked = false;
    this.edit.media.checked = false;
    $("#filter-delete").classList.add("hidden");
    $("#filter-reset").classList.add("hidden");
    $("#filter-edit").classList.add("hidden");
  }

  async saveFilter(filter: any, row: any) {
    try {
      this.invalidateRow(row);
      await filter.save();
    }
    catch (ex) {
      console.error(ex);
    }
  }

  get rowCount() {
    return this.filters.length;
  }

  getCellIcon(rowid: number, colid: number) {
    if (!colid) {
      const f = this.filters[rowid];
      if (!f) {
        return null;
      }
      const icon = iconForPath(`file${f.icon ? `.${f.icon}` : ""}`, ICON_BASE_SIZE);
      return this.icons.get(icon);
    }
    return null;
  }

  getCellText(rowid: number, colid: number) {
    const f = this.filters[rowid];
    if (!f) {
      return null;
    }
    switch (colid) {
    case 0:
      return f.label;

    case 1:
      return f.expr;

    case 2:
      return [TYPE_LINK, TYPE_MEDIA].
        map(t => f.type & t ? _(`filter-type-${t === TYPE_LINK ? "link" : "media"}`) : 0).
        filter(e => e).
        join(", ");

    default:
      return "";
    }
  }
}

class LimitsUI extends VirtualTable {
  limits: any[];

  edit: {
    limit: any;
    domain: HTMLInputElement;
    conlimited: HTMLInputElement;
    conunlimited: HTMLInputElement;
    conlimit: HTMLInputElement;
    save: HTMLButtonElement;
    delete: HTMLButtonElement;
    row: number;
  };

  constructor() {
    super("#limits", null);
    this.limits = [];
    Limits.on("changed", () => {
      this.limits = Array.from(Limits);
      this.invalidate();
      this.resetEdits();
    });
    Limits.load().then(() => {
      this.limits = Array.from(Limits);
      this.invalidate();
    });

    this.edit = {
      limit: null,
      domain: $("#limit-edit-domain"),
      conlimited: $("#limit-edit-concurrent-limited"),
      conunlimited: $("#limit-edit-concurrent-unlimited"),
      conlimit: $("#limit-edit-concurrent-limit"),
      save: $("#limit-save"),
      delete: $("#limit-delete"),
      row: -1,
    };

    this.on("selection-changed", () => {
      this.edit.limit = null;
      if (this.selection.empty) {
        this.resetEdits();
        return;
      }
      this.edit.row = this.selection.first;
      const l = this.edit.limit = this.limits[this.edit.row];
      if (!l) {
        this.resetEdits();
        return;
      }
      $("#limit-edit").classList.remove("hidden");
      this.edit.domain.value = l.domain;
      this.edit.domain.setAttribute("readonly", "readonly");
      if (l.concurrent <= 0) {
        this.edit.conunlimited.checked = true;
        this.edit.conlimit.value = "3";
      }
      else {
        this.edit.conlimited.checked = true;
        this.edit.conlimit.value = l.concurrent;
      }

      if (l.domain === "*") {
        this.edit.delete.classList.add("hidden");
      }
      else {
        this.edit.delete.classList.remove("hidden");
      }
    });

    $("#limit-create").addEventListener("click", () => {
      this.selection.clear();
      this.resetEdits();
      this.edit.delete.classList.add("hidden");
      $("#limit-edit").classList.remove("hidden");
      this.edit.domain.focus();
    });

    this.edit.save.addEventListener("click", () => {
      let domain;
      try {
        if (this.edit.domain.value !== "*") {
          domain = hostToDomain(this.edit.domain.value);
        }
        else {
          domain = "*";
        }
        if (!domain) {
          this.edit.domain.setCustomValidity(
            _("invalid-domain-pref"));
          return;
        }
      }
      catch (ex) {
        console.error(ex.message, ex.stack, ex);
        this.edit.domain.setCustomValidity(
          _("invalid-domain-pref"));
        this.edit.domain.setCustomValidity(ex.message || ex.toString());
        return;
      }
      if (this.edit.conlimited.checked && !this.edit.conlimit.checkValidity()) {
        return;
      }
      const concurrent = this.edit.conunlimited.checked ?
        -1 :
        parseInt(this.edit.conlimit.value, 10);
      Limits.saveEntry(domain, {
        domain,
        concurrent
      });
    });

    this.edit.delete.addEventListener("click", () => {
      if (!this.edit.limit) {
        return;
      }
      Limits.delete(this.edit.limit.domain);
    });
  }

  resetEdits() {
    this.edit.limit = null;
    this.edit.domain.removeAttribute("readonly");
    this.edit.domain.value = "";
    this.edit.domain.setCustomValidity("");
    this.edit.conunlimited.checked = true;
    this.edit.conlimit.value = "3";
    this.edit.delete.classList.add("hidden");
    $("#limit-edit").classList.add("hidden");
  }

  get rowCount() {
    return this.limits.length;
  }

  getCellText(rowid: number, colid: number) {
    const f = this.limits[rowid];
    if (!f) {
      return null;
    }
    switch (colid) {
    case 0:
      return f.domain;

    case 1:
      return f.concurrent <= 0 ? _("unlimited") : f.concurrent;

    default:
      return "";
    }
  }
}


addEventListener("DOMContentLoaded", async () => {
  await localize(document.documentElement);

  // General
  new BoolPref("pref-manager-in-popup", "manager-in-popup");
  new BoolPref("pref-queue-notification", "queue-notification");
  new BoolPref("pref-finish-notification", "finish-notification");
  // XXX: #125
  const sounds = new BoolPref("pref-sounds", "sounds");
  if (OPERA) {
    const sp = sounds.elem.parentElement;
    if (sp) {
      sp.style.display = "none";
    }
  }
  new BoolPref("pref-hide-context", "hide-context");
  new BoolPref("pref-tooltip", "tooltip");
  new BoolPref("pref-open-manager-on-queue", "open-manager-on-queue");
  new BoolPref("pref-text-links", "text-links");
  new BoolPref("pref-add-paused", "add-paused");
  new BoolPref("pref-show-urls", "show-urls");
  new BoolPref("pref-remove-missing-on-init", "remove-missing-on-init");
  new OptionPref("pref-button-type", "button-type");
  new OptionPref("pref-theme", "theme");
  new OptionPref("pref-conflict-action", "conflict-action");

  $("#reset-confirmations").addEventListener("click", async () => {
    for (const k of Prefs) {
      if (!k.startsWith("confirmations.")) {
        continue;
      }
      await Prefs.reset(k);
    }
    await ModalDialog.inform(
      _("information.title"), _("reset-confirmations.done"), _("ok"));
  });
  $("#reset-layout").addEventListener("click", async () => {
    for (const k of Prefs) {
      if (!k.startsWith("tree-config-")) {
        continue;
      }
      await Prefs.reset(k);
    }
    for (const k of Prefs) {
      if (!k.startsWith("window-state-")) {
        continue;
      }
      await Prefs.reset(k);
    }
    await ModalDialog.inform(
      _("information.title"), _("reset-layouts.done"), _("ok"));
  });


  const langs = $<HTMLSelectElement>("#languages");
  const currentLang = getCurrentLanguage();
  for (const [code, lang] of ALL_LANGS.entries()) {
    const langEl = document.createElement("option");
    langEl.textContent = lang;
    langEl.value = code;
    if (code === currentLang) {
      langEl.selected = true;
    }
    langs.appendChild(langEl);
  }
  langs.addEventListener("change", async () => {
    await storage.sync.set({language: langs.value});
    if (langs.value === currentLang) {
      return;
    }
    // eslint-disable-next-line max-len
    if (confirm("Changing the selected translation requires restarting the extension.\nDo you want to restart the extension now?")) {
      runtime.reload();
    }
  });

  // Filters
  visible("#filters").then(() => new FiltersUI());

  // Network
  new IntPref("pref-concurrent-downloads", "concurrent");
  new IntPref("pref-retries", "retries");
  new IntPref("pref-retry-time", "retry-time");

  visible("#limits").then(() => new LimitsUI());

  const customLocale = $<HTMLInputElement>("#customLocale");
  $<HTMLInputElement>("#loadCustomLocale").addEventListener("click", () => {
    customLocale.click();
  });
  $<HTMLInputElement>("#clearCustomLocale").
    addEventListener("click", async () => {
      await saveCustomLocale(undefined);
      runtime.reload();
    });
  customLocale.addEventListener("change", async () => {
    if (!customLocale.files || !customLocale.files.length) {
      return;
    }
    const [file] = customLocale.files;
    if (!file || file.size > (5 << 20)) {
      return;
    }
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
      await saveCustomLocale(text);

      if (confirm("Imported your file.\nWant to reload the extension now?")) {
        runtime.reload();
      }
    }
    catch (ex) {
      console.error(ex);
      alert(`Could not load your translation file:\n${ex.toString()}`);
    }
  });
});
