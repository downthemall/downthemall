"use strict";
// License: MIT

import { storage } from "./browser";

const STORAGE_KEY = "domainSettings";

export interface DomainSettings {
  type: string;
  activeFilters: string[];
  fast: string;
  onlyFast: boolean;
  mask: string;
  subfolder: string;
  autoApply: boolean;
}

export function getDomain(url?: string) {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  }
  catch (ex) {
    return null;
  }
}

export async function loadDomainSettings(domain: string) {
  const stored = await storage.local.get(STORAGE_KEY);
  const settings = stored && stored[STORAGE_KEY] &&
    stored[STORAGE_KEY][domain];
  if (!settings || typeof settings !== "object") {
    return null;
  }
  return {
    type: typeof settings.type === "string" ? settings.type : "links",
    activeFilters: Array.isArray(settings.activeFilters) ?
      settings.activeFilters.filter((id: any) => typeof id === "string") : [],
    fast: typeof settings.fast === "string" ? settings.fast : "",
    onlyFast: settings.onlyFast === true,
    mask: typeof settings.mask === "string" ? settings.mask : "",
    subfolder: typeof settings.subfolder === "string" ?
      settings.subfolder : "",
    autoApply: settings.autoApply === true,
  } as DomainSettings;
}

export async function saveDomainSettings(
  domain: string, settings: DomainSettings) {
  const stored = await storage.local.get(STORAGE_KEY);
  const domains = stored && stored[STORAGE_KEY] &&
    typeof stored[STORAGE_KEY] === "object" ? stored[STORAGE_KEY] : {};
  domains[domain] = settings;
  await storage.local.set({ [STORAGE_KEY]: domains });
}
