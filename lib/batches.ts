"use strict";
// License: MIT

const PROCESS = Symbol();

interface Generator extends Iterable<string> {
  readonly preview: string;
  readonly length: number;
}

class Literal implements Generator {
  public readonly preview: string;

  public readonly str: string;

  public readonly length: number;

  constructor(str: string) {
    this.preview = this.str = str;
    this.length = 1;
    Object.freeze(this);
  }

  *[Symbol.iterator]() {
    yield this.str;
  }
}

function reallyParseInt(str: string) {
  if (!/^[+-]?[0-9]+$/.test(str)) {
    throw new Error("Not a number");
  }
  const rv = parseInt(str, 10);
  if (isNaN(rv) || rv !== (rv | 0)) {
    throw new Error("Not a number");
  }
  return rv;
}

class Numeral implements Generator {
  public readonly start: number;

  public readonly stop: number;

  public readonly step: number;

  public readonly digits: number;

  public readonly length: number;

  public readonly preview: string;

  constructor(str: string) {
    const rawpieces = str.split(":").map(e => e.trim());
    const pieces = rawpieces.map(e => reallyParseInt(e));
    if (pieces.length < 2) {
      throw new Error("Invalid input");
    }
    const [start, stop, step] = pieces;
    if (step === 0) {
      throw new Error("Invalid step");
    }
    this.step = !step ? 1 : step;
    const dir = this.step > 0;
    if (dir && start > stop) {
      throw new Error("Invalid sequence");
    }
    else if (!dir && start < stop) {
      throw new Error("Invalid sequence");
    }
    this.start = start;
    this.stop = stop;
    this.digits = dir ? rawpieces[0].length : rawpieces[1].length;
    this.length = Math.floor(
      (this.stop - this.start + (dir ? 1 : -1)) / this.step);
    this.preview = this[Symbol.iterator]().next().value as string;
    Object.freeze(this);
  }

  *[Symbol.iterator]() {
    const {digits, start, stop, step} = this;
    const dir = step > 0;
    for (let i = start; (dir ? i <= stop : i >= stop); i += step) {
      const rv = i.toString();
      const len = digits - rv.length;
      if (len > 0) {
        yield "0".repeat(len) + rv;
      }
      else {
        yield rv;
      }
    }
  }
}

class Character implements Generator {
  public readonly start: number;

  public readonly stop: number;

  public readonly step: number;

  public readonly length: number;

  public readonly preview: string;

  constructor(str: string) {
    const rawpieces = str.split(":").map(e => e.trim());
    const pieces = rawpieces.map((e, i) => {
      if (i === 2) {
        return reallyParseInt(e);
      }
      if (e.length > 1) {
        throw new Error("Malformed Character sequence");
      }
      return e.charCodeAt(0);
    });
    if (pieces.length < 2) {
      throw new Error("Invalid input");
    }
    const [start, stop, step] = pieces;
    if (step === 0) {
      throw new Error("Invalid step");
    }
    this.step = !step ? 1 : step;
    const dir = this.step > 0;
    if (dir && start > stop) {
      throw new Error("Invalid sequence");
    }
    else if (!dir && start < stop) {
      throw new Error("Invalid sequence");
    }
    this.start = start;
    this.stop = stop;
    this.length = Math.floor(
      (this.stop - this.start + (dir ? 1 : -1)) / this.step);
    this.preview = this[Symbol.iterator]().next().value as string;
    Object.freeze(this);
  }

  *[Symbol.iterator]() {
    const {start, stop, step} = this;
    const dir = step > 0;
    for (let i = start; (dir ? i <= stop : i >= stop); i += step) {
      yield String.fromCharCode(i);
    }
  }
}

export class BatchGenerator implements Generator {
  private readonly gens: Generator[];

  public readonly hasInvalid: boolean;

  public readonly length: number;

  public readonly preview: string;

  constructor(str: string) {
    this.gens = [];
    let i;
    this.hasInvalid = false;
    while ((i = str.search(/\[.+?:.+?\]/)) !== -1) {
      if (i !== 0) {
        this.gens.push(new Literal(str.slice(0, i)));
        str = str.slice(i);
      }
      const end = str.indexOf("]");
      if (end <= 0) {
        throw new Error("Something went terribly wrong");
      }
      const tok = str.slice(1, end);
      str = str.slice(end + 1);
      try {
        this.gens.push(new Numeral(tok));
      }
      catch {
        try {
          this.gens.push(new Character(tok));
        }
        catch {
          this.gens.push(new Literal(`[${tok}]`));
          this.hasInvalid = true;
        }
      }
    }
    if (str) {
      this.gens.push(new Literal(str));
    }

    // Merge literls
    for (let i = this.gens.length; i > 1; --i) {
      const sgen0 = this.gens[i - 1];
      const sgen1 = this.gens[i];
      if (sgen0 instanceof Literal && sgen1 instanceof Literal) {
        this.gens[i - 1] = new Literal(sgen0.str + sgen1.str);
        this.gens.splice(i, 1);
      }
    }
    this.length = this.gens.reduce((p, c) => p * c.length, 1);
    this.preview = this.gens.reduce((p, c) => p + c.preview, "");
  }

  static *[PROCESS](gens: Generator[]): Iterable<string> {
    const cur = gens.pop();
    if (!cur) {
      yield "";
      return;
    }
    for (const g of BatchGenerator[PROCESS](gens)) {
      for (const tail of cur) {
        yield g + tail;
      }
    }
  }

  *[Symbol.iterator]() {
    if (this.length === 1) {
      yield this.preview;
      return;
    }
    yield *BatchGenerator[PROCESS](this.gens.slice());
  }
}
