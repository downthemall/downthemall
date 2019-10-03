/* eslint-disable require-atomic-updates */
"use strict";
// License: MIT

import ModalDialog from "../uikit/lib/modal";
import { _, localize } from "../lib/i18n";
// eslint-disable-next-line no-unused-vars
import { Item, BaseItem } from "../lib/item";
import { MASK, SUBFOLDER } from "../lib/recentlist";
import { BatchGenerator } from "../lib/batches";
import { WindowState } from "./windowstate";
import { Dropdown } from "./dropdown";
import { Keys } from "./keys";
import { hookButton } from "../lib/manager/renamer";
import { runtime } from "../lib/browser";
import { $ } from "./winutil";
import { validateSubFolder } from "../lib/util";
import "./theme";

const PORT = runtime.connect(null, { name: "single" });

let ITEM: BaseItem;
let Mask: Dropdown;
let Subfolder: Dropdown;

class BatchModalDialog extends ModalDialog {
  private readonly gen: BatchGenerator;

  constructor(gen: BatchGenerator) {
    super();
    this.gen = gen;
  }

  getContent() {
    const tmpl = $("#batch-template") as HTMLTemplateElement;
    const content = tmpl.content.cloneNode(true) as DocumentFragment;
    $(".batch-items", content).textContent = this.gen.length.toLocaleString();
    $(".batch-preview", content).textContent = this.gen.preview;
    return content;
  }

  get buttons() {
    return [
      {
        title: _("batch.batch"),
        value: "ok",
        default: true,
        dismiss: false
      },
      {
        title: _("batch.single"),
        value: "single",
        default: false,
        dismiss: false
      },
      {
        title: _("cancel"),
        value: "cancel",
        default: false,
        dismiss: true,
      }
    ];
  }
}

function setItem(item: BaseItem) {
  if (!item) {
    return;
  }
  ITEM = item;
  const {
    usable = "",
    fileName = "",
    title = "",
    description = "",
    usableReferrer = "",
    mask = "",
    subfolder = "",
  } = item;
  $<HTMLInputElement>("#URL").value = usable;
  $<HTMLInputElement>("#filename").value = fileName;
  $<HTMLInputElement>("#title").value = title;
  $<HTMLInputElement>("#description").value = description;
  $<HTMLInputElement>("#referrer").value = usableReferrer;
  if (mask) {
    Mask.value = mask;
  }
  if (subfolder) {
    Subfolder.value = subfolder;
  }
}

function displayError(err: string) {
  const not = $("#notification");
  not.textContent = _(err);
  not.style.display = "block";
}

async function downloadInternal(paused: boolean) {
  let usable = $<HTMLInputElement>("#URL").value.trim();
  let url;
  try {
    url = new URL(usable).toString();
  }
  catch (ex) {
    try {
      url = new URL(`https://${usable}`).toString();
      $<HTMLInputElement>("#URL").value = usable = `https://${usable}`;
    }
    catch (ex) {
      return displayError("error.invalidURL");
    }
  }

  const gen = new BatchGenerator(usable);

  const usableReferrer = $<HTMLInputElement>("#referrer").value.trim();
  let referrer;
  try {
    referrer = usableReferrer ? new URL(usableReferrer).toString() : "";
  }
  catch (ex) {
    return displayError("error.invalidReferrer");
  }

  const fileName = $<HTMLInputElement>("#filename").value.trim();
  const title = $<HTMLInputElement>("#title").value.trim();
  const description = $<HTMLInputElement>("#description").value.trim();
  const mask = Mask.value.trim();
  if (!mask) {
    return displayError("error.invalidMask");
  }

  const subfolder = Subfolder.value.trim();
  validateSubFolder(subfolder);

  const items = [];

  if (!ITEM) {
    ITEM = new Item({
      url,
      usable,
      referrer,
      usableReferrer,
      fileName,
      title,
      description,
      mask,
      subfolder
    });
  }
  else {
    ITEM.fileName = fileName;
    ITEM.title = title;
    ITEM.description = description;
    ITEM.mask = mask;
    ITEM.subfolder = subfolder;
    if (usableReferrer !== ITEM.usableReferrer) {
      ITEM.referrer = referrer;
      ITEM.usableReferrer = usableReferrer;
    }
  }

  let isBatch = gen.length > 1;

  if (isBatch) {
    try {
      Keys.suppressed = true;
      const rv = await new BatchModalDialog(gen).show();
      isBatch = rv === "ok";
    }
    finally {
      Keys.suppressed = false;
    }
  }

  if (!isBatch) {
    if (usable !== ITEM.usable) {
      ITEM.url = url;
      ITEM.usable = usable;
    }
    items.push(ITEM);
  }
  else {
    for (const usable of gen) {
      items.push(Object.assign(
        {},
        ITEM,
        { usable, url: new URL(usable).toString() }));
    }
  }

  PORT.postMessage({
    msg: "queue",
    items,
    options: {
      paused,
      mask,
      maskOnce: $<HTMLInputElement>("#maskOnceCheck").checked,
      subfolder,
      subfolderOnce: $<HTMLInputElement>("#subfolderOnceCheck").checked,
    }
  });
  return null;
}

function download(paused: boolean) {
  downloadInternal(paused).catch(console.error);
}

function cancel() {
  PORT.postMessage("cancel");
  return true;
}

async function init() {
  await localize(document.documentElement);
  await Promise.all([MASK.init(), SUBFOLDER.init()]);
  Mask = new Dropdown("#mask", MASK.values);
  Subfolder = new Dropdown("#subfolder", SUBFOLDER.values);
}

addEventListener("DOMContentLoaded", async function dom() {
  removeEventListener("DOMContentLoaded", dom);

  const inited = init();
  PORT.onMessage.addListener(async (msg: any) => {
    try {
      switch (msg.msg) {
      case "item": {
        await inited;
        setItem(msg.data.item);
        return;
      }

      default:
        throw Error("Unhandled message");
      }
    }
    catch (ex) {
      console.error("Failed to process message", msg, ex);
    }
  });

  await inited;

  $("#btnDownload").addEventListener("click", () => download(false));
  $("#btnPaused").addEventListener("click", () => download(true));
  $("#btnCancel").addEventListener(
    "click", cancel);

  Keys.on("Enter", "Return", () => {
    download(false);
    return true;
  });
  Keys.on("ACCEL-Enter", "ACCEL-Return", () => {
    download(true);
    return true;
  });
  Keys.on("Escape", () => {
    cancel();
    return true;
  });

  hookButton($("#maskButton"));
});

addEventListener("load", function () {
  $("#URL").focus();
});

addEventListener("contextmenu", event => {
  const target = event.target as HTMLElement;
  if (target.localName === "input") {
    return null;
  }
  event.preventDefault();
  event.stopPropagation();
  return false;
});

addEventListener("beforeunload", function () {
  PORT.disconnect();
});

new WindowState(PORT);

