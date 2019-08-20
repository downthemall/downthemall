"use strict";
// License: MIT

const RUN = Symbol();

interface Queued {
  ctx: any;
  fn: Function;
  args: any[];
}

/**
 * Our fine little animation pool: pooling requestAnimationFrame calls.
 * @class
 */
export class AnimationPool {
  private items: Queued[];

  private promise?: Promise<void>;

  private resolve?: Function;

  constructor() {
    this.items = [];
    this.promise = undefined;
    this.resolve = undefined;
    this[RUN] = this[RUN].bind(this);
    Object.seal(this);
  }

  [RUN]() {
    try {
      while (this.items.length) {
        const items = Array.from(this.items);
        this.items.length = 0;
        for (const item of items) {
          try {
            item.fn.call(item.ctx, ...item.args);
          }
          catch (ex) {
            console.error(item, ex.toString(), ex);
          }
        }
      }
    }
    finally {
      const {resolve} = this;
      this.items.length = 0;
      this.promise = undefined;
      this.resolve = undefined;
      if (resolve) {
        resolve();
      }
    }
  }

  /**
   * Schedule a call once.
   *
   * @param {Object} ctx
   *   Your this to your function.
   * @param {function} fn
   *   The function to execute within an animation frame.
   * @param {*} args
   *   Any args you want to pass to your function
   *
   * @returns {Promise}
   *   Animation Frame Request resolution
   */
  schedule(ctx: any, fn: Function, ...args: any[]) {
    this.items.push({ ctx, fn, args });
    if (!this.promise) {
      this.promise = new Promise(resolve => {
        this.resolve = resolve;
      });
      requestAnimationFrame(this[RUN]);
    }
    return this.promise;
  }

  /**
   * Bind a function to a context (this) and some arguments.
   * The bound function will then always execute within an animation frame and
   * is therefore called asynchronous and does only return a request ID.
   *
   * @param {Object} ctx
   *   Your this to your function.
   * @param {function} fn
   *   The function to execute within an animation frame:
   * @param {*} args
   *   Any args you want to pass to your function, it's possible to call the
   *   wrapped function with additional arguments.
   *
   * @returns {function}
   *   Your newly bound function.
   *
   * @see AnimationPool.schedule
   */
  bind(ctx: any, fn: Function, ...args: any[]) {
    return this.schedule.bind(this, ctx, fn, ...args);
  }

  /**
   * Wrap a function.
   * The bound function will then always execute within an animation frame and
   * is therefore called asynchronous and does not return a value.
   * |this| within your function will not be modified.
   *
   * @param {function} fn
   *   The function to execute within an animation frame.
   *
   * @returns {function(*)}
   *   Your newly bound function.
   */
  wrap(fn: Function) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return function wrapped(...args: any[]) {
      return self.schedule(this, fn, ...args);
    };
  }
}

export const APOOL = new AnimationPool();
