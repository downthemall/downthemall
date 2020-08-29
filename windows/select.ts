"use strict";
// License: MIT

import { VirtualTable } from "../uikit/lib/table";
import ModalDialog from "../uikit/lib/modal";
import { ContextMenu } from "./contextmenu";
import { iconForPath } from "../lib/windowutils";
import { _, localize } from "../lib/i18n";
import { Prefs } from "../lib/prefs";
import { MASK, FASTFILTER, SUBFOLDER } from "../lib/recentlist";
import { WindowState } from "./windowstate";
import { Dropdown } from "./dropdown";
import { Keys } from "./keys";
import { Icons } from "./icons";
import { sort, naturalCaseCompare } from "../lib/sorting";
import { hookButton } from "../lib/manager/renamer";
import { CellTypes } from "../uikit/lib/constants";
// eslint-disable-next-line no-unused-vars
import { runtime, RawPort } from "../lib/browser";
import { $ } from "./winutil";
// eslint-disable-next-line no-unused-vars
import { BaseItem } from "../lib/item";
// eslint-disable-next-line no-unused-vars
import { ItemDelta } from "../lib/select";
// eslint-disable-next-line no-unused-vars
import { TableConfig } from "../uikit/lib/config";
import { validateSubFolder as validateSubfolder } from "../lib/util";
import "./theme";

const PORT: RawPort = runtime.connect(null, { name: "select" });

const TREE_CONFIG_VERSION = 1;

const COL_CHECK = 0;
const COL_DOWNLOAD = 1;
const COL_TITLE = 2;
const COL_DESC = 3;
const COL_MASK = 4;
const COL_REFERRER = 5;

const ICON_BASE_SIZE = 16;
const NUM_FILTER_CLASSES = 8;

let Table: SelectionTable;
let Mask: Dropdown;
let FastFilter: Dropdown;
let Subfolder: Dropdown;


type DELTAS = {deltaLinks: ItemDelta[]; deltaMedia: ItemDelta[]};

interface BaseMatchedItem extends BaseItem {
  backIdx: number;
  matched?: string | null;
  rowid: number;
}

function clearErrors() {
  const not = $("#notification");
  not.textContent = "";
  not.style.display = "none";
}


function matched(item: BaseMatchedItem) {
  return item && item.matched && item.matched !== "unmanual";
}

class PausedModalDialog extends ModalDialog {
  getContent() {
    const tmpl = $<HTMLTemplateElement>("#paused-template");
    const content = tmpl.content.cloneNode(true) as DocumentFragment;
    return content;
  }

  shown() {
    this.focusDefault();
  }

  get buttons() {
    return [
      {
        title: _("remember"),
        value: "ok",
        default: true,
        dismiss: false
      },
      {
        title: _("add-paused-once"),
        value: "once",
        default: false,
        dismiss: false
      },
      {
        title: _("cancel"),
        value: "cancel",
        default: false,
        dismiss: true
      }
    ];
  }
}

class CheckClasser extends Map<string, string> {
  gen: IterableIterator<string>;

  constructor(numClasses: number) {
    super();
    this.gen = (function *() {
      for (;;) {
        for (let c = 0; c < numClasses; ++c) {
          yield `filter-${c + 1}`;
        }
      }
    })();
    this.set("manual", "filter-manual");
    this.set("fast", "filter-fast");
  }

  "get"(key: string) {
    let result = super.get(key);
    if (typeof result !== "string") {
      result = this.gen.next().value;
      if (result) {
        super.set(key, result);
      }
    }
    return result;
  }
}

type KeyFn = (item: BaseMatchedItem) => any;

class ItemCollection {
  private items: BaseMatchedItem[];

  private indexes: Map<number, BaseMatchedItem>;

  constructor(items: BaseMatchedItem[]) {
    this.items = items;
    this.assignRows();
    this.items.forEach((item, idx) => item.backIdx = idx);
    this.indexes = new Map(items.map((i, idx) => [idx, i]));
  }

  assignRows() {
    this.items.forEach((item, idx) => item.rowid = idx);
  }

  get length() {
    return this.items.length;
  }

  get checked() {
    const rv: number[] = [];
    this.items.forEach(function (item, idx) {
      if (item.matched && item.matched !== "unmanual") {
        rv.push(idx);
      }
    });
    return rv;
  }

  get checkedBackIndexes() {
    const rv: number[] = [];
    this.items.forEach(function(item) {
      if (item.matched && item.matched !== "unmanual") {
        rv.push(item.backIdx);
      }
    });
    return rv;
  }


  at(idx: number) {
    return this.items[idx];
  }

  byIndex(idx: number) {
    return this.indexes.get(idx);
  }

  sort(keyFn: KeyFn) {
    sort(this.items, keyFn, naturalCaseCompare);
    this.assignRows();
  }

  reverse() {
    this.items.reverse();
    this.assignRows();
  }

  filter(fn: (item: BaseMatchedItem, idx: number) => boolean) {
    return this.items.filter(fn);
  }
}

class SelectionTable extends VirtualTable {
  checkClasser: CheckClasser;

  icons: Icons;

  links: ItemCollection;

  media: ItemCollection;

  items: ItemCollection;

  type: string;

  status: HTMLElement;

  linksTab: HTMLElement;

  mediaTab: HTMLElement;

  linksFilters: HTMLElement;

  mediaFilters: HTMLElement;

  contextMenu: ContextMenu;

  sortcol: number | null;

  sortasc: boolean;

  keyfns: Map<string, KeyFn>;

  constructor(
      treeConfig: TableConfig | null, type: string,
      links: BaseMatchedItem[], media: BaseMatchedItem[]) {
    if (type === "links" && !links.length) {
      type = "media";
    }
    else if (type === "media" && !media.length) {
      type = "links";
    }
    super("#items", treeConfig, TREE_CONFIG_VERSION);

    this.checkClasser = new CheckClasser(NUM_FILTER_CLASSES);
    this.icons = new Icons($("#icons") as HTMLStyleElement);
    this.links = new ItemCollection(links);
    this.media = new ItemCollection(media);
    this.type = type;
    this.items = type === "links" ? this.links : this.media;

    this.status = $("#statusItems");
    this.linksTab = $("#linksTab");
    if (!links.length) {
      this.linksTab.classList.add("disabled");
    }
    else {
      this.linksTab.addEventListener(
        "click", this.switchTab.bind(this, "links"));
    }

    this.mediaTab = $("#mediaTab");
    if (!media.length) {
      this.mediaTab.classList.add("disabled");
    }
    else {
      this.mediaTab.addEventListener(
        "click", this.switchTab.bind(this, "media"));
    }
    this.linksFilters = $("#linksFilters");
    this.mediaFilters = $("#mediaFilters");

    localize(($("#table-context") as HTMLTemplateElement).content);
    this.contextMenu = new ContextMenu("#table-context");
    Keys.adoptContext(this.contextMenu);

    this.sortcol = null;
    this.sortasc = true;
    this.keyfns = new Map<string, KeyFn>([
      ["colDownload", item => item.usable],
      ["colTitle", item => [item.title, item.usable]],
      ["colDescription", item => [item.description, item.usable]],
      ["colMask", item => [item.mask, item.usable]],
    ]);

    this.on("config-changed", () => {
      Prefs.set("tree-config-select", JSON.stringify(this));
    });
    this.on("column-clicked", colid => {
      const keyfn = this.keyfns.get(colid);
      if (!keyfn) {
        return false;
      }
      this.links.sort(keyfn);
      this.media.sort(keyfn);
      const elem = document.querySelector<HTMLElement>(`#${colid}`);
      const oldelem = (this.sortcol && document.querySelector<HTMLElement>(`#${this.sortcol}`));
      if (this.sortcol === colid && this.sortasc) {
        this.links.reverse();
        this.media.reverse();
        this.sortasc = false;
      }
      else {
        this.sortcol = colid;
        this.sortasc = true;
      }
      if (oldelem) {
        oldelem.dataset.sortdir = "";
      }
      if (elem) {
        elem.dataset.sortdir = this.sortasc ? "asc" : "desc";
      }
      this.invalidate();
      return true;
    });
    this.on(" -keypress", () => this.checkSelection());
    this.contextMenu.on("ctx-check-selected", () => {
      this.checkSelection("manual");
    });
    this.contextMenu.on("ctx-uncheck-selected", () => {
      this.checkSelection("unmanual");
    });
    this.contextMenu.on("ctx-toggle-selected", () => {
      this.checkSelection("toggle");
    });

    Keys.on("ACCEL-KeyA", (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.localName === "input") {
        return false;
      }
      this.selectAll();
      return true;
    });

    Keys.on("ACCEL-KeyF", () => {
      this.selectChecked();
      return true;
    });

    Keys.on("ACCEL-KeyI", () => {
      this.selectToggle();
      return true;
    });

    Keys.on("ACCEL-KeyO", () => {
      this.openSelection();
      return true;
    });

    this.contextMenu.on("ctx-mask", async() => {
      if (this.selection.empty) {
        return;
      }
      let oldmask = "";
      for (const r of this.selection) {
        const m = this.items.at(r).mask;
        if (oldmask && m !== oldmask) {
          oldmask = "";
          break;
        }
        oldmask = m || oldmask;
      }
      try {
        Keys.suppressed = true;
        const newmask = await ModalDialog.prompt(
          _("set_mask"), _("set_mask_text"), oldmask);
        for (const r of this.selection) {
          this.items.at(r).mask = newmask;
          this.invalidateRow(r);
        }
      }
      catch (ex) {
        console.warn("mask dismissed", ex);
      }
      finally {
        Keys.suppressed = false;
      }
    });

    this.contextMenu.on("ctx-referrer", async() => {
      if (this.selection.empty) {
        return;
      }
      let oldref = "";
      for (const r of this.selection) {
        const m = this.items.at(r).usableReferrer;
        if (oldref && m !== oldref) {
          oldref = "";
          break;
        }
        oldref = m || oldref;
      }
      try {
        Keys.suppressed = true;
        const newref = await ModalDialog.prompt(
          _("set_referrer"), _("set_referrer_text"), oldref);
        try {
          let ref;
          if (!newref) {
            ref = {
              referrer: undefined,
              usableReferrer: undefined,
            };
          }
          else {
            const u = new URL(newref);
            u.hash = "";
            ref = {
              referrer: u.toString(),
              usableReferrer: decodeURIComponent(u.toString()),
            };
          }
          for (const r of this.selection) {
            Object.assign(this.items.at(r), ref);
            this.invalidateRow(r);
          }
        }
        catch {
          // ignored
        }
      }
      catch (ex) {
        console.warn("mask dismissed", ex);
      }
      finally {
        Keys.suppressed = false;
      }
    });


    this.contextMenu.on("dismissed", () => this.table.focus());

    this.on("contextmenu", (tree, event) => {
      if (!this.selection.empty) {
        this.contextMenu.show(event);
      }
      return true;
    });

    this.init();
    this.switchTab(type);
  }

  get rowCount() {
    return this.items.length;
  }

  checkSelection(state?: string) {
    if (this.selection.empty) {
      return false;
    }
    for (const rowid of this.selection) {
      const item = this.items.at(rowid);
      if (!state) {
        state = matched(item) ? "unmanual" : "manual";
      }
      let ns;
      switch (state) {
      case "toggle":
        ns = matched(item) ? "unmanual" : "manual";
        break;
      default:
        ns = state;
      }
      item.matched = ns;
      this.invalidateRow(rowid);
    }
    this.updateStatus();
    return true;
  }

  selectAll() {
    this.selection.add(0, this.rowCount - 1);
  }

  selectChecked() {
    this.selection.clear();
    let min = null;
    for (const ci of this.items.checked) {
      this.selection.add(ci);
      min = min === null ? ci : Math.min(min, ci);
    }
    if (min !== null) {
      this.scrollIntoView(min);
    }
  }

  selectToggle() {
    this.selection.toggle(0, this.rowCount - 1);
  }

  openSelection() {
    const privates: BaseMatchedItem[] = [];
    const items = this.items.filter((i, idx) => this.selection.contains(idx)).
      filter(i => {
        if (i.private) {
          privates.push(i);
          return false;
        }
        return true;
      });
    if (!items.length && !privates.length) {
      if (this.focusRow < 0) {
        return;
      }
      const item = this.items.at(this.focusRow);
      if (item.private) {
        privates.push(item);
      }
      else {
        items.push(item);
      }
    }

    if (items.length) {
      PORT.postMessage({
        msg: "openUrls",
        urls: items.map(e => e.url),
        incognito: false,
      });
    }
    if (privates.length) {
      PORT.postMessage({
        msg: "openUrls",
        urls: privates.map(e => e.url),
        incognito: true,
      });
    }
  }

  applyDeltaTo(delta: ItemDelta[], items: ItemCollection) {
    const active = items === this.items;
    for (const d of delta) {
      const {idx = -1, matched = null} = d;
      if (idx < 0) {
        continue;
      }
      const item = items.byIndex(idx);
      if (!item) {
        continue;
      }
      if (item.matched === matched) {
        continue;
      }
      if (matched !== "fast" &&
        (item.matched === "manual" || item.matched === "unmanual")) {
        // Skip manually selected items
        continue;
      }
      item.matched = matched;
      if (active) {
        this.invalidateRow(item.rowid);
      }
    }
  }

  applyDeltas({deltaLinks = [], deltaMedia = []}: DELTAS) {
    this.applyDeltaTo(deltaLinks, this.links);
    this.applyDeltaTo(deltaMedia, this.media);
    this.updateStatus();
  }

  switchTab(type: string) {
    this.type = type;
    const isLinks = type === "links";
    this.linksTab.classList[isLinks ? "add" : "remove"]("active");
    this.mediaTab.classList[!isLinks ? "add" : "remove"]("active");
    this.linksFilters.classList[isLinks ? "add" : "remove"]("active");
    this.mediaFilters.classList[!isLinks ? "add" : "remove"]("active");
    this.items = (this as any)[type];
    this.selection.clear();
    this.invalidate();
    this.updateStatus();
  }

  updateStatus() {
    const selected = this.items.checked.length;
    if (!selected) {
      this.status.textContent = _("noitems.label");
    }
    else {
      this.status.textContent = _("numitems.label", [selected]);
    }
    clearErrors();
  }

  getRowClasses(rowid: number) {
    const item = this.items.at(rowid);
    if (!item || !matched(item) || !item.matched) {
      return null;
    }
    const m = this.checkClasser.get(item.matched);
    if (!m) {
      return null;
    }
    return ["filtered", m];
  }

  getCellIcon(rowid: number, colid: number) {
    const item = this.items.at(rowid);
    if (item && colid === COL_DOWNLOAD) {
      return this.icons.get(iconForPath(item.url, ICON_BASE_SIZE));
    }
    return null;
  }

  getCellType(rowid: number, colid: number) {
    switch (colid) {
    case COL_CHECK:
      return CellTypes.TYPE_CHECK;
    default:
      return CellTypes.TYPE_TEXT;
    }
  }

  getDownloadText(idx: number) {
    const item = this.items.at(idx);
    if (!item) {
      return "";
    }
    if (item.fileName) {
      return `${item.usable} (${item.fileName})`;
    }
    return item.usable;
  }

  getText(prop: string, idx: number) {
    const item: any = this.items.at(idx);
    if (!item || !(prop in item) || !item[prop]) {
      return "";
    }
    return item[prop];
  }

  getMaskText(idx: number) {
    const item = this.items.at(idx);
    if (item) {
      return item.mask;
    }
    return _("mask.default");
  }

  getCellText(rowid: number, colid: number) {
    switch (colid) {
    case COL_DOWNLOAD:
      return this.getDownloadText(rowid);

    case COL_TITLE:
      return this.getText("title", rowid);

    case COL_DESC:
      return this.getText("description", rowid);

    case COL_REFERRER:
      return this.getText("usableReferrer", rowid);

    case COL_MASK:
      return this.getMaskText(rowid);

    default:
      return "";
    }
  }

  getCellCheck(rowid: number, colid: number) {
    if (colid === COL_CHECK) {
      return !!matched(this.items.at(rowid));
    }
    return false;
  }

  setCellCheck(rowid: number, colid: number, value: boolean) {
    this.items.at(rowid).matched = value ? "manual" : "unmanual";
    this.invalidateRow(rowid);
    this.updateStatus();
  }
}

async function download(paused = false) {
  try {
    const mask = Mask.value;
    if (!mask) {
      throw new Error("error.invalidMask");
    }
    const subfolder = Subfolder.value;
    validateSubfolder(subfolder);

    const items = Table.items.checkedBackIndexes;
    if (!items.length) {
      throw new Error("error.noItemsSelected");
    }
    if (paused && !(await Prefs.get("add-paused"))) {
      try {
        Keys.suppressed = true;
        const remember = await new PausedModalDialog().show();
        if (remember === "ok") {
          await Prefs.set("add-paused", true);
          await Prefs.save();
        }
      }
      catch (ex) {
        return;
      }
      finally {
        Keys.suppressed = false;
      }
    }
    if (!paused) {
      await Prefs.set("add-paused", false);
    }
    PORT.postMessage({
      msg: "queue",
      items,
      options: {
        type: Table.type,
        paused,
        mask,
        maskOnce: $<HTMLInputElement>("#maskOnceCheck").checked,
        fast: FastFilter.value,
        fastOnce: $<HTMLInputElement>("#fastOnceCheck").checked,
        subfolder,
        subfolderOnce: $<HTMLInputElement>("#subfolderOnceCheck").checked,
      }
    });
  }
  catch (ex) {
    const not = $("#notification");
    const msg = _(ex.message || ex);
    not.textContent = msg || ex.message || ex;
    not.style.display = "block";
  }
}

class Filter {
  active: boolean;

  checkElem: HTMLInputElement;

  container: HTMLElement;

  elem: HTMLLabelElement;

  id: string;

  label: string;

  constructor(container: HTMLElement, raw: any, active = false) {
    Object.assign(this, raw);
    this.active = active;
    this.container = container;

    this.elem = document.createElement("label");
    this.elem.classList.add("filter");
    this.elem.setAttribute("title", this.elem.textContent = this.label);
    this.checkElem = document.createElement("input");
    this.checkElem.setAttribute("type", "checkbox");
    this.checkElem.checked = active;
    this.elem.insertBefore(this.checkElem, this.elem.firstChild);
    this.container.appendChild(this.elem);
    this.checkElem.addEventListener("change", this.changed.bind(this));
  }

  changed() {
    PORT.postMessage({
      msg: "filter-changed",
      id: this.id,
      value: this.checkElem.checked
    });
  }
}

function setFiltersInternal(
    desc: string, filters: any[], active: Set<string>) {
  const container = $(desc);
  container.textContent = "";
  for (let filter of filters) {
    filter = new Filter(container, filter, active.has(filter.id));
  }
}

function setFilters(filters: any) {
  const {
    linkFilterDescs = [],
    mediaFilterDescs = [],
    activeFilters = []
  } = filters;
  const active: Set<string> = new Set(activeFilters);
  setFiltersInternal("#linksFilters", linkFilterDescs, active);
  setFiltersInternal("#mediaFilters", mediaFilterDescs, active);
}

function cancel() {
  PORT.postMessage("cancel");
  return true;
}

async function init() {
  await Promise.all([MASK.init(), FASTFILTER.init(), SUBFOLDER.init()]);
  Mask = new Dropdown("#mask", MASK.values);
  Mask.on("changed", clearErrors);
  FastFilter = new Dropdown("#fast", FASTFILTER.values);
  FastFilter.on("changed", () => {
    PORT.postMessage({
      msg: "fast-filter",
      fastFilter: FastFilter.value
    });
  });
  Subfolder = new Dropdown("#subfolder", SUBFOLDER.values);
  Subfolder.on("changed", clearErrors);
}

const LOADED = new Promise(resolve => {
  addEventListener("load", function dom() {
    removeEventListener("load", dom);
    resolve();
  });
});


addEventListener("DOMContentLoaded", function dom() {
  removeEventListener("DOMContentLoaded", dom);

  init().catch(console.error);

  localize(document.documentElement);

  $("#donate").addEventListener("click", () => {
    PORT.postMessage({
      msg: "donate",
    });
  });
  $("#statusPrefs").addEventListener("click", () => {
    PORT.postMessage({
      msg: "prefs",
    });
  });
  $("#btnDownload").addEventListener("click", () => download(false));
  $("#btnPaused").addEventListener("click", () => download(true));
  $("#btnCancel").addEventListener(
    "click", cancel);
  $("#fastDisableOthers").addEventListener("change", () => {
    PORT.postMessage({
      msg: "onlyfast",
      fast: $<HTMLInputElement>("#fastDisableOthers").checked
    });
  });

  Keys.on("Enter", "Return", () => {
    download(false);
    return true;
  });
  Keys.on("ACCEL-Enter", "ACCEL-Return", () => {
    download(true);
    return true;
  });

  PORT.onMessage.addListener(async (msg: any) => {
    try {
      await LOADED;
      switch (msg.msg) {
      case "items": {
        const {type = "links", links = [], media = []} = msg.data;
        const treeConfig = JSON.parse(
          await Prefs.get("tree-config-select", "{}"));
        requestAnimationFrame(() => {
          Table = new SelectionTable(treeConfig, type, links, media);
        });
        return;
      }

      case "filters":
        setFilters(msg.data);
        return;

      case "item-delta":
        requestAnimationFrame(() => {
          Table.applyDeltas(msg.data);
        });
        return;

      default:
        throw Error("Unhandled message");
      }
    }
    catch (ex) {
      console.error("Failed to process message", msg, ex);
    }
  });

  Keys.on("Escape", cancel);

  hookButton($("#maskButton"));
});

addEventListener("contextmenu", event => {
  event.preventDefault();
  return false;
});


addEventListener("beforeunload", function() {
  PORT.disconnect();
});

new WindowState(PORT);
