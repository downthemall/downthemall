/* eslint-disable no-magic-numbers */
"use strict";
// License: MIT

import { _ } from "../../lib/i18n";
import { formatSpeed } from "../../lib/formatters";
import { DownloadState } from "./state";
import { Rect } from "../../uikit/lib/rect";
// eslint-disable-next-line no-unused-vars
import { DownloadItem } from "./table";

function createInnerShadowGradient(
    ctx: CanvasRenderingContext2D, w: number, colors: string[]) {
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, colors[0]);
  g.addColorStop(3.0 / w, colors[1]);
  g.addColorStop(4.0 / w, colors[2]);
  g.addColorStop(1, colors[3]);
  return g;
}

function makeRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    width: number, height: number,
    radius: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.lineTo(x, y + height - radius);
  ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
  ctx.lineTo(x + width - radius, y + height);
  ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  ctx.lineTo(x + width, y + radius);
  ctx.quadraticCurveTo(x + width, y, x + width - radius, y);
  ctx.lineTo(x + radius, y);
  ctx.quadraticCurveTo(x, y, x, y + radius);
}

function createVerticalGradient(
    ctx: CanvasRenderingContext2D, height: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function drawSpeedPass(
    ctx: CanvasRenderingContext2D, h: number, step: number,
    pass: any, speeds: number[]) {
  let y = h + pass.y;
  let x = pass.x + 0.5;

  ctx.beginPath();
  ctx.moveTo(x, y);

  y -= speeds[0];
  if (pass.f) {
    ctx.lineTo(x, y);
  }
  else {
    ctx.moveTo(x, y);
  }

  let slope = (speeds[1] - speeds[0]);
  x += step * 0.7;
  y -= slope * 0.7;
  ctx.lineTo(x, y);

  for (let j = 1, e = speeds.length - 1; j < e; ++j) {
    y -= slope * 0.3;
    slope = (speeds[j + 1] - speeds[j]);
    y -= slope * 0.3;

    ctx.quadraticCurveTo(step * j, h + pass.y - speeds[j], (x + step * 0.6), y);

    x += step;
    y -= slope * 0.4;

    ctx.lineTo(x, y);
  }
  x += step * 0.3;
  y -= slope * 0.3;
  ctx.lineTo(x, y);

  if (pass.f) {
    ctx.lineTo(x, h);
    ctx.fillStyle = createVerticalGradient(ctx, h - 7, pass.f[0], pass.f[1]);
    ctx.fill();
  }

  if (pass.s) {
    ctx.lineWidth = pass.sw || 1;
    ctx.strokeStyle = pass.s;
    ctx.stroke();
  }
}

const speedPasses = Object.freeze([
  { x: 4, y: 0, f: ["#EADF91", "#F4EFB1"] },
  { x: 2, y: 0, f: ["#DFD58A", "#D3CB8B"] },
  { x: 1, y: 0, f: ["#D0BA70", "#DFCF6F"] },
  { x: 0, y: 0, f: ["#FF8B00", "#FFDF38"], s: "#F98F00" }
]);
const avgPass = Object.freeze({x: 0, y: 0, s: "rgba(0,0,200,0.3", sw: 2});

const ELEMS = [
  "icon",
  "infos", "name", "from", "size", "date", "eta", "etalabel",
  "speedbox", "speedbar", "current", "average",
  "progressbar", "progress"
];

export class Tooltip {
  private readonly item: DownloadItem;

  private readonly elem: HTMLElement;

  private readonly speedbar: HTMLCanvasElement;

  private readonly icon: HTMLElement;

  private readonly name: HTMLElement;

  private readonly from: HTMLElement;

  private readonly size: HTMLElement;

  private readonly date: HTMLElement;

  private readonly eta: HTMLElement;

  private readonly etalabel: HTMLElement;

  private readonly speedbox: HTMLElement;

  private readonly progressbar: HTMLElement;

  private readonly progress: HTMLElement;

  private readonly current: HTMLElement;

  private readonly average: HTMLElement;

  private lastPos: any;

  constructor(item: DownloadItem, pos: number) {
    this.update = this.update.bind(this);
    this.item = item;
    this.item.on("largeIcon", this.update);

    const tmpl = (
      document.querySelector<HTMLTemplateElement>("#tooltip-template"));
    if (!tmpl) {
      throw new Error("template failed");
    }
    const el = tmpl.content.firstElementChild;
    if (!el) {
      throw new Error("invalid template");
    }
    this.elem = el.cloneNode(true) as HTMLElement;
    this.adjust(pos);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;
    ELEMS.forEach(e => {
      self[e] = this.elem.querySelector(`#tooltip-${e}`);
    });
    document.body.appendChild(this.elem);
    this.item.on("stats", this.update);
    this.item.on("update", this.update);
    this.speedbar.width = this.speedbar.clientWidth;
    this.speedbar.height = this.speedbar.clientHeight;
    this.update();
    this.adjust(pos);
  }

  update() {
    const {item} = this;
    if (!item.isFiltered) {
      this.dismiss();
      return;
    }
    const icon = item.largeIcon;
    this.icon.className = icon;
    this.name.textContent = item.currentFull;
    this.from.textContent = item.usable;
    this.size.textContent = item.fmtSize;
    this.date.textContent = new Date(item.startDate).toLocaleString();
    this.eta.textContent = item.fmtETA;

    const running = item.state === DownloadState.RUNNING;
    const hidden = this.speedbox.classList.contains("hidden");

    if (!running && !hidden) {
      this.eta.classList.add("single");
      this.etalabel.classList.add("hidden");
      this.speedbox.classList.add("hidden");
      this.progressbar.classList.add("hidden");
      this.adjust(null);
    }
    if (!running) {
      return;
    }
    if (hidden) {
      this.eta.classList.remove("single");
      this.etalabel.classList.remove("hidden");
      this.speedbox.classList.remove("hidden");
      this.progressbar.classList.remove("hidden");
      this.adjust(null);
    }
    this.progress.style.width = `${item.percent * 100}%`;
    this.current.textContent = formatSpeed(item.stats.current);
    this.average.textContent = formatSpeed(item.stats.avg);
    this.drawSpeeds();
  }

  drawSpeeds() {
    const {stats} = this.item;
    const {speedbar: canvas} = this;

    let w = canvas.width;
    let h = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Cannot acquire 2d context");
    }
    --w; --h;

    const boxFillStyle = createInnerShadowGradient(
      ctx, h, ["#B1A45A", "#F1DF7A", "#FEEC84", "#FFFDC4"]);
    const boxStrokeStyle = createInnerShadowGradient(
      ctx, 8, ["#816A1D", "#E7BE34", "#F8CC38", "#D8B231"]);

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(0.5, 0.5);

    ctx.lineWidth = 1;
    ctx.strokeStyle = boxStrokeStyle;
    ctx.fillStyle = boxFillStyle;

    // draw container chunks back
    ctx.fillStyle = boxFillStyle;
    makeRoundedRectPath(ctx, 0, 0, w, h, 5);
    ctx.fill();

    let speeds = Array.from(stats.validValues);
    let avgs = Array.from(stats.avgs.validValues);
    if (speeds.length > 1) {
      let [maxH] = speeds; let [minH] = speeds;
      speeds.forEach(s => {
        maxH = Math.max(maxH, s);
        minH = Math.min(minH, s);
      });
      if (minH === maxH) {
        speeds = speeds.map(() => 12);
      }
      else {
        const r = (maxH - minH);
        speeds = speeds.map(function(speed) {
          return 3 + Math.round((h - 6) * (speed - minH) / r);
        });
        avgs = avgs.map(function(speed) {
          return 3 + Math.round((h - 6) * (speed - minH) / r);
        });
      }
      ctx.save();
      ctx.clip();

      const step = w / (speeds.length - 1);
      for (const pass of speedPasses) {
        drawSpeedPass(ctx, h, step, pass, speeds);
      }
      drawSpeedPass(ctx, h, step, avgPass, avgs);

      ctx.restore();
    }

    makeRoundedRectPath(ctx, 0, 0, w, h, 3);
    ctx.stroke();

    ctx.restore();
  }

  adjust(pos: any) {
    if (pos) {
      this.lastPos = pos;
    }
    else {
      pos = this.lastPos;
    }
    const {clientWidth, clientHeight} = this.elem;
    if (!clientWidth) {
      this.elem.style.left = `${pos.x + 10}px`;
      this.elem.style.top = `${pos.y + 10}px`;
      return;
    }

    const w = Math.max(
      document.documentElement.clientWidth, window.innerWidth || 0);
    const h = Math.max(
      document.documentElement.clientHeight, window.innerHeight || 0);
    const r = new Rect(pos.x + 10, pos.y + 10, 0, 0, clientWidth, clientHeight);
    if (r.right > w) {
      r.offset(-clientWidth - 20, 0);
    }
    if (r.left < 0) {
      r.offset(-r.left, 0);
    }
    if (r.bottom > h) {
      r.offset(0, -clientHeight - 20);
    }
    this.elem.style.left = `${r.left}px`;
    this.elem.style.top = `${r.top}px`;
  }

  dismiss() {
    if (this.elem.parentElement) {
      this.elem.parentElement.removeChild(this.elem);
    }
    this.item.off("stats", this.update);
    this.item.off("update", this.update);
    this.item.off("largeIcon", this.update);
  }
}
