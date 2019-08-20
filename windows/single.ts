/* eslint-disable require-atomic-updates */
"use strict";
// License: MIT

import ModalDialog from "../uikit/lib/modal";
import { _, localize } from "../lib/i18n";
import { Item } from "../lib/item";
import { MASK } from "../lib/recentlist";
import { BatchGenerator } from "../lib/batches";
import { WindowState } from "./windowstate";
import { Dropdown } from "./dropdown";
import { Keys } from "./keys";
import { hookButton } from "../lib/manager/renamer";
import { runtime } from "../lib/browser";

const PORT = runtime.connect(null, { name: "single" });
const $ = document.querySelector.bind(document);

let ITEM: any;
let Mask: Dropdown;

class BatchModalDialog extends ModalDialog {
  private readonly gen: BatchGenerator;

  constructor(gen: BatchGenerator) {
    super();
    this.gen = gen;
  }

  get content() {
    const content = $("#batch-template").content.cloneNode(true);
    localize(content);
    const $$ = content.querySelector.bind(content);
    $$(".batch-items").textContent = this.gen.length.toLocaleString();
    $$(".batch-preview").textContent = this.gen.preview;
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

function setItem(item: any) {
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
    mask = ""
  } = item;
  $("#URL").value = usable;
  $("#filename").value = fileName;
  $("#title").value = title;
  $("#description").value = description;
  $("#referrer").value = usableReferrer;
  if (mask) {
    Mask.value = mask;
  }
}

function displayError(err: string) {
  const not = $("#notification");
  not.textContent = _(err);
  not.style.display = "block";
}

async function downloadInternal(paused: boolean) {
  let usable = $("#URL").value.trim();
  let url;
  try {
    url = new URL(usable).toString();
  }
  catch (ex) {
    try {
      url = new URL(`https://${usable}`).toString();
      $("#URL").value = usable = `https://${usable}`;
    }
    catch (ex) {
      return displayError("error.invalidURL");
    }
  }

  const gen = new BatchGenerator(usable);

  const usableReferrer = $("#referrer").value.trim();
  let referrer;
  try {
    referrer = usableReferrer ? new URL(usableReferrer).toString() : "";
  }
  catch (ex) {
    return displayError("error.invalidReferrer");
  }

  const fileName = $("#filename").value.trim();
  const title = $("#title").value.trim();
  const description = $("#description").value.trim();
  const mask = Mask.value.trim();
  if (!mask) {
    return displayError("error.invalidMask");
  }

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
    });
  }
  else {
    ITEM.fileName = fileName;
    ITEM.title = title;
    ITEM.description = description;
    ITEM.mask = mask;
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
    paused,
    items,
    mask,
    maskOnce: $("#maskOnceCheck").checked,
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
  await Promise.all([MASK.init()]);
  Mask = new Dropdown("#mask", MASK.values);
}

addEventListener("DOMContentLoaded", function dom() {
  removeEventListener("DOMContentLoaded", dom);
  init().catch(console.error);

  localize(document.documentElement);
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

  PORT.onMessage.addListener((msg: any) => {
    try {
      switch (msg.msg) {
      case "item": {
        setItem(msg.data);
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

  hookButton($("#maskButton"));
});

addEventListener("load", function() {
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

addEventListener("beforeunload", function() {
  PORT.disconnect();
});

new WindowState(PORT);

