"use strict";
// License: MIT

import {EventEmitter} from "./events";
import {Rect} from "./rect";
import {debounce, IS_MAC} from "./util";

const CLICK_DIFF = 16;
const MENU_OPEN_BOUNCE = 500;

let ids = 0;

export const Keys = new Map([
  ["ACCEL", IS_MAC ? "⌘" : "Ctrl"],
  ["CTRL", "Ctrl"],
  ["ALT", IS_MAC ? "⌥" : "Alt"],
  ["SHIFT", "⇧"],
]);

function toKeyTextMap(k: string) {
  k = k.trim();
  const ku = k.toUpperCase();
  const v = Keys.get(ku);
  return v ? v : k.startsWith("Key") ? k.slice(3) : k;
}

function toKeyText(key: string) {
  return key.split("-").map(toKeyTextMap).join(" ");
}

export interface MenuPosition {
  clientX: number;
  clientY: number;
}

interface MenuOptions {
  disabled?: string;
  allowClick?: string;
  icon?: string;
  key?: string;
  autoHide?: string;
}

export class MenuItemBase {
  public readonly owner: ContextMenu;

  public readonly id: string;

  public readonly text: string;

  public readonly icon: string;

  public readonly key: string;

  public readonly autoHide: boolean;

  public readonly elem: HTMLLIElement;

  public readonly iconElem: HTMLSpanElement;

  public readonly textElem: HTMLSpanElement;

  public readonly keyElem: HTMLSpanElement;

  constructor(owner: ContextMenu, id = "", text = "", options: MenuOptions) {
    this.owner = owner;
    if (!id) {
      id = `contextmenu-${++ids}`;
    }
    this.id = id;
    this.text = text || "";
    this.icon = options.icon || "";
    this.key = options.key || "";
    this.autoHide = options.autoHide !== "false";

    this.elem = document.createElement("li");
    this.elem.id = this.id;
    this.iconElem = document.createElement("span");
    this.textElem = document.createElement("span");
    this.keyElem = document.createElement("span");
    this.elem.appendChild(this.iconElem);
    this.elem.appendChild(this.textElem);
    this.elem.appendChild(this.keyElem);
  }

  materialize() {
    this.elem.classList.add("context-menu-item");
    this.iconElem.className = "context-menu-icon";
    if (this.icon) {
      this.iconElem.classList.add(...this.icon.split(" "));
    }
    else {
      this.iconElem.classList.add("context-menu-no-icon");
    }

    this.textElem.textContent = this.text;
    this.textElem.className = "context-menu-text";

    if (this.key) {
      this.elem.dataset.key = this.key;
    }
    this.keyElem.textContent = toKeyText(this.key);
    this.keyElem.className = "context-menu-key";
    this.keyElem.style.display = this.key ? "inline-block" : "none";
  }
}

export class MenuItem extends MenuItemBase {
  constructor(
      owner: ContextMenu, id = "", text = "", options: MenuOptions = {}) {
    options = options || {};
    super(owner, id, text, options);
    this.disabled = options.disabled === "true";
    this.elem.setAttribute("aria-role", "menuitem");
    this.clicked = this.clicked.bind(this);
    this.elem.addEventListener("click", this.clicked);
    this.elem.addEventListener("contextmenu", this.clicked);
  }

  clicked() {
    this.owner.emit("clicked", this.id, this.autoHide);
  }

  get disabled() {
    return this.elem.classList.contains("disabled");
  }

  set disabled(nv) {
    this.elem.classList[nv ? "add" : "remove"]("disabled");
  }
}

export class MenuSeparatorItem extends MenuItemBase {
  constructor(owner: ContextMenu, id = "") {
    super(owner, id, "", {});
    this.elem.setAttribute("aria-role", "menuitem");
    this.elem.setAttribute("aria-hidden", "true");
  }

  materialize() {
    super.materialize();
    this.elem.classList.add("context-menu-separator");
  }
}

export class SubMenuItem extends MenuItemBase {
  public readonly menu: ContextMenu;

  public readonly expandElem: HTMLSpanElement;

  constructor(
      owner: ContextMenu, id = "", text = "", options: MenuOptions = {}) {
    super(owner, id, text, options);
    this.elem.setAttribute("aria-role", "menuitem");
    this.elem.setAttribute("aria-haspopup", "true");

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    this.menu = new ContextMenu();

    this.expandElem = document.createElement("span");
    this.expandElem.className = "context-menu-expand";
    this.expandElem.textContent = "►";
    this.elem.appendChild(this.expandElem);
    this.elem.addEventListener("click", event => {
      if (options.allowClick === "true") {
        this.owner.emit("clicked", this.id, this.autoHide);
      }
      event.stopPropagation();
      event.preventDefault();
      return false;
    }, true);
    this.owner.elem.addEventListener(
      "mouseenter", debounce(this.entered.bind(this), MENU_OPEN_BOUNCE), true);
    this.owner.on("dismissed", () => {
      this.menu.dismiss();
    });
    this.owner.on("showing", () => {
      this.menu.dismiss();
    });
    this.menu.on("clicked", (...args: any[]) => {
      this.owner.emit("clicked", ...args);
    });
  }

  get itemRect() {
    return new Rect(
      this.owner.elem.offsetLeft,
      this.owner.elem.offsetTop + this.elem.offsetTop,
      0,
      0,
      this.elem.clientWidth - 2,
      this.elem.clientHeight,
    );
  }

  entered(event: MouseEvent) {
    const {target} = event;
    const htarget = target as HTMLElement;
    if (htarget.classList.contains("context-menu")) {
      return;
    }
    if (htarget !== this.elem && htarget.parentElement !== this.elem) {
      this.menu.dismiss();
      return;
    }
    if (!this.owner.showing) {
      return;
    }
    const {itemRect} = this;
    const {availableRect} = this.owner;
    const {width, height} = this.menu.elem.getBoundingClientRect();
    if (itemRect.right + width > availableRect.right) {
      itemRect.offset(-(itemRect.width + width - 2), 0);
    }
    if (itemRect.bottom + height > availableRect.bottom) {
      itemRect.offset(0, itemRect.height);
    }
    this.menu.show({clientX: itemRect.right, clientY: itemRect.top});
  }

  constructFromTemplate(el: HTMLElement) {
    this.menu.constructFromTemplate(el);
  }

  materialize() {
    super.materialize();
    this.menu.materialize();
    this.elem.classList.add("context-menu-submenuitem");
  }
}

export class ContextMenu extends EventEmitter {
  id: string;

  items: MenuItemBase[];

  itemMap: Map<string, MenuItemBase>;

  elem: HTMLUListElement;

  showing: boolean;

  _maybeDismiss: (this: Window, ev: MouseEvent) => any;

  constructor(el?: any) {
    super();
    this.id = `contextmenu-${++ids}`;
    this.items = [];
    this.itemMap = new Map();
    this.elem = document.createElement("ul");
    this.elem.classList.add("context-menu");
    if (el) {
      this.constructFromTemplate(el);
    }
    this.dismiss = this.dismiss.bind(this);
    this.hide();
    this.materialize();
  }

  get availableRect() {
    const {clientWidth: bodyWidth, clientHeight: bodyHeight} = document.body;
    const availableRect = new Rect(0, 0, 0, 0, bodyWidth, bodyHeight);
    return availableRect;
  }

  show(event: MenuPosition) {
    this.dismiss();
    this.emit("showing");
    this.materialize();
    const {clientX, clientY} = event;
    const {clientWidth, clientHeight} = this.elem;
    const clientRect = new Rect(
      clientX, clientY, 0, 0, clientWidth, clientHeight);
    const {availableRect} = this;
    if (clientRect.left < 0) {
      clientRect.move(0, clientRect.top);
    }
    if (clientRect.left < 0) {
      clientRect.move(clientRect.left, 0);
    }
    if (clientRect.bottom > availableRect.bottom) {
      clientRect.offset(0, -(clientRect.height));
    }
    if (clientRect.right > availableRect.right) {
      clientRect.offset(-(clientRect.width), 0);
    }
    if (clientRect.top < 0) {
      clientRect.offset(0, -(clientRect.top));
    }
    this.elem.style.left = `${clientRect.left}px`;
    this.elem.style.top = `${clientRect.top}px`;
    this.showing = true;
    this._maybeDismiss = this.maybeDismiss.bind(this, event);
    addEventListener("click", this._maybeDismiss, true);
    addEventListener("keydown", this.dismiss, true);
    return true;
  }

  dismiss() {
    if (!this.showing) {
      return;
    }
    removeEventListener("click", this._maybeDismiss, true);
    removeEventListener("keydown", this.dismiss, true);
    this.showing = false;
    this.hide();
    this.emit("dismissed");
  }

  destroy() {
    if (this.elem.parentElement) {
      this.elem.parentElement.removeChild(this.elem);
    }

    delete this.elem;
    this.items.length = 0;
  }

  maybeDismiss(origEvent: MouseEvent, event: MouseEvent) {
    if (!event) {
      return;
    }
    if (event.type === "click" && event.button === 2 &&
      origEvent.target === event.target &&
      Math.abs(event.clientX - origEvent.clientX) < CLICK_DIFF &&
      Math.abs(event.clientY - origEvent.clientY) < CLICK_DIFF) {
      return;
    }
    let el = event.target as HTMLElement;
    while (el) {
      if (el.classList.contains("context-menu")) {
        return;
      }
      if (!el.parentElement) {
        break;
      }
      el = el.parentElement;
    }
    this.dismiss();
  }

  emit(event: string, ...args: any[]) {
    if (event !== "showing") {
      // non-autohide click?
      if (event !== "clicked" || args.length < 2 || args[1]) {
        this.dismiss();
      }
    }
    const rv = super.emit(event, ...args);
    if (event === "clicked") {
      return super.emit(args[0], ...args.slice(1));
    }
    return rv;
  }

  hide() {
    this.elem.style.top = "0px";
    this.elem.style.left = "-10000px";
  }

  *[Symbol.iterator]() {
    yield *this.itemMap.keys();
  }

  get(id: string) {
    return this.itemMap.get(id);
  }

  add(item: MenuItemBase, before: MenuItemBase | string = "") {
    let idx = this.items.length;
    if (before) {
      if (typeof before !== "string") {
        before = before.id;
      }
      const ni = this.items.findIndex(i => i.id === before);
      if (ni >= 0) {
        idx = ni;
      }
    }
    this.items.splice(idx, 0, item);
    this.itemMap.set(item.id, item);
  }

  prepend(item: MenuItemBase) {
    this.items.unshift(item);
    this.itemMap.set(item.id, item);
  }

  remove(item: MenuItemBase | string) {
    const id = typeof item === "string" ? item : item.id;
    const idx = this.items.findIndex(i => i.id === id);
    if (idx >= 0) {
      this.items.splice(idx, 1);
      this.itemMap.delete(id);
    }
  }

  constructFromTemplate(el: HTMLElement | string) {
    if (typeof el === "string") {
      const sel = document.querySelector(el) as HTMLElement;
      if (!sel) {
        throw new Error("Invalid selector");
      }
      el = sel;
    }
    if (el.parentElement) {
      el.parentElement.removeChild(el);
    }
    if (el.localName === "template") {
      el = (el as HTMLTemplateElement).content.firstElementChild as HTMLElement;
    }
    if (el.className) {
      this.elem.className = el.className;
      this.elem.classList.add("context-menu");
    }
    this.id = el.id || this.id;
    for (const child of el.children) {
      const text = [];
      let sub = null;
      for (const sc of child.childNodes) {
        switch (sc.nodeType) {
        case Node.TEXT_NODE: {
          const {textContent} = sc;
          text.push(textContent && textContent.trim() || "");
          break;
        }

        case Node.ELEMENT_NODE:
          if (sub) {
            throw new Error("Already has a submenu");
          }
          if ((sc as HTMLElement).localName !== "ul") {
            throw new Error("Not a valid submenu");
          }
          sub = sc;
          break;
        default:
          throw new Error(`Invalid node: ${(sc as HTMLElement).localName}`);
        }
      }
      const joined = text.join(" ").trim();
      let item = null;
      const ce = child as HTMLElement;
      if (joined === "-") {
        item = new MenuSeparatorItem(this, child.id);
      }
      else if (sub) {
        item = new SubMenuItem(this, child.id, joined, ce.dataset);
        item.constructFromTemplate(sub as HTMLElement);
      }
      else {
        item = new MenuItem(this, child.id, joined, ce.dataset);
      }
      this.items.push(item);
      this.itemMap.set(item.id, item);
    }
  }

  materialize() {
    this.elem.id = this.id;
    this.elem.textContent = "";
    for (const item of this.items) {
      item.materialize();
      this.elem.appendChild(item.elem);
    }
    document.body.appendChild(this.elem);
  }
}
