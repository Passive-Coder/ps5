import * as T from "three";
import { loadWasmModel } from "./wasm-model.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import {
  canvasTexture,
  loadCityMaterials,
  decorateCity,
} from "./city-materials.js";
import {
  AOIS,
  DRIVE_LANE_X,
  CHECKPOINT_DISTANCES,
  QUESTIONS,
  DriveState,
} from "./checkpoints.js";

export class DrivingGame {
  static async create(renderer, environment, onState) {
    const [root, assets] = await Promise.all([
      loadWasmModel("/assets/city.wasm"),
      loadCityMaterials(renderer),
    ]);
    return new DrivingGame(renderer, root, environment, onState, assets);
  }
  constructor(renderer, root, environment, onState, assets) {
    this.renderer = renderer;
    this.root = root;
    this.time = 0;
    this.lastSample = -1;
    this.scene = new T.Scene();
    this.scene.add(root);
    this.scene.background = canvasTexture(4, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#aebbc0");
      g.addColorStop(0.6, "#deddd2");
      g.addColorStop(1, "#f0e8d6");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    this.scene.fog = new T.Fog(0xe0dbca, 65, 330);
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.42;
    this.scene.add(new T.HemisphereLight(0xb7d6e5, 0x716853, 1.5));
    this.sun = new T.DirectionalLight(0xffefd2, 4.1);
    this.sun.position.set(55, 70, -75);
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
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2;
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.sun, this.sun.target);
    this.camera = new T.PerspectiveCamera(53, 16 / 9, 0.08, 650);
    this.target = new T.WebGLRenderTarget(1536, 864, {
      type: T.HalfFloatType,
      depthBuffer: true,
      samples: 2,
    });
    this.target.texture.name = "Live 3D street";
    this.beautyTarget = this.target.clone();
    this.ao = new GTAOPass(this.scene, this.camera, 768, 432);
    this.ao.updateGtaoMaterial({
      radius: 1.1,
      thickness: 0.35,
      distanceFallOff: 0.7,
      scale: 0.8,
      samples: 16,
    });
    this.ao.blendIntensity = 0.62;
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
    decorateCity(root, assets);
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
    probe.position.set(DRIVE_LANE_X, 1.5, -5);
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
      color: 0x087b88,
      metalness: 0.55,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      envMapIntensity: 1.15,
    });
    const pearl = new T.MeshPhysicalMaterial({
      color: 0xd7d8c9,
      metalness: 0.32,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1,
    });
    const lower = new T.MeshPhysicalMaterial({
      color: 0x073947,
      metalness: 0.48,
      roughness: 0.26,
      clearcoat: 0.7,
      clearcoatRoughness: 0.16,
    });
    this.car.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.name === "car-paint") o.material = paint;
      else if (o.material.name === "car-pearl") o.material = pearl;
      else if (o.material.name === "car-lower-paint") o.material = lower;
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
      DRIVE_LANE_X,
      Math.sin(this.time * 17) *
        Math.min(0.009, Math.abs(this.state.speed) * 0.001),
      -this.state.distance,
    );
    for (const wheel of this.wheels)
      wheel.rotation.x -=
        (this.state.distance - before) / (0.43 * this.car.scale.y);
    const distance = this.state.distance;
    this.camera.position.set(DRIVE_LANE_X + 5, 2.4, 7.6 - distance);
    this.camera.lookAt(DRIVE_LANE_X + 0.7, 2.15, -8 - distance);
    this.sun.position.set(55, 70, -75 - distance);
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
    this.renderer.setRenderTarget(this.beautyTarget);
    this.renderer.render(this.scene, this.camera);
    const shadowUpdate = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    this.ao.render(this.renderer, this.target, this.beautyTarget);
    this.renderer.shadowMap.autoUpdate = shadowUpdate;
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
