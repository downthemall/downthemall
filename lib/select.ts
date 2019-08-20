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
import { windows } from "./browser";


function computeSelection(filters: any[], items: any[], onlyFast: boolean) {
  let ws = items.map((item: any, idx: number) => {
    item.idx = idx;
    const {matched = null} = item;
    item.prevMatched = matched;
    item.matched = null;
    return item;
  });
  for (const filter of filters) {
    ws = ws.filter(item => {
      if (filter.matchItem(item)) {
        item.matched = filter.id === FAST ?
          "fast" :
          (onlyFast ? null : filter.id);
      }
      return !item.matched;
    });
  }
  return items.filter(item => item.prevMatched !== item.matched). map(item => {
    return {
      idx: item.idx,
      matched: item.matched
    };
  });
}

function *computeActiveFiltersGen(
    filters: Filter[], activeOverrides: Map<string, boolean>) {
  for (const filter of filters) {
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

function filtersToDescs(filters: any[]) {
  return filters.map(f => f.descriptor);
}

export async function select(links: any[], media: any[]) {
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
  try {
    const port = await Promise.race<Port>([
      new Promise<Port>(resolve => Bus.oncePort("select", resolve)),
      timeout<Port>(5 * 1000)]);
    if (!port.isSelf) {
      throw Error("Invalid sender connected");
    }
    tracker.track(window.id, port);

    const overrides = new Map();
    let fast: any = null;
    let onlyFast: false;
    try {
      fast = fm.getFastFilter();
    }
    catch (ex) {
      // ignored
    }

    const sendFilters = function(delta = false) {
      let {linkFilters, mediaFilters} = fm;
      const alink = computeActiveFilters(linkFilters, overrides);
      const amedia = computeActiveFilters(mediaFilters, overrides);
      const sactiveFilters = new Set<any>();
      [alink, amedia].forEach(
        a => a.forEach(filter => sactiveFilters.add(filter.id)));
      const activeFilters = Array.from(sactiveFilters);
      linkFilters = filtersToDescs(linkFilters);
      mediaFilters = filtersToDescs(mediaFilters);
      port.post("filters", {linkFilters, mediaFilters, activeFilters});

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
      const selected = new Set<number>(msg.items);
      const items = (msg.type === "links" ? links : media);
      msg.items = items.filter((item: any, idx: number) => selected.has(idx));
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

    port.on("openUrls", ({urls}) => {
      openUrls(urls);
    });

    try {
      fm.on("changed", () => sendFilters(true));
      sendFilters(false);
      const type = await Prefs.get("last-type", "links");
      port.post("items", {type, links, media});
      const result = await done;
      for (const [filter, override] of overrides) {
        const f = fm.get(filter);
        if (f) {
          f.active = override;
        }
      }
      await fm.save();
      return result;
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
