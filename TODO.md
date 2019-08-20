TODO
---

aka a lot

P1
===

Musts.

* github
* packaging
  * signing

P2
===

Planned for later.

* Investigate using an action popup for the browser action
* Soft errors and retry logic
  * Big caveat: When the server still responds, like 50x errors which would be recoverable, we actually have no way of knowing it did in respond in such a way. See P4 - Handle Errors remarks.
* Delete files (well, as far as the browser allows)
* Inter-addon API (basic)
  * Add downloads
* Chrome support
* vtable perf: cache column widths
* Localizations
  * Settle on system
  * Do the de-locale
  * Enagage translators
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
* Import/Export
* Download priorities (manual scheduling overrides)
* Dark Theme support
  * os/browser define be default
  * overwritable
* Get and cache system icons (because Firefox doesn't allow moz-icon: for WE, but makes them kinda accessible through the downloads API anyway, essentially copying them via a canvas on a privileged hidden page into a data URL... ikr)
* Remove `any` types as possible, and generally improve typescript (new language to me)

P4
===

Stuff that probably cannot be implemented due to WeberEension limitations.

* Segmented downloads
  * Cannot be done with WebExtensions - downloads API has no support and manually downloading, storing in temporary add-on storage and reassmbling the downloaded parts later is not only efficient but does not reliabliy work due to storage limitations.
* Handle errors, 404 and such
  * The Firefox download manager is too stupid and webRequest does not see Downloads, so cannot be done right now.
* Conflicts: ask when a file exists
  * Not supported by Firefox
* Speed limiter
  * Cannot be done with the WebExtensions downloads API
* Actually send referrers for downloads
  * Cannot be done with WebExtensions - webRequest does not see Downloads
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
