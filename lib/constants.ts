"use strict";
// License: MIT

export const ALLOWED_SCHEMES = Object.freeze(new Set<string>([
  "http:",
  "https:",
  "ftp:",
]));

export const TRANSFERABLE_PROPERTIES = Object.freeze([
  "fileName",
  "title",
  "description"
]);

export const TYPE_LINK = 1;
export const TYPE_MEDIA = 2;
export const TYPE_ALL = 3;
