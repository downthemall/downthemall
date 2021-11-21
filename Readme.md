
![DownThemAll!](https://raw.githubusercontent.com/downthemall/downthemall/master/style/icon128.png)

# DownThemAll! WE

The DownThemAll! WebExtension.

For those still on supported browser: [Non-WebExtension legacy code](https://github.com/downthemall/downthemall-legacy).

## About

This is the WebExtension version of DownThemAll!, a complete re-development from scratch.
Being a WebExtension it lacks a ton of features the original DownThemAll! had. Sorry, but there is no way around it since Mozilla decided to adopt WebExtensions as the *only* extension type and WebExtensions are extremely limited in what they can do.

For what is planned (and not planned because impossible to do in WebExtensions), see [TODO.md](TODO.md).

What this furthermore means is that some bugs we fixed in the original DownThemAll! are back, as we cannot do our own downloads any longer but have to go through the browser download manager always, which is notoriously bad at handling certain "quirks" real web servers in the wild show. It doesn't even handle regular 404 errors.

I spent countless hours evaluating various workarounds to enable us to do our own downloads instead of relying on the downloads API (the browser built-in downloader). From using `IndexedDB` to store retrieved chunks via `XHR`, to doing nasty service-worker tricks to fake a download that the backend would retrieve with `XHR`. The last one looks promising but I have yet to get it to work in a manner that is reliable, performs well enough and doesn't eat all the system memory for breakfast. Maybe in the future...

What this also means is that we have to write our user interface in HTML, which never looks "native" and cannot offer deep OS integration.

But it is what it is...

**What we *can* do and did do is bring the mass selection, organizing (renaming masks, etc) and queueing tools of DownThemAll! over to the WebExtension, so you can easily queue up hundreds or thousands files at once without the downloads going up in flames because the browser tried to download them all at once.**

## Translations

If you would like to help out translating DTA, please see our [translation guide](_locales/Readme.md).

## Development

### Requirements

- [node](https://nodejs.org/en/)
- [yarn](https://yarnpkg.com/)
- [python3](https://www.python.org/) >= 3.6 (to build zips)
- [web-ext](https://www.npmjs.com/package/web-ext) (for development ease)

### Setup

You will want to run `yarn` to install the development dependencies such as webpack first.

### Making changes

Just use your favorite text editor to edit the files.

You will want to run `yarn watch`.
This will run the webpack bundler in watch mode, transpiling the TypeScript to Javascript and updating bundles as you change the source.

Please note: You have to run `yarn watch` or `yarn build` (at least once) as it builds the actual script bundles.

### Running in Firefox

I recommend you install the [`web-ext`](https://www.npmjs.com/package/web-ext) tools from mozilla. It is not listed as a dependency by design at it causes problems with dependency resolution in yarn right now if installed in the same location as the rest of the dependencies.

If you did, then running `yarn webext` (additionally to `yarn watch`) will run the WebExtension in a development profile. This will use the directory `../dtalite.p` to keep a development profile. You might need to create this directory before you use this command. Furthermore `yarn webext` will watch for changes to the sources and automatically reload the extension.
  
Alternatively, you can also `yarn build`, which then builds an *unsigned* zip that you can then install permanently in a browser that does not enforce signing (i.e. Nightly or the Unbranded Firefox with the right about:config preferences).

### Running in Chrome/Chromium/etc

You have to build the bundles first, of course.

Then put your Chrome into Developement Mode on the Extensions page, and Load Unpacked the directory of your downthemall clone.

### Making release zips

To get a basic unofficial set of zips for Firefox and chrome, run `yarn build`.

If you want to generate release builds like the ones that are eventually released in the extension stores, use `python3 util/build.py --mode=release`.

The output is located in `web-ext-artifacts`.

- `-fx.zip` are Firefox builds
- `-crx.zip` are Chrome/Chromium builds
- `-opr.zip` are Opera builds (essentially like the Chrome one, but without sounds)

### The AMO Editors tl;dr guide

  1. Install the requirements.
  2. `yarn && python3 util/build.py --mode=release`
  3. Have a look in `web-ext-artifacts/dta-*-fx.zip`

### Patches

Before submitting patches, please make sure you run eslint (if this isn't done automatically in your text editor/IDE), and eslint does not report any open issues. Code contributions should favor typescript code over javascript code. External dependencies that would ship with the final product (including all npm/yarn packages) should be kept to a bare minimum and need justification.

Please submit your patches as Pull Requests, and rebase your commits onto the current `master` before submitting.

### Code structure

The code base is comparatively large for a WebExtension, with over 11K sloc of typescript.
It isn't as well organized as it should be in some places; hope you don't mind.

- `uikit/` - The base User Interface Kit, which currently consists of
  - the `VirtualTable` implementation, aka that interactive HTML table with columns, columns resizing and hiding, etc you see in the Manager, Select and Preferences windows/tabs
  - the `ContextMenu` and related classes that drive the HTML-based context menus
- `lib/` - The "backend stuff" and assorted library routines and classes.
- `windows/` - The "frontend stuff" so all the HTML and corresponding code to make that HTML into something interactive
- `style/` - CSS and images
