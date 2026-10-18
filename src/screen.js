import * as T from "three";
export const AOIS = ["App", "Web", "FOSS", "DevOps"];
export const MENU_RECTS = AOIS.map((_, i) => ({
  x: 100,
  y: 410 + i * 112,
  width: 450,
  height: 85,
}));

export function drawPS(ctx, x, y, size, color = "#fff") {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 48, size / 48);
  ctx.fillStyle = color;
  ctx.fill(
    new Path2D(
      "M18 2v29l6 2V10c7 2 9 5 7 9v7c10 3 13-9 5-15C31 7 25 4 18 2Zm-3 22-9 4c-12 6-2 12 9 8v-5l-7 2c-5 1-6-1-2-2l9-3Zm12 6 9-3c10-3 16 2 9 6l-18 7v-5l13-5c3-1 0-2-3-1l-10 4Z",
    ),
  );
  ctx.restore();
}
const image = (url) =>
  new Promise((resolve, reject) => {
    const value = new Image();
    value.onload = () => resolve(value);
    value.onerror = reject;
    value.src = url;
  });
const texture = (canvas) => {
  const value = new T.CanvasTexture(canvas);
  value.colorSpace = T.SRGBColorSpace;
  value.flipY = true;
  return value;
};

export class TelevisionScreen {
  static async create() {
    const [city, acm] = await Promise.all([
      image("/assets/cyberpunk.png"),
      image("/assets/acm.png"),
    ]);
    return new TelevisionScreen(city, acm);
  }
  constructor(city, acm) {
    this.city = city;
    this.selected = 0;
    this.lastFrame = -1;
    this.selectionTime = -10;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext("2d");
    this.texture = texture(this.canvas);
    this.sample = document.createElement("canvas");
    this.sample.width = 64;
    this.sample.height = 36;
    this.sampleCtx = this.sample.getContext("2d", { willReadFrequently: true });
    const logo = document.createElement("canvas");
    logo.width = logo.height = acm.width;
    const c = logo.getContext("2d");
    c.drawImage(acm, 0, 0);
    const data = c.getImageData(0, 0, logo.width, logo.height);
    for (let i = 0; i < data.data.length; i += 4)
      data.data[i + 3] = Math.max(
        0,
        Math.min(255, ((data.data[i] - 52) * 255) / 185),
      );
    c.putImageData(data, 0, 0);
    this.acm = logo;
    this.colors = Array.from({ length: 12 }, () => new T.Color(0));
    this.update("off", 0, 0);
  }
  select(index, time) {
    this.selected = index;
    this.selectionTime = time;
    this.lastFrame = -1;
  }
  brand(c, y = 1000) {
    c.drawImage(this.acm, 918, y - 80, 66, 66);
    c.fillStyle = "#d2d6df";
    c.font = "18px Arial";
    c.textAlign = "left";
    c.fillText("ACM–VIT", 1000, y - 37);
  }
  title(c, x, y, size, color = "#f2f400") {
    c.save();
    c.transform(1, -0.055, -0.16, 1, 0, 0);
    c.fillStyle = color;
    c.font = `italic 900 ${size}px Arial`;
    c.fillText("CYBERPUNK", x + y * 0.16, y + x * 0.055);
    c.restore();
    c.fillStyle = color;
    c.font = `italic 700 ${size * 0.28}px Arial`;
    c.letterSpacing = "14px";
    c.fillText("2077", x + size * 2.5, y + size * 0.4);
    c.letterSpacing = "0px";
  }
  update(mode, time, elapsed) {
    const frame = Math.floor(time * 24);
    if (frame === this.lastFrame && mode === this.lastMode) return false;
    this.lastFrame = frame;
    this.lastMode = mode;
    const c = this.ctx;
    c.setTransform(2 / 3, 0, 0, 2 / 3, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.textAlign = "left";
    c.fillStyle = "#030405";
    c.fillRect(0, 0, 1920, 1080);
    if (["boot", "ready", "inserting"].includes(mode)) {
      c.fillStyle = "#070a10";
      c.fillRect(0, 0, 1920, 1080);
      c.globalAlpha = mode === "boot" ? Math.min(1, elapsed * 1.8) : 1;
      drawPS(c, 960, 440, 230);
      this.brand(c);
      c.globalAlpha = 1;
    } else if (mode === "loading" || mode === "home") {
      c.drawImage(
        this.city,
        -20 + Math.sin(time * 0.12) * 8,
        -12 + Math.cos(time * 0.14) * 5,
        1960,
        1104,
      );
      const shade = c.createLinearGradient(0, 0, 1150, 0);
      shade.addColorStop(0, "#000b10d9");
      shade.addColorStop(0.55, "#00080c70");
      shade.addColorStop(1, "#00000000");
      c.fillStyle = shade;
      c.fillRect(0, 0, 1920, 1080);
      c.globalCompositeOperation = "screen";
      c.strokeStyle = "#90e7ed";
      c.lineWidth = 1;
      for (let i = 0; i < 44; i++) {
        const x = (i * 157.31 + Math.sin(time * 0.3 + i) * 5) % 1920,
          y = (i * 137.7 + time * (55 + (i % 7) * 9)) % 1100;
        c.globalAlpha = 0.025 + (i % 4) * 0.008;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 4, y + 35);
        c.stroke();
      }
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      const loading = mode === "loading",
        progress = Math.min(1, elapsed / 1.6);
      if (loading) {
        c.fillStyle = `rgba(0,4,8,${0.7 * (1 - progress)})`;
        c.fillRect(0, 0, 1920, 1080);
        this.title(c, 90, 230, 112);
        c.fillStyle = "#c3eff3";
        c.font = "18px monospace";
        c.fillText("CONNECTING TO NIGHT CITY", 108, 870);
        c.fillStyle = "#48d9e1";
        c.fillRect(108, 910, progress * 560, 3);
      } else {
        this.title(c, 88, 215, 112);
        c.fillStyle = "#67d9df";
        c.font = "17px monospace";
        c.letterSpacing = "6px";
        c.fillText("AREAS OF INTEREST", 111, 355);
        c.letterSpacing = "0px";
        AOIS.forEach((label, i) => {
          const r = MENU_RECTS[i],
            active = i === this.selected;
          if (active) {
            c.fillStyle = "#edf300";
            c.fillRect(r.x, r.y, r.width, 76);
            c.fillStyle = "#061012";
            c.beginPath();
            c.moveTo(r.x + r.width - 18, r.y);
            c.lineTo(r.x + r.width, r.y);
            c.lineTo(r.x + r.width, r.y + 18);
            c.closePath();
            c.fill();
          }
          c.fillStyle = active ? "#071014" : "#e2f0e8";
          c.font = "500 49px monospace";
          c.fillText(label, r.x + 30, r.y + 54);
          if (!active) {
            c.fillStyle = "#68d9df50";
            c.fillRect(r.x, r.y + 77, r.width, 1);
          }
        });
        c.fillStyle = "#67d9df";
        c.fillRect(104, 930, 70, 2);
        c.globalAlpha = 0.75;
        this.brand(c, 1032);
        c.globalAlpha = 1;
      }
      if (loading || time - this.selectionTime < 0.28) {
        for (let i = 0; i < 4; i++) {
          const y = (Math.floor(time * 13) * 127 + i * 239) % 1040;
          c.globalAlpha = 0.1;
          c.fillStyle = i % 2 ? "#ff3158" : "#38e9ee";
          c.fillRect(Math.sin(time * 57 + i) * 50, y, 1920, 3 + i * 2);
        }
        c.globalAlpha = 1;
      }
      c.fillStyle = "#00000017";
      for (let y = 0; y < 1080; y += 4) c.fillRect(0, y, 1920, 1);
    }
    this.texture.needsUpdate = true;
    this.readEdges();
    return true;
  }
  readEdges() {
    const c = this.sampleCtx;
    c.drawImage(this.canvas, 0, 0, 64, 36);
    const pixels = c.getImageData(0, 0, 64, 36).data;
    const ranges = [
      ...[0, 56].flatMap((x) =>
        [0, 12, 24].map((y) => ({ x, y, w: 8, h: 12 })),
      ),
      ...[0, 30].flatMap((y) =>
        [0, 21, 42].map((x) => ({ x, y, w: 21, h: 6 })),
      ),
    ];
    ranges.forEach((r, index) => {
      let red = 0,
        green = 0,
        blue = 0,
        count = 0;
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          const i = (y * 64 + x) * 4,
            weight =
              0.2 + Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) / 255;
          red += pixels[i] * weight;
          green += pixels[i + 1] * weight;
          blue += pixels[i + 2] * weight;
          count += weight;
        }
      const color = new T.Color(
          red / count / 255,
          green / count / 255,
          blue / count / 255,
        ),
        max = Math.max(color.r, color.g, color.b, 0.01);
      color.multiplyScalar(Math.min(3.8, 0.5 / max));
      this.colors[index].copy(color);
    });
  }
  caseTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 640;
    const c = canvas.getContext("2d");
    c.fillStyle = "#f0f3f5";
    c.fillRect(0, 0, 512, 640);
    drawPS(c, 42, 35, 42, "#111");
    c.fillStyle = "#101418";
    c.font = "bold 36px Arial";
    c.fillText("PS5", 83, 48);
    c.drawImage(this.city, 710, 0, 1050, 1080, 0, 68, 512, 572);
    const g = c.createLinearGradient(0, 400, 0, 640);
    g.addColorStop(0, "#e9ef0000");
    g.addColorStop(1, "#e9ef00");
    c.fillStyle = g;
    c.fillRect(0, 350, 512, 290);
    this.title(c, 29, 540, 51, "#e8f300");
    return texture(canvas);
  }
  discTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d"),
      g = c.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, "#d8e7e8");
    g.addColorStop(0.3, "#6ddce6");
    g.addColorStop(0.55, "#e6ef00");
    g.addColorStop(1, "#e2c8ec");
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    this.title(c, 60, 175, 43, "#07151d");
    c.fillStyle = "#20313a";
    c.font = "13px monospace";
    c.fillText("PLAYSTATION 5", 176, 405);
    c.strokeStyle = "#e6f7f833";
    for (let r = 70; r < 252; r += 6) {
      c.beginPath();
      c.arc(256, 256, r, 0, Math.PI * 2);
      c.stroke();
    }
    return texture(canvas);
  }
}
