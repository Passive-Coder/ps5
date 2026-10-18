import * as T from "three";
import { loadWasmModel } from "./wasm-model.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import {
  canvasTexture,
  loadCityMaterials,
  decorateCity,
} from "./city-materials.js";
import {
  AOIS,
  DRIVE_LANE_X,
  roadX,
  roadHeading,
  CHECKPOINT_DISTANCES,
  QUESTIONS,
  DriveState,
} from "./checkpoints.js";

const jointFrom = new T.Vector3(),
  jointTo = new T.Vector3(),
  jointDirection = new T.Vector3();
const parentInverse = new T.Quaternion(),
  jointWorld = new T.Quaternion();
const rootWorld = new T.Quaternion(),
  jointCorrection = new T.Quaternion();
function aimJoint(person, name, x, y, z) {
  const [bone, child] = person.joints[name];
  if (!bone || !child) return;
  bone.getWorldPosition(jointFrom);
  child.getWorldPosition(jointTo).sub(jointFrom).normalize();
  person.root.getWorldQuaternion(rootWorld);
  jointDirection.set(x, y, z).normalize().applyQuaternion(rootWorld);
  jointCorrection.setFromUnitVectors(jointTo, jointDirection);
  bone.getWorldQuaternion(jointWorld);
  bone.parent.getWorldQuaternion(parentInverse).invert();
  bone.quaternion.copy(
    parentInverse.multiply(jointCorrection).multiply(jointWorld),
  );
  bone.updateWorldMatrix(false, true);
}
function posePedestrian(person, time) {
  const stride = Math.sin(time * 3.4 + person.phase) * 0.24;
  for (const [side, direction] of [
    ["Left", 1],
    ["Right", -1],
  ]) {
    const step = stride * direction;
    aimJoint(person, `${side}Arm`, direction * 0.13, -1, -step * 0.8);
    aimJoint(person, `${side}ForeArm`, direction * 0.02, -1, 0.11 - step * 0.3);
    aimJoint(person, `${side}UpLeg`, direction * 0.035, -1, step);
    aimJoint(
      person,
      `${side}Leg`,
      direction * 0.015,
      -1,
      0.04 - Math.max(0, step) * 1.5,
    );
    aimJoint(person, `${side}Foot`, 0, -0.07, 1);
  }
}

export class DrivingGame {
  static async create(renderer, environment, onState) {
    const [root, assets, pedestrian] = await Promise.all([
      loadWasmModel("/assets/city.wasm"),
      loadCityMaterials(renderer),
      loadWasmModel("/assets/pedestrian.wasm"),
    ]);
    return new DrivingGame(
      renderer,
      root,
      environment,
      onState,
      assets,
      pedestrian,
    );
  }
  constructor(renderer, root, environment, onState, assets, pedestrian) {
    this.renderer = renderer;
    this.root = root;
    this.time = 0;
    this.lastSample = -1;
    this.scene = new T.Scene();
    this.scene.add(root);
    this.scene.background = canvasTexture(4, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#c8cec8");
      g.addColorStop(0.6, "#e0dfd0");
      g.addColorStop(1, "#fff0da");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    this.scene.fog = new T.Fog(0xe3ddcb, 48, 270);
    this.scene.environment = assets.environment.texture;
    this.scene.environmentIntensity = 0.65;
    this.scene.environmentRotation.y = -1.1;
    this.scene.add(new T.HemisphereLight(0xc0d2d8, 0x776849, 1.35));
    this.sun = new T.DirectionalLight(0xffebc7, 5.8);
    this.sun.position.set(55, 70, -75);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
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
    this.bounce = new T.DirectionalLight(0xdce2d7, 0.65);
    this.scene.add(this.bounce, this.bounce.target);
    this.camera = new T.PerspectiveCamera(54, 16 / 9, 0.08, 650);
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
    const logo = document.querySelector(".cyberpunk-wordmark");
    const logoContext = logo.getContext("2d");
    logoContext.drawImage(assets.street, 10, 16, 146, 49, 0, 0, 584, 196);
    const logoPixels = logoContext.getImageData(0, 0, 584, 196);
    for (let k = 0; k < logoPixels.data.length; k += 4) {
      const [r, g, b] = logoPixels.data.subarray(k, k + 3);
      const yellow = Math.min(r, g) - b;
      logoPixels.data[k + 3] *=
        Math.max(0, Math.min(1, (yellow - 24) / 22)) *
        Math.max(0, Math.min(1, (Math.min(r, g) - 85) / 35));
    }
    logoContext.putImageData(logoPixels, 0, 0);
    this.people = [];
    const height = new T.Box3()
      .setFromObject(pedestrian)
      .getSize(new T.Vector3()).y;
    for (let i = 0; i < 14; i++) {
      const person = cloneSkeleton(pedestrian);
      person.scale.multiplyScalar((1.78 + (i % 3) * 0.04) / height);
      person.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        o.material = o.material.clone();
        o.material.roughness = 0.88;
        o.material.metalness = 0;
        if (o.material.name.endsWith("_body"))
          o.material.color.set(
            i === 0 ? 0xffffff : [0xb4b9b5, 0x929e9d, 0xa29b87][i % 3],
          );
        if (i === 0 && o.material.name.endsWith("_body") && o.material.map) {
          const original = o.material.map;
          const map = canvasTexture(512, 512, (c, w, h) => {
            c.drawImage(original.image, 0, 0, w, h);
            const pixels = c.getImageData(0, 0, w, h);
            for (let y = 0; y < 425; y++)
              for (let x = 0; x < w; x++) {
                const k = (y * w + x) * 4;
                const r = pixels.data[k],
                  g = pixels.data[k + 1],
                  b = pixels.data[k + 2];
                const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                if (y < 188) {
                  pixels.data[k] = light * 74;
                  pixels.data[k + 1] = light * 77;
                  pixels.data[k + 2] = light * 73;
                } else {
                  const shirt = b > r * 1.2 && b > g * 0.9;
                  const shade = shirt ? 0.55 + light * 0.5 : 0.25 + light * 0.8;
                  const color = shirt ? [158, 143, 118] : [139, 108, 75];
                  for (let j = 0; j < 3; j++)
                    pixels.data[k + j] = color[j] * shade;
                }
              }
            c.putImageData(pixels, 0, 0);
          });
          map.flipY = original.flipY;
          o.material.map = map;
        }
      });
      this.scene.add(person);
      const joints = {};
      for (const side of ["Left", "Right"])
        for (const [bone, child] of [
          ["Arm", "ForeArm"],
          ["ForeArm", "Hand"],
          ["UpLeg", "Leg"],
          ["Leg", "Foot"],
          ["Foot", "ToeBase"],
        ])
          joints[`${side}${bone}`] = [
            person.getObjectByName(`${side}${bone}`),
            person.getObjectByName(`${side}${child}`),
          ];
      this.people.push({
        root: person,
        joints,
        phase: i * 1.3,
        x: i === 0 ? 11.1 : 11.2 + (i % 3) * 1.1,
        z: i === 0 ? 1 : -8 - i * 13,
        direction: i === 0 || i % 4 === 3 ? -1 : 1,
      });
    }
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
      color: 0x147e8a,
      metalness: 0.46,
      roughness: 0.19,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      envMapIntensity: 1.5,
    });
    const pearl = new T.MeshPhysicalMaterial({
      color: 0xe9e8db,
      metalness: 0.32,
      roughness: 0.18,
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
    for (const person of this.people) {
      const d = -person.z + Math.sin(this.time * 0.12 + person.phase) * 0.35;
      person.root.position.set(person.x + roadX(d) - DRIVE_LANE_X, 0.26, -d);
      person.root.rotation.y =
        (person.direction > 0 ? Math.PI : 0) + roadHeading(d);
      posePedestrian(person, this.time);
      const leftToe = person.joints.LeftFoot[1].getWorldPosition(jointFrom).y;
      const rightToe = person.joints.RightFoot[1].getWorldPosition(jointTo).y;
      person.root.position.y += 0.3 - Math.min(leftToe, rightToe);
    }
    this.car.position.set(
      roadX(this.state.distance),
      Math.sin(this.time * 17) *
        Math.min(0.009, Math.abs(this.state.speed) * 0.001),
      -this.state.distance,
    );
    this.car.rotation.y = roadHeading(this.state.distance);
    for (const wheel of this.wheels)
      wheel.rotation.x -=
        (this.state.distance - before) / (0.36 * this.car.scale.y);
    const distance = this.state.distance;
    this.camera.position.set(roadX(distance - 8.4) + 5.1, 2.65, 8.4 - distance);
    this.camera.lookAt(roadX(distance + 14) - 1.35, 2.12, -14 - distance);
    this.sun.position.set(roadX(distance) + 46, 59, -68 - distance);
    this.sun.target.position.set(roadX(distance), 0, -22 - distance);
    this.bounce.position.set(roadX(distance) - 12, 8, 12 - distance);
    this.bounce.target.position.set(roadX(distance), 1, -distance);
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
