"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const polyfill = require("webextension-polyfill");

interface ExtensionListener {
  addListener: (listener: Function) => void;
  removeListener: (listener: Function) => void;
}

export interface MessageSender {
  tab?: Tab;
  frameId?: number;
  id?: number;
  url?: string;
  tlsChannelId?: string;
}


export interface Tab {
  id?: number;
}

export interface MenuClickInfo {
  menuItemId: string | number;
  button?: number;
  linkUrl?: string;
  srcUrl?: string;
}


export interface RawPort {
  error: any;
  name: string;
  onDisconnect: ExtensionListener;
  onMessage: ExtensionListener;
  sender?: MessageSender;
  disconnect: () => void;
  postMessage: (message: any) => void;
}

export const {extension} = polyfill;
export const {notifications} = polyfill;
export const {browserAction} = polyfill;
export const {contextMenus} = polyfill;
export const {downloads} = polyfill;
export const {menus} = polyfill;
export const {runtime} = polyfill;
export const {storage} = polyfill;
export const {tabs} = polyfill;
export const {webNavigation} = polyfill;
export const {windows} = polyfill;

export const CHROME = navigator.appVersion.includes("Chrome/");
