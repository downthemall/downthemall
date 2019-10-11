"use strict";
// License: MIT

import { donate, openPrefs } from "../windowutils";
import { API } from "../api";
// eslint-disable-next-line no-unused-vars
import { BaseDownload } from "./basedownload";
// eslint-disable-next-line no-unused-vars
import { Manager } from "./man";
// eslint-disable-next-line no-unused-vars
import { Port } from "../bus";
// eslint-disable-next-line no-unused-vars
import { BaseItem } from "../item";

type SID = {sid: number};
type SIDS = {
  sids: number[];
  forced?: boolean;
};

export class ManagerPort {
  private manager: Manager;

  private port: Port;

  constructor(manager: any, port: any) {
    this.manager = manager;
    this.port = port;

    this.onDirty = this.onDirty.bind(this);
    this.onRemoved = this.onRemoved.bind(this);
    this.onMsgRemoveSids = this.onMsgRemoveSids.bind(this);

    this.manager.on("inited", () => this.sendAll());
    this.manager.on("dirty", this.onDirty);
    this.manager.on("removed", this.onRemoved);
    this.manager.on("active", (active: any) => {
      this.port.post("active", active);
    });

    port.on("donate", () => {
      donate();
    });
    port.on("prefs", () => {
      openPrefs();
    });
    port.on("import", ({items}: {items: BaseItem[]}) => {
      API.regular(items, []);
    });
    port.on("all", () => this.sendAll());
    port.on("removeSids", this.onMsgRemoveSids);
    port.on("showSingle", async () => {
      await API.singleRegular(null);
    });
    port.on("toggle-active", () => {
      this.manager.toggleActive();
    });
    port.on("sorted", ({sids}: SIDS) => this.manager.sorted(sids));
    port.on("resume",
      ({sids, forced}: SIDS) => this.manager.resumeDownloads(sids, forced));
    port.on("pause", ({sids}: SIDS) => this.manager.pauseDownloads(sids));
    port.on("cancel", ({sids}: SIDS) => this.manager.cancelDownloads(sids));
    port.on("missing", ({sid}: SID) => this.manager.setMissing(sid));

    this.port.on("disconnect", () => {
      this.manager.off("dirty", this.onDirty);
      this.manager.off("removed", this.onRemoved);

      port.off("removeSids", this.onMsgRemoveSids);
      delete this.manager;
      delete this.port;
    });

    this.port.post("active", this.manager.active);
    this.sendAll();
  }

  onDirty(items: BaseDownload[]) {
    this.port.post("dirty", items.map(item => item.toMsg()));
  }

  onRemoved(sids: number[]) {
    this.port.post("removed", sids);
  }

  onMsgRemoveSids({sids}: SIDS) {
    this.manager.removeBySids(sids);
  }

  sendAll() {
    this.port.post("all", this.manager.getMsgItems());
  }
}
