"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const polyfill = require("webextension-polyfill");

interface ExtensionListener {
  addListener: (listener: Function) => void;
  removeListener: (listener: Function) => void;
}

export interface MessageSender {
  readonly tab?: Tab;
  readonly frameId?: number;
  readonly id?: number;
  readonly url?: string;
  readonly tlsChannelId?: string;
}


export interface Tab {
  readonly id?: number;
  readonly incognito?: boolean;
}

export interface MenuClickInfo {
  readonly menuItemId: string | number;
  readonly button?: number;
  readonly linkUrl?: string;
  readonly srcUrl?: string;
}


export interface RawPort {
  readonly error: any;
  readonly name: string;
  readonly sender?: MessageSender;
  readonly onDisconnect: ExtensionListener;
  readonly onMessage: ExtensionListener;
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
  filename?: string;
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
  removeFile(manId: number): Promise<void>;
  readonly onCreated: ExtensionListener;
  readonly onChanged: ExtensionListener;
  readonly onErased: ExtensionListener;
  readonly onDeterminingFilename?: ExtensionListener;
}

interface WebRequest {
  readonly onBeforeSendHeaders: WebRequestListener;
  readonly onSendHeaders: WebRequestListener;
  readonly onHeadersReceived: WebRequestListener;
}

export interface OnInstalled {
  readonly reason: string;
  readonly previousVersion?: string;
  readonly temporary: boolean;
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
export const {theme} = polyfill;

export const CHROME = navigator.appVersion.includes("Chrome/");
export const OPERA = navigator.appVersion.includes("OPR/");
