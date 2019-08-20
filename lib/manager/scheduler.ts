"use strict";
// License: MIT

import { QUEUED } from "./state";
import { Limits } from "./limits";
import { filterInSitu } from "../util";
// eslint-disable-next-line no-unused-vars
import { Download } from "./download";

const REFILTER_COUNT = 50;

function queuedFilter(d: Download) {
  return d.state === QUEUED && !d.removed;
}

export class Scheduler {
  private runCount: number;

  private readonly queue: Download[];

  constructor(queue: Download[]) {
    this.queue = Array.from(queue).filter(queuedFilter);
    this.runCount = 0;
  }

  async next(running: Iterable<Download>) {
    if (!this.queue.length) {
      return null;
    }

    if (this.runCount > REFILTER_COUNT) {
      filterInSitu(this.queue, queuedFilter);
      if (!this.queue.length) {
        return null;
      }
    }

    const hosts = Object.create(null);
    for (const d of running) {
      const {domain} = d.uURL;
      if (domain in hosts) {
        hosts[domain]++;
      }
      else {
        hosts[domain] = 1;
      }
    }

    await Limits.load();
    for (const d of this.queue) {
      if (d.state !== QUEUED || d.removed) {
        continue;
      }
      const {domain} = d.uURL;
      const limit = Limits.getConcurrentFor(domain);
      const cur = hosts[domain] || 0;
      if (limit <= cur) {
        continue;
      }
      this.runCount++;
      return d;
    }
    return null;
  }

  destroy() {
    this.queue.length = 0;
  }
}
