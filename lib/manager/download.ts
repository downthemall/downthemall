"use strict";
// License: MIT

import { Prefs } from "../prefs";
import { parsePath } from "../util";
import {
  QUEUED, RUNNING, CANCELED, PAUSED, MISSING, DONE,
  FORCABLE, PAUSABLE, CANCELABLE,
} from "./state";
import { BaseDownload } from "./basedownload";
import { PromiseSerializer } from "../pserializer";
// eslint-disable-next-line no-unused-vars
import { Manager } from "./man";
import { downloads } from "../browser";


const MAYBE_SERIALIZER = new PromiseSerializer(1);

const setShelfEnabled = downloads.setShelfEnabled || function() {
  // ignored
};

export class Download extends BaseDownload {
  public manager: Manager;

  public manId: number;

  public removed: boolean;

  public position: number;

  public error: string;

  constructor(manager: Manager, options: any) {
    super(options);
    this.manager = manager;
    if (this.manId) {
      MAYBE_SERIALIZER.schedule(() => this.maybeMissing());
    }
    this.start = MAYBE_SERIALIZER.wrap(this, this.start);
    this.removed = false;
    this.position = -1;
  }

  markDirty() {
    this.manager.setDirty(this);
  }

  changeState(newState: number) {
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }
    this.state = newState;
    this.error = "";
    this.manager.changedState(this, oldState, this.state);
    this.markDirty();
  }

  async start() {
    if (this.state !== QUEUED) {
      throw new Error("invalid state");
    }
    if (this.manId) {
      const {manId: id} = this;
      try {
        const state = await downloads.search({id});
        if (state[0].state === "in_progress") {
          this.changeState(RUNNING);
          this.updateStateFromBrowser();
          return;
        }
        if (!state[0].canResume) {
          throw new Error("Cannot resume");
        }
        // Cannot await here
        // Firefox bug: will not return until download is finished
        downloads.resume(id).catch(() => {});
        this.changeState(RUNNING);
        return;
      }
      catch (ex) {
        this.manager.removeManId(this.manId);
        this.removeFromBrowser();
      }
    }
    if (this.state !== QUEUED) {
      throw new Error("invalid state");
    }
    console.trace("starting", this.toString(), this.dest, this.mask);
    this.changeState(RUNNING);
    try {
      const options: any = {
        conflictAction: await Prefs.get("conflict-action"),
        filename: this.dest.full,
        saveAs: false,
        url: this.url,
        headers: [{
          name: "X-DTA-Tag",
          value: this.sessionId.toString(),
        }],
      };
      if (this.postData) {
        options.body = this.postData;
        options.method = "POST";
      }
      if (this.private) {
        options.incognito = true;
      }
      /* XXX "forbidden"
         Cannot be worked around with webRequest either
         as those do not see downloads.
      if (this.referrer) {
        options.headers.push({
          name: "Referer",
          value: this.referrer
        });
      }
      */
      if (this.manId) {
        this.manager.removeManId(this.manId);
      }
      setShelfEnabled(false);
      try {
        this.manager.addManId(
          this.manId = await downloads.download(options), this);
      }
      finally {
        setShelfEnabled(true);
      }
      this.markDirty();
    }
    catch (ex) {
      console.error("failed", ex.toString(), ex);
      this.changeState(CANCELED);
    }
  }

  resume(forced = false) {
    if (!(FORCABLE & this.state)) {
      return;
    }
    if (this.state !== QUEUED) {
      this.changeState(QUEUED);
    }
    if (forced) {
      this.manager.startDownload(this);
    }
  }

  async pause() {
    if (!(PAUSABLE & this.state)) {
      return;
    }
    if (this.state === RUNNING && this.manId) {
      try {
        await downloads.pause(this.manId);
      }
      catch (ex) {
        console.error("pause", ex.toString(), ex);
        return;
      }
    }
    this.changeState(PAUSED);
  }

  reset() {
    this.manId = 0;
    this.written = this.totalSize = 0;
    this.serverName = "";
  }

  async removeFromBrowser() {
    const {manId: id} = this;
    try {
      await downloads.cancel(id);
    }
    catch (ex) {
      // ingored
    }
    await new Promise(r => setTimeout(r, 1000));
    try {
      await downloads.erase({id});
    }
    catch (ex) {
      console.error(id, ex.toString(), ex);
      // ingored
    }
  }

  cancel() {
    if (!(CANCELABLE & this.state)) {
      return;
    }
    if (this.manId) {
      this.manager.removeManId(this.manId);
      this.removeFromBrowser();
    }
    this.reset();
    this.changeState(CANCELED);
  }

  setMissing() {
    if (this.manId) {
      this.manager.removeManId(this.manId);
      this.removeFromBrowser();
    }
    this.reset();
    this.changeState(MISSING);
  }

  async maybeMissing() {
    if (!this.manId) {
      return;
    }
    const {manId: id} = this;
    try {
      if (!(await downloads.search({id})).length) {
        this.setMissing();
      }
    }
    catch (ex) {
      console.error("oops", id, ex.toString(), ex);
      this.setMissing();
    }
  }

  adoptSize(state: any) {
    const {
      bytesReceived,
      totalBytes,
      fileSize
    } = state;
    this.written = Math.max(0, bytesReceived);
    this.totalSize = Math.max(0, fileSize >= 0 ? fileSize : totalBytes);
  }

  async updateStateFromBrowser() {
    try {
      const state = (await downloads.search({id: this.manId})).pop();
      const {filename, error} = state;
      const path = parsePath(filename);
      this.serverName = path.name;
      this.adoptSize(state);
      this.markDirty();
      switch (state.state) {
      case "in_progress":
        if (error) {
          this.cancel();
          this.error = error;
        }
        else {
          this.changeState(RUNNING);
        }
        break;

      case "interrupted":
        if (state.paused) {
          this.changeState(PAUSED);
        }
        else {
          this.cancel();
          this.error = error || "";
        }
        break;

      case "complete":
        this.changeState(DONE);
        break;
      }
    }
    catch (ex) {
      console.error("failed to handle state", ex.toString(), ex.stack, ex);
      this.setMissing();
    }
  }
}
