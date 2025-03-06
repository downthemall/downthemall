import { runtime } from "./browser";

declare let chrome: any;

function playAudioPlain(name: string) {
  const audio = new Audio(runtime.getURL(`/style/${name}.opus`));
  audio.addEventListener("canplaythrough", () => audio.play());
  audio.addEventListener("ended", () => document.body.removeChild(audio));
  audio.addEventListener("error", () => document.body.removeChild(audio));
  document.body.appendChild(audio);
}

function playAudioV3(name: string) {
  chrome.offscreen.createDocument({
    url: `${runtime.getURL("/windows/offscreen_audio.html")}?name=${name}`,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a sound"
  });
}

export function playAudio(name: string) {
  if (chrome && chrome.offscreen && chrome.offscreen.createDocument) {
    playAudioV3(name);
  }
  else {
    playAudioPlain(name);
  }
}
