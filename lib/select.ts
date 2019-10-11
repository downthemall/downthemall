"use strict";
// License: MIT

// eslint-disable-next-line no-unused-vars
import { Bus, Port } from "./bus";
import { Prefs } from "./prefs";
import { Promised, timeout } from "./util";
import { donate, openPrefs, openUrls } from "./windowutils";
// eslint-disable-next-line no-unused-vars
import { filters, FAST, Filter } from "./filters";
import { WindowStateTracker } from "./windowstatetracker";
import { windows, CHROME } from "./browser";
// eslint-disable-next-line no-unused-vars
import { BaseItem } from "./item";

interface BaseMatchedItem extends BaseItem {
  sidx?: number;
  matched?: string | null;
  prevMatched?: string | null;
}

export interface ItemDelta {
  idx: number;
  matched?: string | null;
}

function computeSelection(
    filters: Filter[],
    items: BaseMatchedItem[],
    onlyFast: boolean): ItemDelta[] {
  let ws = items.map((item, idx: number) => {
    item.idx = item.idx || idx;
    item.sidx = item.sidx || idx;
    const {matched = null} = item;
    item.prevMatched = matched;
    item.matched = null;
    return item;
  });
  for (const filter of filters) {
    ws = ws.filter(item => {
      if (filter.matchItem(item)) {
        if (filter.id === FAST) {
          item.matched = "fast";
        }
        else if (!onlyFast && typeof filter.id === "string") {
          item.matched = filter.id;
        }
        else {
          item.matched = null;
        }
      }
      return !item.matched;
    });
  }
  return items.filter(item => item.prevMatched !== item.matched).map(item => {
    return {
      idx: item.sidx as number,
      matched: item.matched
    };
  });
}

function *computeActiveFiltersGen(
    filters: Filter[], activeOverrides: Map<string, boolean>) {
  for (const filter of filters) {
    if (typeof filter.id !== "string") {
      continue;
    }
    const override = activeOverrides.get(filter.id);
    if (typeof override === "boolean") {
      if (override) {
        yield filter;
      }
      continue;
    }
    if (filter.active) {
      yield filter;
    }
  }
}

function computeActiveFilters(
    filters: Filter[], activeOverrides: Map<string, boolean>) {
  return Array.from(computeActiveFiltersGen(filters, activeOverrides));
}

function filtersToDescs(filters: Filter[]) {
  return filters.map(f => f.descriptor);
}

export async function select(links: BaseItem[], media: BaseItem[]) {
  const fm = await filters();
  const tracker = new WindowStateTracker("select", {
    minWidth: 700,
    minHeight: 500,
  });
  await tracker.init();
  const windowOptions = tracker.getOptions({
    url: "/windows/select.html",
    type: "popup",
  });
  const window = await windows.create(windowOptions);
  tracker.track(window.id);
  try {
    if (!CHROME) {
      windows.update(window.id, tracker.getOptions({}));
    }
    const port = await Promise.race<Port>([
      new Promise<Port>(resolve => Bus.oncePort("select", port => {
        resolve(port);
        return true;
      })),
      timeout<Port>(5 * 1000)]);
    if (!port.isSelf) {
      throw Error("Invalid sender connected");
    }
    tracker.track(window.id, port);

    const overrides = new Map();
    let fast: Filter | null = null;
    let onlyFast: false;
    try {
      fast = await fm.getFastFilter();
    }
    catch (ex) {
      // ignored
    }

    const sendFilters = function(delta = false) {
      const {linkFilters, mediaFilters} = fm;
      const alink = computeActiveFilters(linkFilters, overrides);
      const amedia = computeActiveFilters(mediaFilters, overrides);
      const sactiveFilters = new Set<any>();
      [alink, amedia].forEach(
        a => a.forEach(filter => sactiveFilters.add(filter.id)));
      const activeFilters = Array.from(sactiveFilters);
      const linkFilterDescs = filtersToDescs(linkFilters);
      const mediaFilterDescs = filtersToDescs(mediaFilters);
      port.post("filters", {linkFilterDescs, mediaFilterDescs, activeFilters});

      if (fast) {
        alink.unshift(fast);
        amedia.unshift(fast);
      }
      const deltaLinks = computeSelection(alink, links, onlyFast);
      const deltaMedia = computeSelection(amedia, media, onlyFast);
      if (delta) {
        port.post("item-delta", {deltaLinks, deltaMedia});
      }
    };

    const done = new Promised();

    port.on("disconnect", () => {
      done.reject(new Error("Prematurely disconnected"));
    });

    port.on("cancel", () => {
      done.reject(new Error("User canceled"));
    });

    port.on("queue", (msg: any) => {
      done.resolve(msg);
    });

    port.on("filter-changed", (spec: any) => {
      overrides.set(spec.id, spec.value);
      sendFilters(true);
    });

    port.on("fast-filter", ({fastFilter}) => {
      if (fastFilter) {
        try {
          fast = fm.getFastFilterFor(fastFilter);
        }
        catch (ex) {
          console.error(ex);
          fast = null;
        }
      }
      else {
        fast = null;
      }
      sendFilters(true);
    });
    port.on("onlyfast", ({fast}) => {
      onlyFast = fast;
      sendFilters(true);
    });

    port.on("donate", () => {
      donate();
    });
    port.on("prefs", () => {
      openPrefs();
    });

    port.on("openUrls", ({urls, incognito}) => {
      openUrls(urls, incognito);
    });

    try {
      fm.on("changed", () => sendFilters(true));
      sendFilters(false);
      const type = await Prefs.get("last-type", "links");
      port.post("items", {type, links, media});
      const {items, options} = await done;
      const selectedIndexes = new Set<number>(items);
      const selectedList = (options.type === "links" ? links : media);
      const selectedItems = selectedList.filter(
        (item: BaseItem, idx: number) => selectedIndexes.has(idx));
      for (const [filter, override] of overrides) {
        const f = fm.get(filter);
        if (f) {
          f.active = override;
        }
      }
      await fm.save();
      return {items: selectedItems, options};
    }
    finally {
      fm.off("changed", sendFilters);
    }
  }
  finally {
    try {
      await tracker.finalize();
    }
    catch (ex) {
      // window might be gone; ignored
    }
    try {
      await windows.remove(window.id);
    }
    catch (ex) {
      // window might be gone; ignored
    }
  }
}
