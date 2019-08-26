"use strict";
// License: MIT

import * as _DownloadState from "../../lib/manager/state";
import { _, locale } from "../../lib/i18n";

export const DownloadState = _DownloadState;

export const StateTexts = locale.then(() => Object.freeze(new Map([
  [DownloadState.QUEUED, _("queued")],
  [DownloadState.RUNNING, _("running")],
  [DownloadState.FINISHING, _("finishing")],
  [DownloadState.PAUSED, _("paused")],
  [DownloadState.DONE, _("done")],
  [DownloadState.CANCELED, _("canceled")],
  [DownloadState.MISSING, _("missing")],
])));

export const StateClasses = Object.freeze(new Map([
  [DownloadState.QUEUED, "queued"],
  [DownloadState.RUNNING, "running"],
  [DownloadState.FINISHING, "finishing"],
  [DownloadState.PAUSED, "paused"],
  [DownloadState.DONE, "done"],
  [DownloadState.CANCELED, "canceled"],
  [DownloadState.MISSING, "missing"],
]));

export const StateIcons = Object.freeze(new Map([
  [DownloadState.QUEUED, "icon-pause"],
  [DownloadState.RUNNING, "icon-go"],
  [DownloadState.FINISHING, "icon-go"],
  [DownloadState.PAUSED, "icon-pause"],
  [DownloadState.DONE, "icon-done"],
  [DownloadState.CANCELED, "icon-error"],
  [DownloadState.MISSING, "icon-failed"],
]));
