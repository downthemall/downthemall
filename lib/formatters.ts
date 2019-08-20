"use strict";
// License: MIT

import {_} from "./i18n";
import {memoize} from "./memoize";

export function formatInteger(num: number, digits?: number) {
  const neg = num < 0;
  const snum = Math.abs(num).toFixed(0);
  if (typeof digits === "undefined" || !isFinite(digits)) {
    digits = 3;
  }
  if (digits <= 0) {
    throw new Error("Invalid digit count");
  }
  if (snum.length >= digits) {
    return num.toFixed(0);
  }
  if (neg) {
    return `-${snum.padStart(digits, "0")}`;
  }
  return snum.padStart(digits, "0");
}

const HOURS_PER_DAY = 24;
const SEC_PER_MIN = 60;
const MIN_PER_HOUR = 60;
const SECS_PER_HOUR = SEC_PER_MIN * MIN_PER_HOUR;

export function formatTimeDelta(delta: number) {
  let rv = delta < 0 ? "-" : "";
  delta = Math.abs(delta);

  let h = Math.floor(delta / SECS_PER_HOUR);
  const m = Math.floor((delta % SECS_PER_HOUR) / SEC_PER_MIN);
  const s = Math.floor(delta % SEC_PER_MIN);

  if (h) {
    if (h >= HOURS_PER_DAY) {
      const days = Math.floor(h / HOURS_PER_DAY);
      if (days > 9) {
        return "∞";
      }
      rv += `${days}d::`;
      h %= HOURS_PER_DAY;
    }
    rv += `${formatInteger(h, 2)}:`;
  }
  return `${rv + formatInteger(m, 2)}:${formatInteger(s, 2)}`;
}

export function makeNumberFormatter(fracDigits: number) {
  const rv = new Intl.NumberFormat(undefined, {
    style: "decimal",
    useGrouping: false,
    minimumFractionDigits: fracDigits,
    maximumFractionDigits: fracDigits
  });
  return rv.format.bind(rv);
}


const fmt0 = makeNumberFormatter(0);
const fmt1 = makeNumberFormatter(1);
const fmt2 = makeNumberFormatter(2);
const fmt3 = makeNumberFormatter(3);

const SIZE_UNITS = [
  ["sizeB", fmt0],
  ["sizeKB", fmt1],
  ["sizeMB", fmt2],
  ["sizeGB", fmt2],
  ["sizeTB", fmt3],
  ["sizePB", fmt3],
];
const SIZE_NUINITS = SIZE_UNITS.length;
const SIZE_SCALE = 875;
const SIZE_KILO = 1024;

export const formatSize = memoize(function formatSize(
    size: number, fractions = true) {
  const neg = size < 0;
  size = Math.abs(size);
  let i = 0;
  while (size > SIZE_SCALE && ++i < SIZE_NUINITS) {
    size /= SIZE_KILO;
  }
  if (neg) {
    size = -size;
  }
  const [unit, fmt] = SIZE_UNITS[i];
  return _(unit, fractions ? fmt(size) : fmt0(size));
}, 1000, 2);

const SPEED_UNITS = [
  ["speedB", fmt0],
  ["speedKB", fmt2],
  ["speedMB", fmt2],
];
const SPEED_NUNITS = SIZE_UNITS.length;

export const formatSpeed = memoize(function formatSpeed(size: number) {
  const neg = size < 0;
  size = Math.abs(size);
  let i = 0;
  while (size > SIZE_KILO && ++i < SPEED_NUNITS) {
    size /= SIZE_KILO;
  }
  if (neg) {
    size = -size;
  }
  const [unit, fmt] = SPEED_UNITS[i];
  return _(unit, fmt(size));
});
