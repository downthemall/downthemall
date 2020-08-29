"use strict";
// License: MIT

export const QUEUED = 1 << 0;
export const RUNNING = 1 << 1;
export const FINISHING = 1 << 2;
export const PAUSED = 1 << 3;
export const DONE = 1 << 4;
export const CANCELED = 1 << 5;
export const MISSING = 1 << 6;
export const RETRYING = 1 << 7;

export const RESUMABLE = PAUSED | CANCELED | RETRYING;
export const FORCABLE = PAUSED | QUEUED | CANCELED | RETRYING;
export const PAUSEABLE = QUEUED | CANCELED | RUNNING | RETRYING;
export const CANCELABLE = QUEUED | RUNNING | PAUSED | DONE | MISSING | RETRYING;
