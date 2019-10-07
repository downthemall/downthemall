"use strict";
// License: MIT

const EventKeys = Symbol();

/**
 * Yis, yet another event emitter implementation!
 */
export class EventEmitter {
  private [EventKeys]: Map<string, Set<Function>>;

  constructor() {
    this[EventKeys] = new Map();
  }

  /**
   * Listen to events.
   *
   * @param {string} event
   *   Event type to which to listen.
   * @param {function(...args)} cb
   *   Your callback to execute when an event is emitted. Should return a
   *   boolean-ey value some emitters can use to determine if the event was
   *   handled and act accordingly.
   */
  on(event: string, cb: (...args: any[]) => any) {
    let handlers = this[EventKeys].get(event);
    if (!handlers) {
      this[EventKeys].set(event, handlers = new Set<Function>());
    }
    handlers.add(cb);
  }

  /**
   * Remove your listener again
   *
   * @param {string} event
   *   Event type to which to not listen anymore.
   * @param {function(...args)} cb
   *   Your callback as you previously registered with the emitter.
   */
  off(event: string, cb: Function) {
    const keys = this[EventKeys];
    const handlers = keys.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(cb);
    if (!handlers.size) {
      keys.delete(event);
    }
  }

  /**
   * Listen to an event, but only once, next time it is fired.
   * @see EventEmitter.on
   *
   * @param {string} event
   *   Event type to which to listen once.
   * @param {function(...args)} cb
   *   Your callback to execute when an event is emitted.
   */
  once(event: string, cb: (...args: any[]) => any) {
    const wrapped = (...args: any[]) => {
      try {
        // eslint-disable-next-line prefer-spread
        return cb.apply(null, args);
      }
      finally {
        this.off(event, wrapped);
      }
    };
    this.on(event, wrapped);
  }

  /**
   * Check if some event has listeners.
   *
   * @param {string} event
   * @returns {boolean}
   */
  hasListeners(event: string) {
    return this[EventKeys].has(event);
  }

  /**
   * Emits an event, calling all registered listeners with the provided
   * arguments.
   *
   * @param {string} event
   *   Event type to emit.
   * @param {*} args
   *   Arguments to pass to listeners.
   *
   * @returns {boolean}
   *   Whether one or more listeners indicated they handled the event.
   */
  emit(event: string, ...args: any[]) {
    let handled = false;
    const handlers = this[EventKeys].get(event);
    if (!handlers) {
      return handled;
    }
    for (const e of Array.from(handlers)) {
      try {
        // eslint-disable-next-line prefer-spread
        handled = !!e.apply(null, args) || handled;
      }
      catch (ex) {
        console.error(`Event handler ${e} for ${event} failed`, ex.toString(), ex.stack, ex);
      }
    }
    return handled;
  }

  /**
   * Emits an event, but not just now.
   * @see EventEmitter.emit
   *
   * @param {string} event
   * @param {*} args
   */
  emitSoon(event: string, ...args: any[]) {
    setTimeout(() => this.emit(event, ...args));
  }
}
