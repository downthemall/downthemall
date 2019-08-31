"use strict";
// License: MIT

export function addClass(elem: HTMLElement, ...cls: string[]) {
  if (cls.length === 0) {
    elem.classList.add("virtualtable");
  }
  if (cls.length === 1) {
    elem.classList.add("virtualtable", `virtualtable-${cls[0]}`);
  }
  else {
    elem.classList.add("virtualtable", ...cls.map(c => `virtualtable-${c}`));
  }
}

interface Timer {
  args: any[];
  id: number;
}

export function debounce(fn: Function, to: number, reset?: boolean) {
  let timer: Timer | null;
  return function(...args: any[]) {
    if (timer) {
      if (!reset) {
        timer.args = args;
        return;
      }
      window.clearTimeout(timer.id);
    }
    const id = window.setTimeout(function() {
      if (!timer) {
        return;
      }
      const {args} = timer;
      timer = null;
      try {
        fn(...args);
      }
      catch (ex) {
        console.error(ex.toString(), ex);
      }
    }, to);
    timer = {args, id};
  };
}

function sumreduce(p: number, c: number) {
  return p + c;
}

export function sum(arr: number[]) {
  return arr.reduce(sumreduce, 0);
}

export function clampUInt(v: number, max?: number) {
  v = (v | 0) || 0;
  return Math.max(0, Math.min(max || Number.MAX_SAFE_INTEGER, v));
}

export const IS_MAC = typeof navigator !== "undefined" &&
  navigator.platform &&
  navigator.platform.includes("Mac");
