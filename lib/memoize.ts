"use strict";
// License: MIT

const DEFAULT_LIMIT = 3000;

let memoes: any[] = [];

export function filterCaches(c: any) {
  if (!c) {
    return false;
  }
  c.clear();
  return true;
}

export function clearCaches() {
  memoes = memoes.filter(filterCaches);
}

type MemoizeFun<T> = (...args: any[]) => T;

/**
 * Decorate a function with a memoization wrapper, with a limited-size cache
 * to reduce peak memory utilization.
 *
 * The memoized function may have any number of arguments, but they must be
 * be serializable.  It's safest to use this only on functions that accept
 * primitives.
 *
 * A memoized function is not thread-safe, but so is JS,  nor re-entrant-safe!
 *
 * @param {Function} func The function to be memoized
 * @param {Number} [limit] Optional. Cache size (default: 3000)
 * @param {Number} [numArgs] Options. Number of arguments the function expects
 * (default: func.length)
 * @returns {Function} Memoized function
 */
export function memoize<T>(
    func: MemoizeFun<T>, limit?: number, numArgs?: number): MemoizeFun<T> {
  const climit = limit && limit > 0 ? limit : DEFAULT_LIMIT;
  numArgs = numArgs || func.length;

  const cache = new Map();
  memoes.push(cache);
  const keylist: any[] = [];
  const args: any[] = [];
  let key; let result;

  switch (numArgs) {
  case 0:
    throw new Error("memoize does not support functions without arguments");

  case 1:
    return function memoizeOne(a: any) {
      key = a.spec || a;
      if (cache.has(key)) {
        return cache.get(key);
      }

      result = func(a);
      cache.set(key, result);
      if (keylist.push(key) > climit) {
        cache.delete(keylist.shift());
      }
      return result;
    };

  case 2:
    return function memoizeTwo(a: any, b: any) {
      args[0] = a; args[1] = b;
      key = JSON.stringify(args);
      args.length = 0;

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(a, b);
      cache.set(key, result);
      if (keylist.push(key) > climit) {
        cache.delete(keylist.shift());
      }
      return result;
    };

  case 3:
    return function memoizeThree(a: any, b: any, c: any) {
      args[0] = a; args[1] = b; args[2] = c;
      key = JSON.stringify(args);
      args.length = 0;

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(a, b, c);
      cache.set(key, result);
      if (keylist.push(key) > climit) {
        cache.delete(keylist.shift());
      }
      return result;
    };

  case 4:
    return function memoizeFour(a: any, b: any, c: any, d: any) {
      args[0] = a; args[1] = b; args[2] = c; args[3] = d;
      key = JSON.stringify(args);
      args.length = 0;

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(a, b, c, d);
      cache.set(key, result);
      if (keylist.push(key) > climit) {
        cache.delete(keylist.shift());
      }
      return result;
    };

  default:
    return function(...args: any[]) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(...args);
      cache.set(key, result);
      if (keylist.push(key) > climit) {
        cache.delete(keylist.shift());
      }
      return result;
    };
  }
}


export const identity = memoize(function(o: any) {
  return o;
});
