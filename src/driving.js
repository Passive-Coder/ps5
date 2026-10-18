import * as T from "three";
import { loadWasmModel } from "./wasm-model.js";
import {
  AOIS,
  CHECKPOINT_DISTANCES,
  QUESTIONS,
  DriveState,
} from "./checkpoints.js";

function canvasTexture(width, height, draw) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
function surfaceTexture(road = false) {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    let seed = 4819;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const data = ctx.createImageData(w, h);
    for (let i = 0; i < data.data.length; i += 4) {
      const x = (i / 4) % w,
        y = Math.floor(i / 4 / w),
        mottled = Math.sin(x * 0.028) * Math.cos(y * 0.022) * 7;
      const v = (road ? 155 : 195) + rnd() * 37 + mottled;
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v - (road ? 2 : 9);
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    ctx.strokeStyle = road ? "#53585688" : "#6c6b5a22";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 30; i++) {
      let x = rnd() * w,
        y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += (rnd() - 0.5) * 22;
        y += rnd() * 19;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (road) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#161e1a";
      for (let i = 0; i < 18; i++) ctx.fillRect(rnd() * w, 0, 2 + rnd() * 6, h);
    }
  });
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(road ? 4 : 2, road ? 75 : 4);
  texture.anisotropy = 4;
  return texture;
}
const ADS = [
  ["NIGHT CITY", "FREE CITY • 2077", "#ddc885", "#293b3d"],
  ["MILITECH", "INTERNATIONAL ARMAMENTS", "#e4dab3", "#313b3b"],
  ["ARASAKA", "SECURE YOUR FUTURE", "#d95241", "#202e32"],
  ["KIROSHI", "SEE WHAT'S NEXT", "#7dd2d3", "#273e42"],
  ["SOFTSYS", "CONNECTED. ALWAYS.", "#94d6c5", "#203c42"],
  ["DATA INC", "THE FUTURE IS YOURS", "#b3d5d8", "#2d4450"],
  ["NCART", "CITY TRANSIT NETWORK", "#dec889", "#405255"],
];
function adTexture(name) {
  return canvasTexture(512, 512, (c, w, h) => {
    const n = Number(name.replace("sign-", "")) || 0,
      ad = ADS[Math.abs(n) % ADS.length];
    c.fillStyle = ad[3];
    c.fillRect(0, 0, w, h);
    c.strokeStyle = ad[2];
    c.lineWidth = 5;
    c.strokeRect(16, 16, w - 32, h - 32);
    c.globalAlpha = 0.15;
    for (let i = 0; i < 18; i++) {
      c.fillStyle = ad[2];
      c.fillRect(27, 30 + i * 25, Math.sin(i * 7.3) * 140 + 200, 2);
    }
    c.globalAlpha = 1;
    c.textAlign = "center";
    c.fillStyle = ad[2];
    c.font = "900 64px Arial";
    if (name === "sign-hotel") {
      c.fillText("HOTEL", w / 2, 230);
      c.font = "24px Arial";
      c.fillText("ホテル", w / 2, 286);
    } else if (name === "sign-kiosk") {
      c.fillStyle = "#bd923b";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#2d392e";
      c.font = "900 65px Arial";
      c.fillText("ALL FOODS", 256, 102);
      c.beginPath();
      c.arc(256, 270, 85, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#dac084";
      c.fillRect(219, 240, 74, 80);
      c.font = "24px Arial";
      c.fillText("TASTE TOMORROW", 256, 425);
    } else {
      c.save();
      c.translate(256, 236);
      if (n >= 20) c.rotate(-Math.PI / 2);
      c.fillText(ad[0], 0, 0);
      c.font = "16px Arial";
      c.fillText(ad[1], 0, 42);
      c.restore();
      c.fillStyle = ad[2];
      c.font = "900 106px Arial";
      c.fillText(n % 2 ? "77" : "NC", 256, 408);
    }
    c.globalAlpha = 0.1;
    c.fillStyle = "#000";
    for (let i = 0; i < h; i += 3) c.fillRect(0, i, w, 1);
  });
}
export class DrivingGame {
  static async create(renderer, environment, onState) {
    const root = await loadWasmModel("/assets/city.wasm");
    return new DrivingGame(renderer, root, environment, onState);
  }
  constructor(renderer, root, environment, onState) {
    this.renderer = renderer;
    this.root = root;
    this.time = 0;
    this.lastSample = -1;
    this.scene = new T.Scene();
    this.scene.add(root);
    this.scene.background = canvasTexture(4, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#b4bcb9");
      g.addColorStop(0.6, "#e0ddc9");
      g.addColorStop(1, "#e7dfc5");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    this.scene.fog = new T.FogExp2(0xd5d4c0, 0.0062);
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.32;
    this.scene.add(new T.HemisphereLight(0xd6e4eb, 0x7e7560, 1.65));
    this.sun = new T.DirectionalLight(0xffebbd, 3.25);
    this.sun.position.set(35, 65, -45);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -35,
      right: 35,
      top: 45,
      bottom: -35,
      near: 1,
      far: 180,
    });
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.sun, this.sun.target);
    this.camera = new T.PerspectiveCamera(53, 16 / 9, 0.08, 650);
    this.target = new T.WebGLRenderTarget(1536, 864, {
      type: T.HalfFloatType,
      depthBuffer: true,
      samples: 2,
    });
    this.target.texture.name = "Live 3D street";
    this.sampleTarget = new T.WebGLRenderTarget(64, 36, { depthBuffer: false });
    this.pixels = new Uint8Array(64 * 36 * 4);
    this.sampleScene = new T.Scene();
    this.sampleCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // This quad downsamples the rendered frame for the TV's edge lights; it is a postprocess, not a scene model.
    this.sampleQuad = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        uniforms: { image: { value: this.target.texture } },
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader:
          "uniform sampler2D image;varying vec2 vUv;void main(){vec3 c=texture2D(image,vUv).rgb;c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);gl_FragColor=vec4(c,1.);}",
      }),
    );
    this.sampleScene.add(this.sampleQuad);
    this.colors = Array.from({ length: 12 }, () => new T.Color());
    const asphalt = surfaceTexture(true),
      concrete = surfaceTexture(),
      materials = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      if (!materials.has(m)) {
        materials.add(m);
        if (m.name === "asphalt") {
          m.map = asphalt;
          m.roughness = 0.97;
        } else if (m.name.startsWith("concrete-")) m.map = concrete;
        else if (m.name === "tail-light") {
          m.emissive = new T.Color(0xf92516);
          m.emissiveIntensity = 1.2;
        } else if (m.name.startsWith("checkpoint-")) {
          m.emissive = new T.Color(0xb7d94a);
          m.emissiveIntensity = 0.7;
        }
      }
      if (o.name.startsWith("sign-")) {
        o.material = new T.MeshStandardMaterial({
          map: adTexture(o.name),
          roughness: 0.72,
          emissive: 0xffffff,
          emissiveIntensity: 0.5,
        });
        o.material.emissiveMap = o.material.map;
        o.castShadow = false;
      }
    });
    this.car = root.getObjectByName("player-car");
    this.wheels = this.car.children.filter((o) => o.name.startsWith("wheel-"));
    this.markers = CHECKPOINT_DISTANCES.map((_, i) =>
      root.getObjectByName(`checkpoint-${i}`),
    );
    this.state = new DriveState(onState);
    this.update(0);
    // Capture the built street so the paint and windows reflect their surroundings.
    const cubeTarget = new T.WebGLCubeRenderTarget(128, {
      type: T.HalfFloatType,
    });
    const probe = new T.CubeCamera(0.1, 500, cubeTarget);
    probe.position.set(2, 1.5, -5);
    this.car.visible = false;
    this.markers.forEach((m) => (m.visible = false));
    probe.update(renderer, this.scene);
    const pmrem = new T.PMREMGenerator(renderer);
    this.streetEnvironment = pmrem.fromCubemap(cubeTarget.texture);
    this.scene.environment = this.streetEnvironment.texture;
    pmrem.dispose();
    cubeTarget.dispose();
    this.car.visible = true;
    this.markers.forEach((m) => (m.visible = true));
    const paint = new T.MeshPhysicalMaterial({
      color: 0x087b87,
      metalness: 0.68,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.8,
    });
    this.car.traverse((o) => {
      if (o.isMesh && o.material.name === "car-paint") o.material = paint;
    });
  }
  reset(aoi) {
    this.state.reset(aoi);
    this.update(0);
  }
  update(delta) {
    this.time += delta;
    const before = this.state.distance;
    this.state.update(delta);
    this.car.position.set(
      2,
      Math.sin(this.time * 17) *
        Math.min(0.009, Math.abs(this.state.speed) * 0.001),
      -this.state.distance,
    );
    for (const wheel of this.wheels)
      wheel.rotation.x -= (this.state.distance - before) / 0.45;
    const distance = this.state.distance;
    this.camera.position.set(7.8, 3.6, 7.4 - distance);
    this.camera.lookAt(1.8, 1.8, -8 - distance);
    this.sun.position.set(35, 65, -45 - distance);
    this.sun.target.position.set(0, 0, -35 - distance);
    this.markers.forEach((marker, i) => {
      marker.visible = this.state.arrived !== i;
      const diamond = marker.children.find((o) =>
        o.name.startsWith("checkpoint-diamond"),
      );
      diamond.rotation.y = this.time * 0.65;
      const selected = this.state.selected === i;
      marker.children.forEach((o) => {
        o.material.emissiveIntensity = selected ? 2 : 0.35;
      });
    });
  }
  render() {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    if (this.time - this.lastSample > 0.2) {
      this.renderer.setRenderTarget(this.sampleTarget);
      this.renderer.render(this.sampleScene, this.sampleCamera);
      this.renderer.readRenderTargetPixels(
        this.sampleTarget,
        0,
        0,
        64,
        36,
        this.pixels,
      );
      const samples = [
        ...[1, 62].flatMap((x) => [29, 18, 6].map((y) => [x, y])),
        ...[34, 1].flatMap((y) => [10, 32, 53].map((x) => [x, y])),
      ];
      samples.forEach(([x, y], i) => {
        const k = (y * 64 + x) * 4;
        this.colors[i].setRGB(
          this.pixels[k] / 255,
          this.pixels[k + 1] / 255,
          this.pixels[k + 2] / 255,
        );
      });
      this.lastSample = this.time;
    }
    this.renderer.setRenderTarget(null);
  }
}

export class DrivingControls {
  constructor(viewer) {
    this.viewer = viewer;
    this.game = null;
    this.keys = new Set();
    this.pointer = 0;
    this.dom = document.querySelector("#driving-ui");
    this.question = document.querySelector("#checkpoint-question");
    this.buttons = [...document.querySelectorAll("[data-checkpoint]")];
    this.buttons.forEach((b, i) =>
      b.addEventListener("click", () => this.game?.state.select(i)),
    );
    document
      .querySelector("#return-home")
      .addEventListener("click", () => viewer.returnHome());
    document
      .querySelector("#dismiss-question")
      .addEventListener("click", () => {
        this.game.state.arrived = null;
        this.sync(this.game.state);
        document.querySelector('[data-drive="1"]').focus();
      });
    for (const button of document.querySelectorAll("[data-drive]")) {
      button.addEventListener("pointerdown", (e) => {
        button.setPointerCapture(e.pointerId);
        this.pointer = Number(button.dataset.drive);
        this.applyInput();
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(name, () => {
          this.pointer = 0;
          this.applyInput();
        });
      button.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          this.pointer = Number(button.dataset.drive);
          this.applyInput();
        }
      });
      button.addEventListener("keyup", (e) => {
        if (e.code === "Space" || e.code === "Enter") {
          this.pointer = 0;
          this.applyInput();
        }
      });
      button.addEventListener("blur", () => {
        this.pointer = 0;
        this.applyInput();
      });
    }
    addEventListener("keydown", (e) => {
      if (
        !this.active ||
        e.target.matches("textarea,input,select") ||
        !this.question.hidden
      )
        return;
      if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
        this.applyInput();
      }
      if (e.code === "Escape") viewer.returnHome();
    });
    addEventListener("keyup", (e) => {
      if (this.keys.delete(e.code)) this.applyInput();
    });
    addEventListener("blur", () => this.release());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.release();
    });
  }
  setActive(active) {
    this.active = active;
    this.dom.hidden = !active;
    if (!active) this.release();
  }
  release() {
    this.keys.clear();
    this.pointer = 0;
    this.applyInput();
  }
  applyInput() {
    const direction =
      this.pointer ||
      (this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0) -
        (this.keys.has("ArrowDown") || this.keys.has("KeyS") ? 1 : 0);
    if (this.game && this.active) this.game.state.drive(direction);
  }
  bind(game) {
    this.game = game;
    this.setActive(true);
    this.sync(game.state);
  }
  sync(state) {
    this.buttons.forEach((b, i) => {
      b.setAttribute("aria-pressed", String(state.selected === i));
      b.classList.toggle("answered", state.answers.has(i));
    });
    document.querySelector("#game-aoi").textContent = AOIS[state.aoi];
    this.question.hidden = state.arrived === null;
    if (state.arrived !== null) {
      this.release();
      const question = QUESTIONS[AOIS[state.aoi]][state.arrived];
      document.querySelector("#question-number").textContent =
        `${AOIS[state.aoi]} / CHECKPOINT ${String(state.arrived + 1).padStart(2, "0")}`;
      document.querySelector("#question-prompt").textContent =
        question?.prompt || "Question coming soon.";
      const options = document.querySelector("#question-options");
      options.replaceChildren();
      for (const [i, text] of (question?.options || []).entries()) {
        const button = document.createElement("button");
        button.textContent = text;
        button.setAttribute(
          "aria-pressed",
          String(state.answers.get(state.arrived) === i),
        );
        button.addEventListener("click", () => {
          state.answer(i);
          document.querySelector("#question-feedback").textContent =
            question.answer === undefined
              ? "Answer saved."
              : i === question.answer
                ? "Correct."
                : "Try again.";
        });
        options.append(button);
      }
      document.querySelector("#question-feedback").textContent = "";
      document.querySelector("#scene-status").textContent =
        `Checkpoint ${state.arrived + 1}. ${question?.prompt || "Question coming soon."}`;
      document
        .querySelector("#dismiss-question")
        .focus({ preventScroll: true });
    }
  }
  update() {
    if (!this.active) return;
    const { distance, speed, target, selected } = this.game.state;
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el.textContent !== value) el.textContent = value;
    };
    setText(
      "drive-speed",
      `${Math.round(Math.abs(speed) * 3.6)
        .toString()
        .padStart(2, "0")} KM/H`,
    );
    setText(
      "drive-direction",
      speed < -0.1 ? "REVERSE" : speed > 0.1 ? "FORWARD" : "PARKED",
    );
    setText(
      "route-status",
      target !== null
        ? `${target > distance ? "DRIVING TO" : "REVERSING TO"} CHECKPOINT ${selected + 1} · ${Math.ceil(Math.abs(target - distance))} M`
        : this.game.state.arrived !== null
          ? `CHECKPOINT ${this.game.state.arrived + 1} · ARRIVED`
          : "SELECT A CHECKPOINT TO DRIVE",
    );
    document.querySelector("#route-progress").style.width =
      `${(distance / 202) * 100}%`;
  }
}
