"use strict";
// License: MIT

import { ALLOWED_SCHEMES, TRANSFERABLE_PROPERTIES } from "./constants";
import { API } from "./api";
import { Finisher, makeUniqueItems } from "./item";
import { Prefs } from "./prefs";
import { _, locale } from "./i18n";
import { openPrefs, openManager } from "./windowutils";
import { filters } from "./filters";
import { getManager } from "./manager/man";
import {
  browserAction as action,
  menus as _menus, contextMenus as _cmenus,
  tabs,
  webNavigation as nav,
  // eslint-disable-next-line no-unused-vars
  Tab,
  // eslint-disable-next-line no-unused-vars
  MenuClickInfo,
  CHROME,
  runtime,
  history,
  sessions,
  // eslint-disable-next-line no-unused-vars
  OnInstalled,
} from "./browser";
import { Bus } from "./bus";
import { filterInSitu } from "./util";
import { DB } from "./db";


const menus = typeof (_menus) !== "undefined" && _menus || _cmenus;

const GATHER = "/bundles/content-gather.js";

const CHROME_CONTEXTS = Object.freeze(new Set([
  "all",
  "audio",
  "browser_action",
  "editable",
  "frame",
  "image",
  "launcher",
  "link",
  "page",
  "page_action",
  "selection",
  "video",
]));

async function runContentJob(tab: Tab, file: string, msg: any) {
  try {
    if (tab && tab.incognito && msg) {
      msg.private = tab.incognito;
    }
    const res = await tabs.executeScript(tab.id, {
      file,
      allFrames: true,
      runAt: "document_start"
    });
    if (!msg) {
      return res;
    }
    const promises = [];
    const results: any[] = [];
    for (const frame of await nav.getAllFrames({ tabId: tab.id })) {
      promises.push(tabs.sendMessage(tab.id, msg, {
        frameId: frame.frameId}
      ).then(function(res: any) {
        results.push(res);
      }).catch(console.error));
    }
    await Promise.all(promises);
    return results;
  }
  catch (ex) {
    console.error("Failed to execute content script", file,
      ex.message || ex.toString(), ex);
    return [];
  }
}

type SelectionOptions = {
  selectionOnly: boolean;
  allTabs: boolean;
  turbo: boolean;
  tab: Tab;
};


class Handler {
  async processResults(turbo = false, results: any[]) {
    const links = this.makeUnique(results, "links");
    const media = this.makeUnique(results, "media");
    await API[turbo ? "turbo" : "regular"](links, media);
  }

  makeUnique(results: any[], what: string) {
    return makeUniqueItems(
      results.filter(e => e[what]).map(e => {
        const finisher = new Finisher(e);
        return filterInSitu(e[what].
          map((item: any) => finisher.finish(item)), e => !!e);
      }));
  }

  async performSelection(options: SelectionOptions) {
    try {
      const tabOptions: any = {
        currentWindow: true,
        discarded: false,
      };
      if (!CHROME) {
        tabOptions.hidden = false;
      }
      const selectedTabs = options.allTabs ?
        await tabs.query(tabOptions) as any[] :
        [options.tab];

      const textLinks = await Prefs.get("text-links", true);
      const gatherOptions = {
        type: "DTA:gather",
        selectionOnly: options.selectionOnly,
        textLinks,
        schemes: Array.from(ALLOWED_SCHEMES.values()),
        transferable: TRANSFERABLE_PROPERTIES,
      };

      const results = await Promise.all(selectedTabs.
        map((tab: any) => runContentJob(tab, GATHER, gatherOptions)));

      await this.processResults(options.turbo, results.flat());
    }
    catch (ex) {
      console.error(ex.toString(), ex.stack, ex);
    }
  }
}

function getMajor(version?: string) {
  if (!version) {
    return "";
  }
  const match = version.match(/^\d+\.\d+/);
  if (!match) {
    return "";
  }
  return match[0];
}

runtime.onInstalled.addListener(({reason, previousVersion}: OnInstalled) => {
  const {version} = runtime.getManifest();
  const major = getMajor(version);
  const prevMajor = getMajor(previousVersion);
  if (reason === "update" && major !== prevMajor) {
    tabs.create({
      url: `https://about.downthemall.org/changelog/?cur=${major}&prev=${prevMajor}`,
    });
  }
  else if (reason === "install") {
    tabs.create({
      url: `https://about.downthemall.org/4.0/?cur=${major}`,
    });
  }
});

locale.then(() => {
  const menuHandler = new class Menus extends Handler {
    constructor() {
      super();
      this.onClicked = this.onClicked.bind(this);
      const alls = new Map<string, string[]>();
      const menuCreate = (options: any) => {
        if (CHROME) {
          delete options.icons;
          options.contexts = options.contexts.
            filter((e: string) => CHROME_CONTEXTS.has(e));
          if (!options.contexts.length) {
            return;
          }
        }
        if (options.contexts.includes("all")) {
          alls.set(options.id, options.contexts);
        }
        menus.create(options);
      };
      menuCreate({
        id: "DTARegularLink",
        contexts: ["link"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta.regular.link"),
      });
      menuCreate({
        id: "DTATurboLink",
        contexts: ["link"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta.turbo.link"),
      });
      menuCreate({
        id: "DTARegularImage",
        contexts: ["image"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta.regular.image"),
      });
      menuCreate({
        id: "DTATurboImage",
        contexts: ["image"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta.turbo.image"),
      });
      menuCreate({
        id: "DTARegularMedia",
        contexts: ["video", "audio"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta.regular.media"),
      });
      menuCreate({
        id: "DTATurboMedia",
        contexts: ["video", "audio"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta.turbo.media"),
      });
      menuCreate({
        id: "DTARegularSelection",
        contexts: ["selection"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta.regular.selection"),
      });
      menuCreate({
        id: "DTATurboSelection",
        contexts: ["selection"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta.turbo.selection"),
      });
      menuCreate({
        id: "DTARegular",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta.regular"),
      });
      menuCreate({
        id: "DTATurbo",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta.turbo"),
      });
      menuCreate({
        id: "sep-1",
        contexts: ["all", "browser_action", "tools_menu"],
        type: "separator"
      });
      menuCreate({
        id: "DTARegularAll",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        },
        title: _("dta-regular-all"),
      });
      menuCreate({
        id: "DTATurboAll",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        },
        title: _("dta-turbo-all"),
      });
      const sep2ctx = menus.ACTION_MENU_TOP_LEVEL_LIMIT === 6 ?
        ["all", "tools_menu"] :
        ["all", "browser_action", "tools_menu"];
      menuCreate({
        id: "sep-2",
        contexts: sep2ctx,
        type: "separator"
      });
      menuCreate({
        id: "DTAAdd",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/add.svg",
          32: "/style/add.svg",
          64: "/style/add.svg",
          128: "/style/add.svg",
        },
        title: _("add-download"),
      });
      menuCreate({
        id: "sep-3",
        contexts: ["all", "browser_action", "tools_menu"],
        type: "separator"
      });
      menuCreate({
        id: "DTAManager",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/button-manager.png",
          32: "/style/button-manager@2x.png",
        },
        title: _("manager.short"),
      });
      menuCreate({
        id: "DTAPrefs",
        contexts: ["all", "browser_action", "tools_menu"],
        icons: {
          16: "/style/settings.svg",
          32: "/style/settings.svg",
          64: "/style/settings.svg",
          128: "/style/settings.svg",
        },
        title: _("prefs.short"),
      });
      Object.freeze(alls);

      const adjustMenus = (v: boolean) => {
        for (const [id, contexts] of alls.entries()) {
          const adjusted = v ?
            contexts.filter(e => e !== "all") :
            contexts;
          menus.update(id, {
            contexts: adjusted
          });
        }
      };
      Prefs.get("hide-context", false).then((v: boolean) => {
      // This is the initial load, so no need to adjust when visible already
        if (!v) {
          return;
        }
        adjustMenus(v);
      });
      Prefs.on("hide-context", (prefs, key, value: boolean) => {
        adjustMenus(value);
      });

      menus.onClicked.addListener(this.onClicked);
    }

    *makeSingleItemList(url: string, results: any[]) {
      for (const result of results) {
        const finisher = new Finisher(result);
        for (const list of [result.links, result.media]) {
          for (const e of list) {
            if (e.url !== url) {
              continue;
            }
            const finished = finisher.finish(e);
            if (!finished) {
              continue;
            }
            yield finished;
          }
        }
      }
    }

    async findSingleItem(tab: Tab, url: string, turbo = false) {
      if (!url) {
        return;
      }
      const results = await runContentJob(
        tab, "/bundles/content-gather.js", {
          type: "DTA:gather",
          selectionOnly: false,
          schemes: Array.from(ALLOWED_SCHEMES.values()),
          transferable: TRANSFERABLE_PROPERTIES,
        });
      const found = Array.from(this.makeSingleItemList(url, results));
      const unique = makeUniqueItems([found]);
      if (!unique.length) {
        return;
      }
      const [item] = unique;
      API[turbo ? "singleTurbo" : "singleRegular"](item);
    }

    onClicked(info: MenuClickInfo, tab: Tab) {
      if (!tab.id) {
        return;
      }
      const {menuItemId} = info;
      const {[`onClicked${menuItemId}`]: handler}: any = this;
      if (!handler) {
        console.error("Invalid Handler for", menuItemId);
        return;
      }
      const rv: Promise<void> | void = handler.call(this, info, tab);
      if (rv && rv.catch) {
        rv.catch(console.error);
      }
    }

    async emulate(action: string) {
      const tab = await tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.length) {
        return;
      }
      this.onClicked({
        menuItemId: action
      }, tab[0]);
    }

    async onClickedDTARegular(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: false,
        allTabs: false,
        turbo: false,
        tab,
      });
    }

    async onClickedDTARegularAll(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: false,
        allTabs: true,
        turbo: false,
        tab,
      });
    }

    async onClickedDTARegularSelection(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: true,
        allTabs: false,
        turbo: false,
        tab,
      });
    }

    async onClickedDTATurbo(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: false,
        allTabs: false,
        turbo: true,
        tab,
      });
    }

    async onClickedDTATurboAll(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: false,
        allTabs: true,
        turbo: true,
        tab,
      });
    }

    async onClickedDTATurboSelection(info: MenuClickInfo, tab: Tab) {
      return await this.performSelection({
        selectionOnly: true,
        allTabs: false,
        turbo: true,
        tab,
      });
    }

    async onClickedDTARegularLink(info: MenuClickInfo, tab: Tab) {
      if (!info.linkUrl) {
        return;
      }
      await this.findSingleItem(tab, info.linkUrl, false);
    }

    async onClickedDTATurboLink(info: MenuClickInfo, tab: Tab) {
      if (!info.linkUrl) {
        return;
      }
      await this.findSingleItem(tab, info.linkUrl, true);
    }

    async onClickedDTARegularImage(info: MenuClickInfo, tab: Tab) {
      if (!info.srcUrl) {
        return;
      }
      await this.findSingleItem(tab, info.srcUrl, false);
    }

    async onClickedDTATurboImage(info: MenuClickInfo, tab: Tab) {
      if (!info.srcUrl) {
        return;
      }
      await this.findSingleItem(tab, info.srcUrl, true);
    }

    async onClickedDTARegularMedia(info: MenuClickInfo, tab: Tab) {
      if (!info.srcUrl) {
        return;
      }
      await this.findSingleItem(tab, info.srcUrl, false);
    }

    async onClickedDTATurboMedia(info: MenuClickInfo, tab: Tab) {
      if (!info.srcUrl) {
        return;
      }
      await this.findSingleItem(tab, info.srcUrl, true);
    }

    onClickedDTAAdd() {
      API.singleRegular(null);
    }

    async onClickedDTAManager() {
      await openManager();
    }

    async onClickedDTAPrefs() {
      await openPrefs();
    }
  }();

  new class Action extends Handler {
    constructor() {
      super();
      this.onClicked = this.onClicked.bind(this);
      action.onClicked.addListener(this.onClicked);
      Prefs.get("button-type", false).then(v => this.adjust(v));
      Prefs.on("button-type", (prefs, key, value) => {
        this.adjust(value);
      });
    }

    adjust(type: string) {
      action.setPopup({
        popup: type !== "popup" ? "" : "/windows/popup.html"
      });
      let icons;
      switch (type) {
      case "popup":
        icons = {
          16: "/style/icon16.png",
          32: "/style/icon32.png",
          48: "/style/icon48.png",
          64: "/style/icon64.png",
          128: "/style/icon128.png",
          256: "/style/icon256.png"
        };
        break;

      case "dta":
        icons = {
          16: "/style/button-regular.png",
          32: "/style/button-regular@2x.png",
        };
        break;

      case "turbo":
        icons = {
          16: "/style/button-turbo.png",
          32: "/style/button-turbo@2x.png",
        };
        break;

      case "manager":
        icons = {
          16: "/style/button-manager.png",
          32: "/style/button-manager@2x.png",
        };
        break;
      }
      action.setIcon({path: icons});
    }

    async onClicked() {
      switch (await Prefs.get("button-type")) {
      case "popup":
        break;

      case "dta":
        menuHandler.emulate("DTARegular");
        break;

      case "turbo":
        menuHandler.emulate("DTATurbo");
        break;

      case "manager":
        menuHandler.emulate("DTAManager");
        break;
      }
    }
  }();


  Bus.on("do-regular", () => menuHandler.emulate("DTARegular"));
  Bus.on("do-regular-all", () => menuHandler.emulate("DTARegularAll"));
  Bus.on("do-turbo", () => menuHandler.emulate("DTATurbo"));
  Bus.on("do-turbo-all", () => menuHandler.emulate("DTATurboAll"));
  Bus.on("do-single", () => API.singleRegular(null));
  Bus.on("open-manager", () => openManager(true));
  Bus.on("open-prefs", () => openPrefs());

  (async function init() {
    const urlBase = runtime.getURL("");
    history.onVisited.addListener(({url}: {url: string}) => {
      if (!url || !url.startsWith(urlBase)) {
        return;
      }
      history.deleteUrl({url});
    });
    const results: {url?: string}[] = await history.search({text: urlBase});
    for (const {url} of results) {
      if (!url) {
        continue;
      }
      history.deleteUrl({url});
    }

    if (!CHROME) {
      const sessionRemover = async () => {
        for (const s of await sessions.getRecentlyClosed()) {
          if (s.tab) {
            if (s.tab.url.startsWith(urlBase)) {
              await sessions.forgetClosedTab(s.tab.windowId, s.tab.sessionId);
            }
            continue;
          }
          if (!s.window || !s.window.tabs || s.window.tabs.length > 1) {
            continue;
          }
          const [tab] = s.window.tabs;
          if (tab.url.startsWith(urlBase)) {
            await sessions.forgetClosedWindow(s.window.sessionId);
          }
        }
      };
      sessions.onChanged.addListener(sessionRemover);
      await sessionRemover();
    }

    try {
      await DB.init();
    }
    catch (ex) {
      console.error("db init", ex.toString(), ex.message, ex.stack, ex);
    }

    await Prefs.set("last-run", new Date());
    await filters();
    await getManager();
  })().catch(ex => {
    console.error("Failed to init components", ex.toString(), ex.stack, ex);
  });
});
