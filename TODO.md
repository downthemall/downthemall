TODO
---

P2
===

Planned for later.

* Inter-addon API (basic)
  * Add downloads
* vtable perf: cache column widths
* Download options
  * This is a bit more limited, as we cannot modify options of downloads that have been started (and paused) or that are done.

P3
===

Nice-to-haves.

* Landing Page v4
* Drag-n-drop ordering
* Drag-n-drop files
* Inter-addon API (hooks)
  * Manipulate downloads (e.g. rewrite URLs)
* Native context menus?
  * Would require massive reworks incl the need for new icon formats, but potentially feasible.
* Download priorities (manual scheduling overrides)
* Remove `any` types as possible, and generally improve typescript (new language to me)

P4
===

Stuff that probably cannot be implemented due to WeberEension limitations.

* Avoid downloads going "missing" after a browser restart.
  * Firefox helpfully keeps different lists of downloads. One for newly added downloads, and other ones for "previous" downloads. Turns out the WebExtension API only ever queries the "new" list.
* Segmented downloads
  * Cannot be done with WebExtensions - downloads API has no support and manually downloading, storing in temporary add-on storage and reassmbling the downloaded parts later is not only efficient but does not reliabliy work due to storage limitations.
* Conflicts: ask when a file exists
  * Not supported by Firefox
* Speed limiter
  * Cannot be done with the WebExtensions downloads API
* contenthandling aka video sniffing, request manipulation?
  * PITA and/or infeasible - Essentially cannot be done for a large part and the other prt is extemely inefficient
* Checksums/Hashes?
  * Cannot be done with WebExtensions - cannot actually read the downloaded data
* Mirrors?
  * Cannot be done with WebExtensions - no low level APIs, see segmented downloads
* Metalink?
  * Currently infeasible, as we cannot look into download data streams.
    Headers-only might be an option.
    But then again, metalink's features are mirrors and checksums, and we cannot do those.
