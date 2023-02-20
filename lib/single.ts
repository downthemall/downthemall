"use strict";
// License: MIT

// eslint-disable-next-line no-unused-vars
import { Bus, Port } from "./bus";
import { WindowStateTracker } from "./windowstatetracker";
import { Promised, timeout } from "./util";
import { donate } from "./windowutils";
import { windows, CHROME } from "./browser";
// eslint-disable-next-line no-unused-vars
import { BaseItem } from "./item";

export async function single(item: BaseItem | null) {
  const tracker = new WindowStateTracker("single", {
    minWidth: 750,
    minHeight: 550
  });
  await tracker.init();
  const windowOptions = tracker.getOptions({
    url: "/windows/single.html",
    type: "popup",
  });
  const window = await windows.create(windowOptions);
  tracker.track(window.id);
  try {
    if (!CHROME) {
      windows.update(window.id, tracker.getOptions({}));
    }
    const port: Port = await Promise.race<Port>([
      new Promise<Port>(resolve => Bus.oncePort("single", port => {
        resolve(port);
        return true;
      })),
      timeout<Port>(5 * 1000)]);
    if (!port.isSelf) {
      throw Error("Invalid sender connected");
    }
    tracker.track(window.id, port);

    const done = new Promised();

    port.on("disconnect", () => {
      done.reject(new Error("Prematurely disconnected"));
    });

    port.on("queue", msg => {
      done.resolve(msg);
    });

    port.on("cancel", () => {
      done.reject(new Error("User canceled"));
    });

    port.on("donate", () => {
      donate();
    });

    if (item) {
      port.post("item", {item});
    }
    return await done;
  }
  finally {
    try {
      await tracker.finalize();
    }
    catch (ex) {
      // window might be gone; ignored
    }
    try {
      await windows.remove(window.id);
    }
    catch (ex) {
      // window might be gone; ignored
    }
  }
}
