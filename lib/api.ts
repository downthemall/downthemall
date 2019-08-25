"use strict";
// License: MIT

import { TYPE_LINK, TYPE_MEDIA } from "./constants";
import { filters } from "./filters";
import { Prefs } from "./prefs";
import { lazy } from "./util";
import { Item, makeUniqueItems } from "./item";
import { getManager } from "./manager/man";
import { select } from "./select";
import { single } from "./single";
import { Notification } from "./notifications";
import { MASK, FASTFILTER } from "./recentlist";
import { openManager } from "./windowutils";
import { _ } from "./i18n";

const MAX_BATCH = 10000;

export const API = new class {
  async filter(arr: any, type: number) {
    return await (await filters()).filterItemsByType(arr, type);
  }

  async queue(items: any, options: any) {
    await MASK.init();
    const {mask = MASK.current} = options;

    const {paused = false} = options;
    const defaults: any = {
      _idx: 0,
      get idx() {
        return ++this._idx;
      },
      referrer: null,
      usableReferrer: null,
      fileName: null,
      title: "",
      description: "",
      fromMetalink: false,
      startDate: new Date(),
      hashes: [],
      private: false,
      postData: null,
      cleanRequest: false,
      mask,
      date: Date.now(),
      paused
    };
    let currentBatch = await Prefs.get("currentBatch", 0);
    const initialBatch = currentBatch;
    lazy(defaults, "batch", () => {
      if (++currentBatch >= MAX_BATCH) {
        currentBatch = 0;
      }
      return currentBatch;
    });
    items = items.map((i: any) => {
      delete i.idx;
      return new Item(i, defaults);
    });
    if (!items) {
      return;
    }
    if (initialBatch !== currentBatch) {
      await Prefs.set("currentBatch", currentBatch);
    }
    const manager = await getManager();
    await manager.addNewDownloads(items);
    if (await Prefs.get("queue-notification")) {
      if (items.length === 1) {
        new Notification(null, _("queued-download"));
      }
      else {
        new Notification(null, _("queued-downloads", items.length));
      }
    }
    if (await Prefs.get("open-manager-on-queue")) {
      await openManager(false);
    }
  }

  sanity(links: any[], media: any[]) {
    if (!links.length && !media.length) {
      new Notification(null, _("no-links"));
      return false;
    }
    return true;
  }

  async turbo(links: any[], media: any[]) {
    if (!this.sanity(links, media)) {
      return false;
    }
    const selected = makeUniqueItems([
      await API.filter(links, TYPE_LINK),
      await API.filter(media, TYPE_MEDIA),
    ]);
    if (!selected.length) {
      return await this.regular(links, media);
    }
    return await this.queue(selected, {paused: await Prefs.get("add-paused")});
  }

  async regularInternal(selected: any) {
    if (selected.mask && !selected.maskOnce) {
      await MASK.init();
      await MASK.push(selected.mask);
    }
    if (typeof selected.fast === "string" && !selected.fastOnce) {
      await FASTFILTER.init();
      await FASTFILTER.push(selected.fast);
    }
    if (typeof selected.type === "string") {
      await Prefs.set("last-type", selected.type);
    }
    const {items} = selected;
    delete selected.items;
    return await this.queue(items, selected);
  }

  async regular(links: any[], media: any[]) {
    if (!this.sanity(links, media)) {
      return false;
    }
    const selected = await select(links, media);
    return this.regularInternal(selected);
  }

  async singleTurbo(item: any) {
    return await this.queue([item], {paused: await Prefs.get("add-paused")});
  }

  async singleRegular(item: any) {
    const selected = await single(item);
    return this.regularInternal(selected);
  }
}();
