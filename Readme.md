DownThemAll! WE
===

The DownThemAll! WebExtension.

For those still on supported browser: [Non-WebExtension legacy code](https://github.com/downthemall/downthemall-legacy).

About
---

This is the WebExtension version of DownThemAll!, a complete re-development from scratch.
Being a WebExtension it lacks a ton of features the original DownThemAll! had. Sorry, but there is no way around it since Mozilla decided to adopt WebExtensions as the *only* extension type and WebExtensions are extremely limited in what they can do.

For what is planned (and not planned because impossible to do in WebExtensions), see [TODO.md](TODO.md).

What this furthermore means is that some bugs we fixed in the original DownThemAll! are back, as we cannot do our own downloads any longer but have to go through the browser download manager always, which is notoriously bad at handling certain "quirks" real web servers in the wild show. It doesn't even handle regular 404 errors.

I spent countless hours evaluating various workarounds to enable us to do our own downloads instead of relying on the downloads API (the browser built-in downloader). From using `IndexedDB` to store retrieved chunks via `XHR`, to doing nasty service-worker tricks to fake a download that the backend would retrieve with `XHR`. The last one looks promising but I have yet to get it to work in a manner that is reliable, performs well enough and doesn't eat all the system memory for breakfast. Maybe in the future...

What this also means is that we have to write our user interface in HTML, which never looks "native" and cannot offer deep OS integration.

But it is what it is...

**What we *can* do and did do is bring the mass selection, organizing (renaming masks, etc) and queueing tools of DownThemAll! over to the WebExtension, so you can easily queue up hundreds or thousands files at once without the downloads going up in flames because the browser tried to download them all at once.**


Development
---

You will want to `yarn` the development dependencies such as webpack first.

Afterwards there is two important commands to run

  * `yarn watch` - This will run the webpack bundler in watch mode, updating bundles as you change the source.
  * `yarn webext` - This will run the WebExtension in a development profile using the [`web-ext` tool from mozilla](https://www.npmjs.com/package/web-ext) (which you need to install separately).
  
Alternative, you can also `yarn build`, which then builds an *unsigned* zip that you can then install permanently in a browser that does not enforce signing (i.e. Nightly or the Unbranded Firefox).

Before submitting patches, please make sure you run eslint, if this isn't done automatically, and eslint does not report any open issues. Code contributions should favor typescript code over javascript code. External dependencies that would ship with the final product (including all npm/yarn packages) should be kept to a bare minimum.

The code base is comparatively large for a WebExtension, with over 10K sloc of typescript and over 14K sloc total.
