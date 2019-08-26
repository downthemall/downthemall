"use strict";
// License: MIT

export interface ModalButton {
  title: string;
  value: string;
  default?: boolean;
  dismiss?: boolean;
}

interface Promised {
  resolve: Function;
  reject: Function;
}

export default abstract class ModalDialog {
  private _showing: Promised | null;

  private _dismiss: HTMLButtonElement | null;

  private _default: HTMLButtonElement | null;

  protected el: HTMLDivElement;

  constructor() {
    this._showing = null;
    this._dismiss = null;
    this._default = null;
  }

  async _makeEl() {
    this._dismiss = null;
    this._default = null;

    const el = document.createElement("div");
    el.classList.add("modal-container");

    const cont = document.createElement("section");
    cont.classList.add("modal-dialog");

    const body = document.createElement("article");
    body.classList.add("modal-body");
    body.appendChild(await this.getContent());
    cont.appendChild(body);

    const footer = document.createElement("footer");
    footer.classList.add("modal-footer");
    for (const b of this.buttons) {
      const button = document.createElement("button");
      button.classList.add("modal-button");
      if (b.default) {
        if (this._default) {
          throw new Error("Default already declared");
        }
        this._default = button;
        button.classList.add("modal-default");
      }
      if (b.dismiss) {
        if (this._dismiss) {
          throw new Error("dismiss already declared");
        }
        this._dismiss = button;
        button.classList.add("modal-dismiss");
      }
      button.textContent = b.title;
      button.value = b.value;
      button.addEventListener("click", () => {
        this.done(b);
      });
      footer.appendChild(button);
    }
    const nix = !navigator.platform.startsWith("Win");
    if (this._default && nix) {
      footer.appendChild(this._default);
    }
    if (this._dismiss && nix) {
      footer.insertBefore(this._dismiss, footer.firstChild);
    }
    cont.appendChild(footer);

    el.appendChild(cont);

    el.addEventListener("click", e => {
      if (e.target !== el) {
        return;
      }
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      this.dismiss();
    });
    return el;
  }

  abstract getContent():
    Promise<DocumentFragment | HTMLElement> | HTMLElement | DocumentFragment;

  get buttons(): ModalButton[] {
    return [
      {
        title: "Accept",
        value: "ok",
        default: true,
        dismiss: false
      },
      {
        title: "Cancel",
        value: "cancel",
        default: false,
        dismiss: true
      }
    ];
  }

  done(button: ModalButton) {
    if (!this._showing) {
      return;
    }
    const value = this.convertValue(button.value);
    if (button.dismiss) {
      this._showing.reject(new Error(value));
    }
    else {
      this._showing.resolve(value);
    }
  }

  shown() {
    // ignored
  }

  focusDefault() {
    this._default && this._default.focus();
  }

  convertValue(value: string): any {
    return value;
  }


  async show(): Promise<any> {
    if (this._showing) {
      throw new Error("Double show");
    }
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.dismiss();
      return;
    };
    const enterHandler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") {
        return;
      }
      const {localName} = e.target as HTMLElement;
      if (localName === "textarea" && !e.metaKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.accept();
      return;
    };

    document.body.appendChild(this.el = await this._makeEl());
    this.shown();
    addEventListener("keydown", escapeHandler);
    addEventListener("keydown", enterHandler);
    try {
      return await new Promise((resolve, reject) => {
        this._showing = {resolve, reject};
      });
    }
    finally {
      removeEventListener("keydown", escapeHandler);
      removeEventListener("keydown", enterHandler);
      document.body.removeChild(this.el);
      this._showing = null;
    }
  }

  dismiss() {
    if (!this._dismiss) {
      throw new Error("No dismiss button");
    }
    if (!this._showing) {
      throw new Error("Dialog not open");
    }
    this._dismiss.click();
  }

  accept() {
    if (!this._default) {
      throw new Error("No accept button");
    }
    if (!this._showing) {
      throw new Error("Dialog not open");
    }
    this._default.click();
  }

  /**
   * Show some informaton in a dialog
   * @param {string} title dialog title
   * @param {string} text info
   * @param {string} oktext button text
   */
  static async inform(title: string, text: string, oktext: string) {
    const dialog = new class extends ModalDialog {
      getContent() {
        const rv = document.createDocumentFragment();
        const h = document.createElement("h1");
        h.textContent = title || "Information";
        rv.appendChild(h);
        const t = document.createElement("p");
        t.textContent = text || "";
        rv.appendChild(t);
        return rv;
      }

      get buttons() {
        return [
          {
            title: oktext || "OK",
            value: "ok",
            default: true,
            dismiss: false
          },
        ];
      }

      shown() {
        this.focusDefault();
      }
    }();
    try {
      await dialog.show();
    }
    catch (ex) {
      // ignored
    }
  }

  static async confirm(title: string, text: string) {
    const dialog = new class extends ModalDialog {
      getContent() {
        const rv = document.createDocumentFragment();
        const h = document.createElement("h1");
        h.textContent = title || "Confirm";
        rv.appendChild(h);
        const t = document.createElement("p");
        t.textContent = text || "";
        rv.appendChild(t);
        return rv;
      }

      get buttons() {
        return [
          {
            title: "Yes",
            value: "ok",
            default: true,
            dismiss: false,
          },
          {
            title: "No",
            value: "cancel",
            default: true,
            dismiss: true
          }
        ];
      }

      shown() {
        this.focusDefault();
      }
    }();
    return await dialog.show();
  }

  static async prompt(title: string, text: string, defaultValue: string) {
    const dialog = new class extends ModalDialog {
      _input: HTMLInputElement;

      getContent() {
        const rv = document.createDocumentFragment();
        const h = document.createElement("h1");
        h.textContent = title || "Confirm";
        rv.appendChild(h);
        const t = document.createElement("p");
        t.textContent = text || "";
        rv.appendChild(t);
        const i = document.createElement("input");
        i.setAttribute("type", text);
        i.value = defaultValue || "";
        rv.appendChild(i);
        i.style.minWidth = "80%";
        this._input = i;
        return rv;
      }

      shown() {
        this._input.focus();
      }

      convertValue(v: string) {
        if (v === "ok") {
          v = this._input.value;
        }
        return v;
      }
    }();
    return await dialog.show();
  }
}
