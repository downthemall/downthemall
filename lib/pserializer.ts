"use strict";
// License: MIT

const RUNNING = Symbol();
const LIMIT = Symbol();
const ITEMS = Symbol();

function nothing() { /* ignored */ }

type Wrapped<T> = (...args: any[]) => Promise<T>;

interface Item {
  readonly ctx: any;
  readonly fn: Function;
  readonly args: any[];
  readonly resolve: Function;
  readonly reject: Function;
}

function scheduleDirect<T>(ctx: any, fn: Function, ...args: any[]): Promise<T> {
  try {
    const p = Promise.resolve(fn.call(ctx, ...args));
    this[RUNNING]++;
    p.finally(this._next).catch(nothing);
    return p;
  }
  catch (ex) {
    return Promise.reject(ex);
  }
}

function scheduleForLater<T>(
    head: boolean, ctx: any, fn: Function, ...args: any[]): Promise<T> {
  const rv = new Promise<T>((resolve, reject) => {
    const item = { ctx, fn, args, resolve, reject };
    this[ITEMS][head ? "unshift" : "push"](item);
  });
  return rv;
}

function scheduleInternal<T>(
    head: boolean, ctx: any, fn: Function, ...args: any[]): Promise<T> {
  if (this[RUNNING] < this.limit) {
    return scheduleDirect.call(this, ctx, fn, ...args);
  }
  return scheduleForLater.call(this, head, ctx, fn, ...args);
}

export class PromiseSerializer {
  private [LIMIT]: number;

  private [RUNNING]: number;

  private [ITEMS]: Item[];

  private readonly _next: () => void;

  constructor(limit: number) {
    this[LIMIT] = Math.max(limit || 5, 1);
    this[ITEMS] = [];
    this[RUNNING] = 0;
    this._next = this.next.bind(this);
    Object.seal(this);
  }

  get limit() {
    return this[LIMIT];
  }

  get running() {
    return this[RUNNING];
  }

  get scheduled() {
    return this[ITEMS].length;
  }

  get total() {
    return this.scheduled + this.running;
  }

  static wrapNew<T>(limit: number, ctx: any, fn: Function): Wrapped<T> {
    return new PromiseSerializer(limit).wrap(ctx, fn);
  }

  wrap<T>(ctx: any, fn: Function): Wrapped<T> {
    const rv = this.scheduleWithContext.bind(this, ctx, fn);
    Object.defineProperty(rv, "prepend", {
      value: this.prependWithContext.bind(this, ctx, fn)
    });
    return rv;
  }

  schedule<T>(fn: Wrapped<T>, ...args: any[]): Promise<T> {
    return this.scheduleWithContext(null, fn, ...args);
  }

  scheduleWithContext<T>(ctx: any, fn: Wrapped<T>, ...args: any[]): Promise<T> {
    return scheduleInternal.call(this, false, ctx, fn, ...args);
  }

  prepend<T>(fn: Wrapped<T>, ...args: any[]): Promise<T> {
    return this.prependWithContext(null, fn, ...args);
  }

  prependWithContext<T>(ctx: any, fn: Wrapped<T>, ...args: any[]): Promise<T> {
    return scheduleInternal.call(this, true, ctx, fn, ...args);
  }

  next() {
    this[RUNNING]--;
    const item = this[ITEMS].shift();
    if (!item) {
      return;
    }
    try {
      const p = Promise.resolve(item.fn.call(item.ctx, ...item.args));
      this[RUNNING]++;
      item.resolve(p);
      p.finally(this._next).catch(nothing);
    }
    catch (ex) {
      try {
        item.reject(ex);
      }
      finally {
        this.next();
      }
    }
  }
}
