"use strict";
// License: MIT

import {DownloadTable} from "./manager/table";
import {_, localize} from "../lib/i18n";
import {Prefs} from "../lib/prefs";
import PORT from "./manager/port";
import { runtime } from "../lib/browser";
import { Promised } from "../lib/util";
import { PromiseSerializer } from "../lib/pserializer";
import { Keys } from "./keys";
import "./theme";

const $ = document.querySelector.bind(document);

let Table: DownloadTable;

const LOADED = new Promise(resolve => {
  addEventListener("load", function dom() {
    removeEventListener("load", dom);
    resolve();
  });
});

addEventListener("DOMContentLoaded", function dom() {
  removeEventListener("DOMContentLoaded", dom);

  const platformed = (async () => {
    try {
      const platform = (await runtime.getPlatformInfo()).os;
      document.documentElement.dataset.platform = platform;
      if (platform === "mac") {
        const ctx = $("#table-context").content;
        ctx.querySelector("#ctx-open-file").dataset.key = "ACCEL-KeyO";
        ctx.querySelector("#ctx-open-directory").dataset.key = "ALT-ACCEL-KeyO";
      }
    }
    catch (ex) {
      console.error("failed to setup platform", ex.toString(), ex.stack, ex);
    }
  })();

  const tabled = new Promised();
  const localized = localize(document.documentElement);
  const loaded = Promise.all([LOADED, platformed, localized]);
  const fullyloaded = Promise.all([LOADED, platformed, tabled, localized]);
  fullyloaded.then(async () => {
    const nag = await Prefs.get("nagging", 0);
    const nagnext = await Prefs.get("nagging-next", 7);
    const next = Math.ceil(Math.log2(Math.max(1, nag)));
    const el = $("#nagging");
    const remove = () => {
      el.parentElement.removeChild(el);
    };
    if (next <= nagnext) {
      return;
    }
    setTimeout(() => {
      $("#nagging-donate").addEventListener("click", () => {
        PORT.post("donate");
        Prefs.set("nagging-next", next);
        remove();
      });
      $("#nagging-later").addEventListener("click", () => {
        Prefs.set("nagging-next", next);
        remove();
      });
      $("#nagging-never").addEventListener("click", () => {
        Prefs.set("nagging-next", Number.MAX_SAFE_INTEGER);
        remove();
      });
      $("#nagging-message").textContent = _(
        "nagging-message", nag.toLocaleString());
      $("#nagging").classList.remove("hidden");
    }, 2 * 1000);
  });

  $("#donate").addEventListener("click", () => {
    PORT.post("donate");
  });
  $("#statusPrefs").addEventListener("click", () => {
    PORT.post("prefs");
  });
  PORT.on("all", async items => {
    await loaded;
    const treeConfig = JSON.parse(await Prefs.get("tree-config-manager", "{}"));
    requestAnimationFrame(() => {
      if (!Table) {
        Table = new DownloadTable(treeConfig);
        Table.init();
        const loading = $("#loading");
        loading.parentElement.removeChild(loading);
        tabled.resolve();
      }
      Table.setItems(items);
    });
  });

  // Updates
  const serializer = new PromiseSerializer(1);
  PORT.on("dirty", serializer.wrap(this, async (items: any[]) => {
    await fullyloaded;
    Table.updateItems(items);
  }));
  PORT.on("removed", serializer.wrap(this, async (sids: number[]) => {
    await fullyloaded;
    Table.removedItems(sids);
  }));

  const statusNetwork = $("#statusNetwork");
  statusNetwork.addEventListener("click", () => {
    PORT.post("toggle-active");
  });
  PORT.on("active", async (active: boolean) => {
    await loaded;
    if (active) {
      statusNetwork.className = "icon-network-on";
      statusNetwork.setAttribute("title", _("statusNetwork-active.title"));
    }
    else {
      statusNetwork.className = "icon-network-off";
      statusNetwork.setAttribute("title", _("statusNetwork-inactive.title"));
    }
  });

  Keys.on("ACCEL-KeyF", () => {
    $("#filter").focus();
    return true;
  });
});

addEventListener("contextmenu", event => {
  event.preventDefault();
  return false;
});


addEventListener("beforeunload", function() {
  PORT.disconnect();
});
