"use strict";

declare let chrome: any;

// License: MIT

// This is a helper for offscreen audio

document.addEventListener("DOMContentLoaded", () => {
  const name = new URL(document.location.href).searchParams.get("name");
  const audio = new Audio(chrome.runtime.getURL(`/style/${name}.opus`));
  const nuke = () => {
    document.body.removeChild(audio);
    window.close();
  };
  audio.addEventListener("canplaythrough", () => audio.play());
  audio.addEventListener("ended", nuke);
  audio.addEventListener("error", nuke);
  document.body.appendChild(audio);
});
