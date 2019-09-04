"use strict";
// License: MIT

import { EventEmitter } from "../events";
import { Notification } from "../notifications";
import { DB } from "../db";
import { QUEUED, CANCELED, RUNNING } from "./state";
// eslint-disable-next-line no-unused-vars
import { Bus, Port } from "../bus";
import { sort } from "../sorting";
import { Prefs } from "../prefs";
import { _ } from "../i18n";
import { CoalescedUpdate, mapFilterInSitu, filterInSitu } from "../util";
import { PromiseSerializer } from "../pserializer";
import { Download } from "./download";
import { ManagerPort } from "./port";
import { Scheduler } from "./scheduler";
import { Limits } from "./limits";
import { downloads, runtime } from "../browser";


const AUTOSAVE_TIMEOUT = 2000;
const DIRTY_TIMEOUT = 100;
// eslint-disable-next-line no-magic-numbers
const MISSING_TIMEOUT = 12 * 1000;
const RELOAD_TIMEOUT = 10 * 1000;


export class Manager extends EventEmitter {
  private items: Download[];

  public active: boolean;

  private notifiedFinished: boolean;

  private readonly saveQueue: CoalescedUpdate<Download>;

  private readonly dirty: CoalescedUpdate<Download>;

  private readonly sids: Map<number, Download>;

  private readonly manIds: Map<number, Download>;

  private readonly ports: Set<ManagerPort>;

  private readonly running: Set<Download>;

  private scheduler: Scheduler | null;

  private shouldReload: boolean;

  constructor() {
    super();
    this.active = true;
    this.shouldReload = false;
    this.notifiedFinished = true;
    this.items = [];
    this.saveQueue = new CoalescedUpdate(
      AUTOSAVE_TIMEOUT, this.save.bind(this));
    this.dirty = new CoalescedUpdate(
      DIRTY_TIMEOUT, this.processDirty.bind(this));
    this.sids = new Map();
    this.manIds = new Map();
    this.ports = new Set();
    this.scheduler = null;
    this.running = new Set();

    this.startNext = PromiseSerializer.wrapNew(1, this, this.startNext);

    downloads.onChanged.addListener(this.onChanged.bind(this));
    downloads.onErased.addListener(this.onErased.bind(this));

    Bus.onPort("manager", (port: Port) => {
      const mport = new ManagerPort(this, port);
      port.on("disconnect", () => {
        this.ports.delete(mport);
      });
      this.ports.add(mport);
    });
    Limits.on("changed", () => {
      this.resetScheduler();
    });
  }

  async init() {
    const items = await DB.getAll();
    items.forEach((i: any, idx: number) => {
      const rv = new Download(this, i);
      rv.position = idx;
      this.sids.set(rv.sessionId, rv);
      if (rv.manId) {
        this.manIds.set(rv.manId, rv);
      }
      this.items.push(rv);
    });

    // Do not wait for the scheduler
    this.resetScheduler();

    this.emit("inited");
    setTimeout(() => this.checkMissing(), MISSING_TIMEOUT);
    runtime.onUpdateAvailable.addListener(() => {
      if (this.running.size) {
        this.shouldReload = true;
        return;
      }
      runtime.reload();
    });
    return this;
  }

  async checkMissing() {
    const serializer = new PromiseSerializer(2);
    const missing = await Promise.all(this.items.map(
      item => serializer.scheduleWithContext(item, item.maybeMissing)));
    if (!(await Prefs.get("remove-missing-on-init"))) {
      return;
    }
    this.remove(filterInSitu(missing, e => !!e));
  }

  onChanged(changes: {id: number}) {
    const item = this.manIds.get(changes.id);
    if (!item) {
      return;
    }
    item.updateStateFromBrowser();
  }

  onErased(downloadId: number) {
    const item = this.manIds.get(downloadId);
    if (!item) {
      return;
    }
    item.setMissing();
    this.manIds.delete(downloadId);
  }

  async resetScheduler() {
    this.scheduler = null;
    await this.startNext();
  }

  async startNext() {
    if (!this.active) {
      return;
    }
    while (this.running.size < Limits.concurrent) {
      if (!this.scheduler) {
        this.scheduler = new Scheduler(this.items);
      }
      const next = await this.scheduler.next(this.running);
      if (!next) {
        this.maybeNotifyFinished();
        break;
      }
      if (this.running.has(next) || next.state !== QUEUED) {
        continue;
      }
      try {
        await this.startDownload(next);
      }
      catch (ex) {
        next.changeState(CANCELED);
        next.error = ex.toString();
        console.error(ex.toString(), ex);
      }
    }
  }

  async startDownload(download: Download) {
    // Add to running first, so we don't confuse the scheduler and other parts
    this.running.add(download);
    await download.start();
    this.notifiedFinished = false;
  }

  async maybeNotifyFinished() {
    if (!(await Prefs.get("finish-notification"))) {
      return;
    }
    if (this.notifiedFinished || this.running.size) {
      return;
    }
    this.notifiedFinished = true;
    new Notification(null, _("queue-finished"));
    if (this.shouldReload) {
      setTimeout(() => {
        if (this.running.size) {
          return;
        }
        runtime.reload();
      }, RELOAD_TIMEOUT);
    }
  }

  addManId(id: number, download: Download) {
    this.manIds.set(id, download);
  }

  removeManId(id: number) {
    this.manIds.delete(id);
  }

  addNewDownloads(items: any[]) {
    if (!items || !items.length) {
      return;
    }
    items = items.map(i => {
      const dl = new Download(this, i);
      dl.position = this.items.push(dl) - 1;
      this.sids.set(dl.sessionId, dl);
      dl.markDirty();
      return dl;
    });

    Prefs.get("nagging", 0).
      then(v => {
        return Prefs.set("nagging", (v || 0) + items.length);
      }).
      catch(console.error);

    this.scheduler = null;
    this.save(items);
    this.startNext();
  }

  setDirty(item: Download) {
    this.dirty.add(item);
  }

  removeDirty(item: Download) {
    this.dirty.delete(item);
  }

  processDirty(items: Download[]) {
    items = items.filter(i => !i.removed);
    items.forEach(item => this.saveQueue.add(item));
    this.emit("dirty", items);
  }

  private save(items: Download[]) {
    DB.saveItems(items.filter(i => !i.removed)).
      catch(console.error);
  }

  setPositions() {
    const items = this.items.filter((e, idx) => {
      if (e.position === idx) {
        return false;
      }
      e.position = idx;
      e.markDirty();
      return true;
    });
    if (!items.length) {
      return;
    }
    this.save(items);
    this.resetScheduler();
  }

  forEach(sids: number[], cb: (item: Download) => void) {
    sids.forEach(sid => {
      const download = this.sids.get(sid);
      if (!download) {
        return;
      }
      cb.call(this, download);
    });
  }

  resumeDownloads(sids: number[], forced = false) {
    this.forEach(sids, download => download.resume(forced));
  }

  pauseDownloads(sids: number[]) {
    this.forEach(sids, download => download.pause());
  }

  cancelDownloads(sids: number[]) {
    this.forEach(sids, download => download.cancel());
  }

  setMissing(sid: number) {
    this.forEach([sid], download => download.setMissing());
  }

  changedState(download: Download, oldState: number, newState: number) {
    if (oldState === RUNNING) {
      this.running.delete(download);
    }
    if (newState === QUEUED) {
      this.resetScheduler();
      this.startNext().catch(console.error);
    }
    else if (newState === RUNNING) {
      // Usually we already added it. Buit if a user uses the built-in
      // download manager to resart
      // a download, we have not, so make sure it is added either way
      this.running.add(download);
    }
    else {
      this.startNext().catch(console.error);
    }
  }

  sorted(sids: number[]) {
    try {
      // Construct new items
      const csids = new Map(this.sids);
      let items = mapFilterInSitu(sids, sid => {
        const item = csids.get(sid);
        if (!item) {
          return null;
        }
        csids.delete(sid);
        return item;
      }, e => !!e);
      if (csids.size) {
        items = items.concat(sort(Array.from(csids.values()), i => i.position));
      }
      this.items = items;
      this.setPositions();
    }
    catch (ex) {
      console.error("sorted", "sids", sids, "ex", ex.message, ex);
    }
  }

  remove(items: Download[]) {
    if (!items.length) {
      return;
    }
    items.forEach(item => {
      item.removed = true;
      if (!item.manId) {
        return;
      }
      this.removeManId(item.manId);
      item.cancel();
    });
    DB.deleteItems(items).then(() => {
      const sids = items.map(item => item.sessionId);
      sids.forEach(sid => this.sids.delete(sid));
      sort(items.map(item => item.position)).
        reverse().
        forEach(idx => this.items.splice(idx, 1));
      this.emit("removed", sids);
      this.setPositions();
      this.resetScheduler();
    }).catch(console.error);
  }

  removeBySids(sids: number[]) {
    const items = mapFilterInSitu(sids, sid => this.sids.get(sid), e => !!e);
    return this.remove(items);
  }

  toggleActive() {
    this.active = !this.active;
    if (this.active) {
      this.startNext();
    }
    this.emit("active", this.active);
  }

  getMsgItems() {
    return this.items.map(e => e.toMsg());
  }
}

let inited: Promise<Manager>;

export function getManager() {
  if (!inited) {
    const man = new Manager();
    inited = man.init();
  }
  return inited;
}
