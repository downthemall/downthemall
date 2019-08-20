/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: MIT

/**
 * Pre-author complex (XRegExp) regexps
 * The main idea here is to avoid shipping XRegExp itself
 */

const XRegExp = require("xregexp");

RegExp.prototype.toJSON = function() {
  return {
    source: this.source,
    flags: this.flags
  };
};

const textlinks = new XRegExp(
  // eslint-disable-next-line max-len
  "\\b(?:(?:h(?:x+|tt)?ps?|f(?:x+|t)p):\\/\\/(?:[\\pL\\pN\\pS]+?:[\\pL\\pN\\pS]+?@)?|www\\d?\\.)" +
  "[\\d\\w.-]+\\.?(?:\\/[\\p{N}\\p{L}\\pP\\pS]*)?",
  "giu");

console.log(JSON.stringify({
  textlinks
}));
