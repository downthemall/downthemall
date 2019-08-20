"use strict";
// License: MIT

export const QUEUED = 1 << 0;
export const RUNNING = 1 << 1;
export const FINISHING = 1 << 2;
export const PAUSED = 1 << 3;
export const DONE = 1 << 4;
export const CANCELED = 1 << 5;
export const MISSING = 1 << 6;

export const RESUMABLE = PAUSED | CANCELED;
export const FORCABLE = PAUSED | QUEUED | CANCELED;
export const PAUSABLE = QUEUED | CANCELED | RUNNING;
export const CANCELABLE = QUEUED | RUNNING | PAUSED | DONE | MISSING;
