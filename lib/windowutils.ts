"use strict";
// License: MIT

import { windows, tabs, runtime } from "../lib/browser";
import {getManager} from "./manager/man";
import DEFAULT_ICONS from "../data/icons.json";

const DONATE_URL = "https://www.downthemall.org/howto/donate/";
const MANAGER_URL = "/windows/manager.html";

export async function mostRecentBrowser(): Promise<any> {
  let window;
  try {
    window = await windows.getCurrent({windowTypes: ["normal"]});
    if (window.type !== "normal") {
      throw new Error("not a normal window");
    }
  }
  catch {
    try {
      window = await windows.getlastFocused({windowTypes: ["normal"]});
      if (window.type !== "normal") {
        throw new Error("not a normal window");
      }
    }
    catch {
      window = Array.from(await windows.getAll({windowTypes: ["normal"]})).
        filter((w: any) => w.type === "normal").pop();
    }
  }
  if (!window) {
    window = await windows.create({
      url: DONATE_URL,
      type: "normal",
    });
  }
  return window;
}

export async function openInTab(url: string) {
  const window = await mostRecentBrowser();
  await tabs.create({
    active: true,
    url,
    windowId: window.id,
  });
  await windows.update(window.id, {focused: true});
}

export async function openInTabOrFocus(url: string) {
  const etabs = await tabs.query({
    url
  });
  if (etabs.length) {
    const tab = etabs.pop();
    await tabs.update(tab.id, {active: true});
    await windows.update(tab.windowId, {focused: true});
    return;
  }
  await openInTab(url);
}

export async function maybeOpenInTab(url: string) {
  const etabs = await tabs.query({
    url
  });
  if (etabs.length) {
    return;
  }
  await openInTab(url);
}

export async function donate() {
  await openInTab(DONATE_URL);
}

export async function openPrefs() {
  await runtime.openOptionsPage();
}

export async function openManager(focus = true) {
  try {
    await getManager();
  }
  catch (ex) {
    console.error(ex.toString(), ex);
  }
  if (focus) {
    await openInTabOrFocus(await runtime.getURL(MANAGER_URL));
  }
  else {
    await maybeOpenInTab(await runtime.getURL(MANAGER_URL));
  }
}

export async function openUrls(urls: string) {
  const window = await mostRecentBrowser();
  for (const url of urls) {
    try {
      await tabs.create({
        active: url === urls[0],
        url,
        windowId: window.id,
      });
    }
    catch (ex) {
      console.error(ex);
    }
  }
  await windows.update(window.id, {focused: true});
}

const ICONS = Object.freeze((() => {
  const rv: any[] = [];
  for (const [k, v] of Object.entries<string[]>(DEFAULT_ICONS)) {
    for (const ext of v) {
      rv.push([`file.${ext}`, `icon-file-${k}`]);
    }
  }
  return new Map<string, string>(rv);
})());

export const DEFAULT_ICON_SIZE = 16;

// eslint-disable-next-line no-unused-vars
export function iconForPath(path: string, size = DEFAULT_ICON_SIZE) {
  const web = /^https?:\/\//.test(path);
  let file = path.split(/[\\/]/).pop();
  if (file) {
    const idx = file.lastIndexOf(".");
    if (idx > 0) {
      file = `file${file.substr(idx)}`;
      file.replace(/\?.*?/g, "");
    }
    else {
      file = undefined;
    }
  }
  if (!file) {
    if (web) {
      file = "file.html";
    }
    else {
      file = "file";
    }
  }
  return ICONS.get(file) || "icon-file-generic";
}

/**
 * Resolves when an element becomes first viisble
 * @param {Element} el Element to observe
 * @returns {Promise<Element>}
 */
export function visible(el: Element | string) {
  const elem = typeof el === "string" ?
    document.querySelector<HTMLElement>(el) :
    el as HTMLElement;
  if (!elem) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const obs = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) {
        return;
      }
      obs.disconnect();
      resolve();
    });
    obs.observe(elem);
  });
}
