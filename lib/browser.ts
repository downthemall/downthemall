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
  incognito?: boolean;
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

interface WebRequestFilter {
  urls?: string[];
}

interface WebRequestListener {
  addListener(
    callback: Function,
    filter: WebRequestFilter,
    extraInfoSpec: string[]
    ): void;
  removeListener(callback: Function): void;
}

type Header = {name: string; value: string};

export interface DownloadOptions {
  conflictAction: string;
  filename: string;
  saveAs: boolean;
  url: string;
  method?: string;
  body?: string;
  incognito?: boolean;
  headers: Header[];
}

export interface DownloadsQuery {
  id?: number;
}

interface Downloads {
  download(download: DownloadOptions): Promise<number>;
  open(manId: number): Promise<void>;
  show(manId: number): Promise<void>;
  pause(manId: number): Promise<void>;
  resume(manId: number): Promise<void>;
  cancel(manId: number): Promise<void>;
  erase(query: DownloadsQuery): Promise<void>;
  search(query: DownloadsQuery): Promise<any[]>;
  getFileIcon(id: number, options?: any): Promise<string>;
  setShelfEnabled(state: boolean): void;
  onCreated: ExtensionListener;
  onChanged: ExtensionListener;
  onErased: ExtensionListener;
}

interface WebRequest {
  onBeforeSendHeaders: WebRequestListener;
  onSendHeaders: WebRequestListener;
  onHeadersReceived: WebRequestListener;
}

export const {browserAction} = polyfill;
export const {contextMenus} = polyfill;
export const {downloads}: {downloads: Downloads} = polyfill;
export const {extension} = polyfill;
export const {history} = polyfill;
export const {menus} = polyfill;
export const {notifications} = polyfill;
export const {runtime} = polyfill;
export const {sessions} = polyfill;
export const {storage} = polyfill;
export const {tabs} = polyfill;
export const {webNavigation} = polyfill;
export const {webRequest}: {webRequest: WebRequest} = polyfill;
export const {windows} = polyfill;

export const CHROME = navigator.appVersion.includes("Chrome/");
