"use strict";
// License: MIT

// eslint-disable-next-line no-unused-vars
import { CHROME, downloads, DownloadOptions } from "../browser";
import { Prefs, PrefWatcher } from "../prefs";
import { PromiseSerializer } from "../pserializer";
import { filterInSitu, parsePath } from "../util";
import { BaseDownload } from "./basedownload";
// eslint-disable-next-line no-unused-vars
import { Manager } from "./man";
import Renamer from "./renamer";
import {
  CANCELABLE,
  CANCELED,
  DONE,
  FORCABLE,
  MISSING,
  PAUSEABLE,
  PAUSED,
  QUEUED,
  RUNNING,
  RETRYING
} from "./state";
// eslint-disable-next-line no-unused-vars
import { Preroller, PrerollResults } from "./preroller";

function isRecoverable(error: string) {
  switch (error) {
  case "SERVER_FAILED":
    return true;

  default:
    return error.startsWith("NETWORK_");
  }
}

const RETRIES = new PrefWatcher("retries", 5);
const RETRY_TIME = new PrefWatcher("retry-time", 5);

export class Download extends BaseDownload {
  public manager: Manager;

  public manId: number;

  public removed: boolean;

  public position: number;

  public error: string;

  public dbId: number;

  public deadline: number;

  constructor(manager: Manager, options: any) {
    super(options);
    this.manager = manager;
    this.start = PromiseSerializer.wrapNew(1, this, this.start);
    this.removed = false;
    this.position = -1;
  }

  markDirty() {
    this.renamer = new Renamer(this);
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
        const state = (await downloads.search({id})).pop() || {};
        if (state.state === "in_progress" && !state.error && !state.paused) {
          this.changeState(RUNNING);
          this.updateStateFromBrowser();
          return;
        }
        if (state.state === "complete") {
          this.changeState(DONE);
          this.updateStateFromBrowser();
          return;
        }
        if (!state.canResume) {
          throw new Error("Cannot resume");
        }
        // Cannot await here
        // Firefox bug: will not return until download is finished
        downloads.resume(id).catch(console.error);
        this.changeState(RUNNING);
        return;
      }
      catch (ex) {
        console.error("cannot resume", ex);
        this.manager.removeManId(this.manId);
        this.removeFromBrowser();
      }
    }
    if (this.state !== QUEUED) {
      throw new Error("invalid state");
    }
    console.log("starting", this.toString(), this.toMsg());
    this.changeState(RUNNING);

    // Do NOT await
    this.reallyStart();
  }

  private async reallyStart() {
    try {
      if (!this.prerolled) {
        await this.maybePreroll();
        if (this.state !== RUNNING) {
          // Aborted by preroll
          return;
        }
      }
      const options: DownloadOptions = {
        conflictAction: await Prefs.get("conflict-action"),
        saveAs: false,
        url: this.url,
        headers: [],
      };
      if (!CHROME) {
        options.filename = this.dest.full;
      }
      if (!CHROME && this.private) {
        options.incognito = true;
      }
      if (this.postData) {
        options.body = this.postData;
        options.method = "POST";
      }
      if (!CHROME && this.referrer) {
        options.headers.push({
          name: "Referer",
          value: this.referrer
        });
      }
      else if (CHROME) {
        options.headers.push({
          name: "X-DTA-ID",
          value: this.sessionId.toString(),
        });
      }
      if (this.manId) {
        this.manager.removeManId(this.manId);
      }

      try {
        this.manager.addManId(
          this.manId = await downloads.download(options), this);
      }
      catch (ex) {
        if (!this.referrer) {
          throw ex;
        }
        // Re-attempt without referrer
        filterInSitu(options.headers, h => h.name !== "Referer");
        this.manager.addManId(
          this.manId = await downloads.download(options), this);
      }
      this.markDirty();
    }
    catch (ex) {
      console.error("failed to start download", ex.toString(), ex);
      this.changeState(CANCELED);
      this.error = ex.toString();
    }
  }

  private async maybePreroll() {
    try {
      if (this.prerolled) {
        // Check again, just in case, async and all
        return;
      }
      const roller = new Preroller(this);
      if (!roller.shouldPreroll) {
        return;
      }
      const res = await roller.roll();
      if (!res) {
        return;
      }
      this.adoptPrerollResults(res);
    }
    catch (ex) {
      console.error("Failed to preroll", this, ex.toString(), ex.stack, ex);
    }
    finally {
      if (this.state === RUNNING) {
        this.prerolled = true;
        this.markDirty();
      }
    }
  }

  adoptPrerollResults(res: PrerollResults) {
    if (res.mime) {
      this.mime = res.mime;
    }
    if (res.name) {
      this.serverName = res.name;
    }
    if (res.error) {
      this.cancelAccordingToError(res.error);
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

  async pause(retry?: boolean) {
    if (!(PAUSEABLE & this.state)) {
      return;
    }

    if (!retry) {
      this.retries = 0;
      this.deadline = 0;
    }
    else {
      // eslint-disable-next-line no-magic-numbers
      this.deadline = Date.now() + RETRY_TIME.value * 60 * 1000;
    }

    if (this.state === RUNNING && this.manId) {
      try {
        await downloads.pause(this.manId);
      }
      catch (ex) {
        console.error("pause", ex.toString(), ex);
        this.cancel();
        return;
      }
    }

    this.changeState(retry ? RETRYING : PAUSED);
  }

  reset() {
    this.prerolled = false;
    this.manId = 0;
    this.written = this.totalSize = 0;
    this.mime = this.serverName = this.browserName = "";
    this.retries = 0;
    this.deadline = 0;
  }

  async removeFromBrowser() {
    const {manId: id} = this;
    try {
      await downloads.cancel(id);
    }
    catch (ex) {
      // ignored
    }
    await new Promise(r => setTimeout(r, 1000));
    try {
      await downloads.erase({id});
    }
    catch (ex) {
      console.error(id, ex.toString(), ex);
      // ignored
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

  async cancelAccordingToError(error: string) {
    if (!isRecoverable(error) || ++this.retries > RETRIES.value) {
      this.cancel();
      this.error = error;
      return;
    }

    await this.pause(true);
    this.error = error;
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
      return null;
    }
    const {manId: id} = this;
    try {
      const dls = await downloads.search({id});
      if (!dls.length) {
        this.setMissing();
        return this;
      }
    }
    catch (ex) {
      console.error("oops", id, ex.toString(), ex);
      this.setMissing();
      return this;
    }
    return null;
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
      this.browserName = path.name;
      this.adoptSize(state);
      if (!this.mime && state.mime) {
        this.mime = state.mime;
      }
      this.markDirty();
      switch (state.state) {
      case "in_progress":
        if (state.paused) {
          this.changeState(PAUSED);
        }
        else if (error) {
          this.cancelAccordingToError(error);
        }
        else {
          this.changeState(RUNNING);
        }
        break;

      case "interrupted":
        if (state.paused) {
          this.changeState(PAUSED);
        }
        else if (error) {
          this.cancelAccordingToError(error);
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

  updateFromSuggestion(state: any) {
    const res: PrerollResults = {};
    if (state.mime) {
      res.mime = state.mime;
    }
    if (state.filename) {
      res.name = state.filename;
    }
    if (state.finalUrl) {
      res.finalURL = state.finalUrl;
      const detected = Preroller.maybeFindNameFromSearchParams(this, res);
      if (detected) {
        res.name = detected;
      }
    }
    try {
      this.adoptPrerollResults(res);
    }
    finally {
      this.markDirty();
    }
  }
}
