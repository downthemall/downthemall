"use strict";
// License: MIT

const RE_TOKENIZE = /(0x[0-9a-f]+|[+-]?[0-9]+(?:\.[0-9]*(?:e[+-]?[0-9]+)?)?|\d+)/i;
const RE_HEX = /^0x[0-9a-z]+$/i;
const RE_TRIMMORE = /\s+/g;

type KeyFunc<T> = (v: T) => any;
type CompareFunc<T> = (a: T, b: T) => number;

/**
 * Compare two values using the usual less-than-greater-than rules
 * @param {*} a First value
 * @param {*} b Second value
 * @returns {number} Comparision result
 */
export function defaultCompare(a: any, b: any) {
  return a < b ? -1 : (a > b ? 1 : 0);
}


function parseToken(chunk: string) {
  chunk = chunk.replace(RE_TRIMMORE, " ").trim();
  if (RE_HEX.test(chunk)) {
    return parseInt(chunk.slice(2), 16);
  }
  const val = parseFloat(chunk);
  return Number.isNaN(val) ? chunk : val;
}

function filterTokens(str: string) {
  return str && str.trim();
}

function tokenize(val: any) {
  if (typeof val === "number") {
    return [[`${val}`], [val]];
  }
  const tokens = `${val}`.split(RE_TOKENIZE).filter(filterTokens);
  const numeric = tokens.map(parseToken);
  return [tokens, numeric];
}


/**
 * Natural Sort algorithm for es6
 * @param {*} a First term
 * @param {*} b Second term
 * @returns {Number} Comparison result
 */
export function naturalCompare(a: any, b: any): number {
  const [xTokens, xNumeric] = tokenize(a);
  const [yTokens, yNumeric] = tokenize(b);

  // natural sorting through split numeric strings and default strings
  const {length: xTokenLen} = xTokens;
  const {length: yTokenLen} = yTokens;
  const maxLen = Math.min(xTokenLen, yTokenLen);
  for (let i = 0; i < maxLen; ++i) {
    // find floats not starting with '0', string or 0 if not defined
    const xnum = xNumeric[i];
    const ynum = yNumeric[i];
    const xtype = typeof xnum;
    const xisnum = xtype === "number";
    const ytype = typeof ynum;
    const sameType = xtype === ytype;
    if (!sameType) {
      // Proper numbers go first.
      // We already checked sameType above, so we know only one is a number.
      return xisnum ? -1 : 1;
    }

    // sametype follows...
    if (xisnum) {
      // both are numbers
      // Compare the numbers and if they are the same, the tokens too
      const res = defaultCompare(xnum, ynum) ||
          defaultCompare(xTokens[i], yTokens[i]);
      if (!res) {
        continue;
      }
      return res;
    }

    // both must be stringey
    // Compare the actual tokens.
    const res = defaultCompare(xTokens[i], yTokens[i]);
    if (!res) {
      continue;
    }
    return res;
  }
  return defaultCompare(xTokenLen, yTokenLen);
}

/**
 * Natural Sort algorithm for es6, case-insensitive version
 * @param {*} a First term
 * @param {*} b Second term
 * @returns {Number} Comparison result
 */
export function naturalCaseCompare(a: any, b: any) {
  return naturalCompare(`${a}`.toUpperCase(), `${b}`.toUpperCase());
}

/**
 * Array-enabled compare: If both operands are an array, compare individual
 * elements up to the length of the smaller array. If all elements match,
 * consider the array with fewer items smaller
 * @param {*} a First item to compare (either PoD or Array)
 * @param {*} b Second item to compare (either PoD or Array)
 * @param {cmpf} [cmp] Compare function or default_compare
 * @returns {number} Comparison result
 */
export function arrayCompare(a: any, b: any, cmp: CompareFunc<any>): number {
  cmp = cmp || defaultCompare;
  if (Array.isArray(a) && Array.isArray(b)) {
    const {length: alen} = a;
    const {length: blen} = b;
    const len = Math.min(alen, blen);
    for (let i = 0; i < len; ++i) {
      const rv = arrayCompare(a[i], b[i], cmp);
      if (rv) {
        return rv;
      }
    }
    return defaultCompare(alen, blen);
  }
  return cmp(a, b);
}

interface MapValue {
  key: any;
  index: number;
  value: any;
}

function mappedCompare(
    fn: CompareFunc<any>, a: MapValue, b: MapValue): number {
  const {key: ka} = a;
  const {key: kb} = b;
  return arrayCompare(ka, kb, fn) ||
  /* stable */ defaultCompare(a.index, b.index);
}

/**
 * Tranform a given value into a key for sorting. Keys can be either PoDs or
 * an array of PoDs.
 * @callback keyfn
 * @param {*} item Array item to map
 * @returns {*} Key for sorting
 */

/**
 * Compare to items with each other, returning <0, 0, >0.
 * @callback cmpfn
 * @param {*} item Array item to map
 * @returns {number} Comparision result
 */

/**
 * Sort an array by a given key function and comparision function.
 * This sort is stable, but and in-situ
 * @param {*[]} arr Array to be sorted
 * @param {keyfn} [key] How to make keys. If ommitted, use value as key.
 * @param {cmpfn} [cmp] How to compare keys. If omitted, use default cmp.
 * @returns {*[]} New sorted array
 */
export function sort<T>(arr: T[], key?: KeyFunc<T>, cmp?: CompareFunc<T>) {
  cmp = cmp || defaultCompare;
  const carr = arr as unknown as MapValue[];
  if (key) {
    arr.forEach((value, index) => {
      carr[index] = {value, key: key(value), index};
    });
  }
  else {
    arr.forEach((value, index) => {
      carr[index] = {value, key: value, index};
    });
  }
  arr.sort(mappedCompare.bind(null, cmp));
  carr.forEach((i, idx) => {
    arr[idx] = i.value;
  });
  return arr;
}

/**
 * Sort an array by a given key function and comparision function.
 * This sort is stable, but NOT in-situ, it will rather leave the
 * original array untoched and return a sorted copy.
 * @param {*[]} arr Array to be sorted
 * @param {keyfn} [key] How to make keys. If ommitted, use value as key.
 * @param {cmpfn} [cmp] How to compare keys. If omitted, use default cmp.
 * @returns {*[]} New sorted array
 */
export function sorted<T>(arr: T[], key?: KeyFunc<T>, cmp?: CompareFunc<T>) {
  cmp = cmp || defaultCompare;
  let carr: MapValue[];
  if (key) {
    carr = arr.map((value, index) => {
      return {value, key: key(value), index};
    });
  }
  else {
    carr = arr.map((value, index) => {
      return {value, key: value, index};
    });
  }
  carr.sort(mappedCompare.bind(null, cmp));
  return carr.map(v => v.value);
}
