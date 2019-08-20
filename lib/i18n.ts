"use strict";
// License: MIT

import {memoize} from "./memoize";

function load() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {i18n} = require("webextension-polyfill");

    return i18n;
  }
  catch (ex) {
    // We might be running under node for tests

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messages = require("../_locales/en/messages.json");

    const map = new Map();
    for (const [k, v] of Object.entries<any>(messages)) {
      const {placeholders = {}} = v;
      let {message = ""} = v;
      for (const [pname, pval] of Object.entries<any>(placeholders)) {
        message = message.replace(`$${pname.toUpperCase()}$`, `${pval.content}$`);
      }
      map.set(k, message);
    }

    return {
      getMessage(id: string, subst: string[]) {
        const m = map.get(id);
        if (typeof subst === undefined) {
          return m;
        }
        if (!Array.isArray(subst)) {
          subst = [subst];
        }
        return m.replace(/\$\d+\$/g, (r: string) => {
          const idx = parseInt(r.substr(1, r.length - 2), 10) - 1;
          return subst[idx] || "";
        });
      }
    };
  }
}

const i18n = load();
const memoGetMessage = memoize(i18n.getMessage, 10 * 1000, 0);

/**
 * Localize a message
 * @param {string} id Identifier of the string to localize
 * @param {string[]} [subst] Message substituations
 * @returns {string} Localized message
 */
function _(id: string, ...subst: any[]) {
  if (!subst.length) {
    return memoGetMessage(id);
  }
  if (subst.length === 1 && Array.isArray(subst[0])) {
    subst = subst.pop();
  }
  return i18n.getMessage(id, subst);
}

/**
 * Localize a DOM
 * @param {Element} elem DOM to localize
 * @returns {Element} Passed in element (fluent)
 */
function localize(elem: HTMLElement) {
  for (const el of elem.querySelectorAll<HTMLElement>("*[data-i18n]")) {
    const {i18n: i} = el.dataset;
    if (!i) {
      continue;
    }
    for (let piece of i.split(",")) {
      piece = piece.trim();
      if (!piece) {
        continue;
      }
      const idx = piece.indexOf("=");
      if (idx < 0) {
        let childElements;
        if (el.childElementCount) {
          childElements = Array.from(el.children);
        }
        el.textContent = _(piece);
        if (childElements) {
          childElements.forEach(e => el.appendChild(e));
        }
        continue;
      }
      const attr = piece.substr(0, idx).trim();
      piece = piece.substr(idx + 1).trim();
      el.setAttribute(attr, _(piece));
    }
  }
  for (const el of document.querySelectorAll("*[data-l18n]")) {
    console.error("wrong!", el);
  }
  return elem;
}


export {localize, _};
