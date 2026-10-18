import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { TelevisionScreen, MENU_RECTS, drawPS } from "./screen.js";

const clamp = T.MathUtils.clamp;
const ease = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

async function loadRoom() {
  const response = await fetch("/assets/room.wasm");
  if (!response.ok) throw new Error(`Room asset returned ${response.status}`);
  const { instance } = await WebAssembly.instantiateStreaming(response);
  const { memory, model_ptr, model_size } = instance.exports;
  const bytes = memory.buffer.slice(model_ptr(), model_ptr() + model_size());
  const decoder = new DRACOLoader().setDecoderPath("/draco/").setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  try {
    return (await loader.parseAsync(bytes, "/assets/")).scene;
  } finally {
    decoder.dispose();
  }
}

export class RoomExperience {
  static async create(canvas, onPhase) {
    const [root, screen] = await Promise.all([
      loadRoom(),
      TelevisionScreen.create(),
    ]);
    return new RoomExperience(canvas, root, screen, onPhase);
  }
  constructor(canvas, root, screen, onPhase) {
    this.canvas = canvas;
    this.root = root;
    this.screen = screen;
    this.onPhase = onPhase;
    this.time = 0;
    this.previous = 0;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0xc1beb3);
    this.scene.add(root);
    this.camera = new T.PerspectiveCamera(
      34,
      innerWidth / innerHeight,
      0.05,
      150,
    );
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.23;
    room.dispose();
    pmrem.dispose();
    this.ps5 = root.getObjectByName("ps5");
    this.tv = root.getObjectByName("television");
    this.tvScreen = root.getObjectByName("tv-screen");
    this.cabinet = root.getObjectByName("cabinet");
    this.controller = root.getObjectByName("controller");
    this.gameCase = root.getObjectByName("game-case");
    this.disc = root.getObjectByName("disc");
    if (!this.ps5 || !this.tvScreen || !this.disc)
      throw new Error("Required room meshes are missing");
    this.powerMesh = root.getObjectByName("power-button");
    this.restDisc = this.disc.position.clone();
    this.hoverPosition = this.restDisc
      .clone()
      .add(new T.Vector3(1.35, 0.32, 0.22));
    this.discOut = 0;
    this.discTarget = 0;
    this.lights = [];
    this.leds = [];
    this.ambilight = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.name.startsWith("console-light")) {
        object.material = object.material.clone();
        object.material.color.set(0x080c12);
        object.material.emissive = new T.Color(0x2e69ff);
        object.material.emissiveIntensity = 0;
        this.leds.push(object);
      }
      if (object.name.startsWith("ambilight-")) {
        object.castShadow = false;
        object.receiveShadow = false;
        object.material = this.haloMaterial();
        this.ambilight.push(object);
      }
    });
    this.powerMesh.material = this.powerMesh.material.clone();
    this.tvScreen.material = new T.MeshBasicMaterial({
      map: screen.texture,
      color: 0xffffff,
      toneMapped: false,
    });
    this.tvScreen.castShadow = false;
    root.getObjectByName("case-art").material = new T.MeshStandardMaterial({
      map: screen.caseTexture(),
      roughness: 0.4,
      emissive: 0xffffff,
      emissiveIntensity: 0.1,
    });
    root.getObjectByName("disc-art").material = new T.MeshStandardMaterial({
      map: screen.discTexture(),
      metalness: 0.6,
      roughness: 0.26,
      side: T.DoubleSide,
    });
    this.applyMarks();
    this.setupLights();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new T.Vector2(innerWidth, innerHeight),
      0.23,
      0.65,
      1.8,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.closePosition = new T.Vector3(-5.7, 6.65, 9.1);
    this.closeTarget = new T.Vector3(-7.25, 6.03, 0.43);
    this.camera.position.copy(this.closePosition);
    this.lookTarget = this.closeTarget.clone();
    this.camera.lookAt(this.lookTarget);
    this.tv.visible = false;
    this.controller.visible = false;
    this.gameCase.visible = false;
    this.disc.visible = false;
    for (const child of this.cabinet.children)
      child.visible = child.name === "worktop";
    this.dom = {
      power: document.querySelector("#power-control"),
      gameCase: document.querySelector("#case-control"),
      disc: document.querySelector("#disc-control"),
      menu: document.querySelector("#aoi-menu"),
    };
    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    this.resize();
    addEventListener("resize", this.resize);
    this.setPhase("off");
    this.renderer.setAnimationLoop(this.frame);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.setActive(false);
      document.querySelector("#error").hidden = false;
    });
  }
  haloMaterial() {
    return new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new T.Color() }, strength: { value: 0 } },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader:
        "varying vec2 vUv;uniform vec3 color;uniform float strength;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*3.2)*strength;gl_FragColor=vec4(color,a);}",
      side: T.DoubleSide,
    });
  }
  applyMarks() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    drawPS(canvas.getContext("2d"), 128, 128, 220, "#11151b");
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    this.root.traverse((object) => {
      if (object.name.startsWith("playstation-mark")) {
        object.material = new T.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        });
        object.castShadow = false;
      }
    });
  }
  setupLights() {
    this.ambient = new T.HemisphereLight(0xd6e4ff, 0x7c6c55, 1.1);
    this.scene.add(this.ambient);
    this.key = new T.DirectionalLight(0xffe9cd, 2.7);
    this.key.position.set(-7, 17, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, {
      left: -13,
      right: 13,
      top: 15,
      bottom: -8,
      near: 0.1,
      far: 45,
    });
    this.key.shadow.normalBias = 0.025;
    this.key.shadow.bias = -0.0003;
    this.scene.add(this.key);
    this.fill = new T.DirectionalLight(0xdae8ff, 1);
    this.fill.position.set(8, 12, 8);
    this.scene.add(this.fill);
    this.consoleGlow = new T.PointLight(0x2a6fff, 0, 5, 2);
    this.consoleGlow.position.set(-7.3, 6, 1.9);
    this.scene.add(this.consoleGlow);
    for (const halo of this.ambilight) {
      const light = new T.PointLight(0x8ea7ff, 0, 8, 1.5);
      light.position.copy(halo.position);
      light.position.z = -0.95;
      this.scene.add(light);
      this.lights.push(light);
    }
    this.screenFill = new T.SpotLight(0x9cc4ee, 0, 19, Math.PI / 2.7, 1, 1.5);
    this.screenFill.position.set(0, 8, 1.2);
    this.screenFill.target.position.set(0, 2.5, 5);
    this.scene.add(this.screenFill, this.screenFill.target);
  }
  setPhase(phase) {
    this.phase = phase;
    this.phaseStart = this.time;
    this.onPhase(phase);
    this.dom.power.hidden = phase !== "off";
    this.dom.gameCase.hidden = phase !== "ready";
    this.dom.disc.hidden = true;
    this.dom.menu.hidden = phase !== "home";
  }
  powerOn() {
    if (this.phase !== "off") return;
    this.powerStart = this.time;
    this.setPhase("boot");
    this.tv.visible = true;
    this.controller.visible = true;
    this.gameCase.visible = true;
    this.disc.visible = true;
    for (const child of this.cabinet.children) child.visible = true;
  }
  hoverDisc(out) {
    if (this.phase === "ready") this.discTarget = out ? 1 : 0;
  }
  insertDisc() {
    if (this.phase !== "ready" || this.discOut < 0.15) return;
    this.root.updateMatrixWorld(true);
    this.flightStart = this.disc.position.clone();
    this.flightRotation = this.disc.quaternion.clone();
    this.approach = this.ps5.localToWorld(new T.Vector3(0.49, -1.053, 1.98));
    this.inserted = this.ps5.localToWorld(new T.Vector3(0.49, -1.053, 0.43));
    this.discRotation = this.ps5.quaternion
      .clone()
      .multiply(
        new T.Quaternion().setFromAxisAngle(
          new T.Vector3(0, 1, 0),
          Math.PI / 2,
        ),
      );
    this.flight = new T.CubicBezierCurve3(
      this.flightStart,
      this.flightStart.clone().add(new T.Vector3(-1, 2.3, 2.1)),
      this.approach.clone().add(new T.Vector3(1, 1.4, 1)),
      this.approach,
    );
    this.setPhase("inserting");
  }
  selectAOI(index) {
    if (this.phase === "home" && index >= 0 && index < 4)
      this.screen.select(index, this.time);
  }
  setActive(active) {
    this.previous = 0;
    this.renderer.setAnimationLoop(active ? this.frame : null);
    if (active) this.resize();
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    const verticalSize = Math.max(13.0, 20.1 / this.camera.aspect),
      distance = verticalSize / (2 * Math.tan(T.MathUtils.degToRad(17)));
    this.widePosition = new T.Vector3(0, 6.65, distance);
    this.wideTarget = new T.Vector3(0, 6.1, 0);
    if (this.phase && this.phase !== "off" && this.phase !== "boot") {
      this.camera.position.copy(this.widePosition);
      this.lookTarget.copy(this.wideTarget);
      this.camera.lookAt(this.lookTarget);
    }
  }
  projected(point) {
    const p = point.clone().project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-0.5 * p.y + 0.5) * this.height,
    };
  }
  placeObject(element, object, padding = 0) {
    const bounds = new T.Box3().setFromObject(object),
      points = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          points.push(this.projected(new T.Vector3(x, y, z)));
    const left = Math.min(...points.map((p) => p.x)) - padding,
      top = Math.min(...points.map((p) => p.y)) - padding;
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.width = `${Math.max(...points.map((p) => p.x)) - left + padding}px`;
    element.style.height = `${Math.max(...points.map((p) => p.y)) - top + padding}px`;
  }
  screenPoint(x, y) {
    return this.projected(
      this.tvScreen.localToWorld(
        new T.Vector3(
          (x / 1920 - 0.5) * 11.59,
          (0.5 - y / 1080) * 6.5194,
          0.012,
        ),
      ),
    );
  }
  updateControls() {
    this.root.updateMatrixWorld(true);
    if (this.phase === "off") {
      const p = this.projected(
        this.powerMesh.getWorldPosition(new T.Vector3()),
      );
      this.dom.power.style.left = `${p.x}px`;
      this.dom.power.style.top = `${p.y}px`;
    }
    if (this.phase === "ready") {
      this.placeObject(this.dom.gameCase, this.gameCase, 6);
      this.dom.disc.hidden = this.discOut < 0.75;
      if (!this.dom.disc.hidden) {
        this.placeObject(this.dom.disc, this.disc, 5);
        if (document.activeElement === this.dom.gameCase)
          this.dom.disc.focus({ preventScroll: true });
      }
    }
    if (this.phase === "home")
      MENU_RECTS.forEach((r, index) => {
        const a = this.screenPoint(r.x, r.y),
          b = this.screenPoint(r.x + r.width, r.y + r.height),
          button = this.dom.menu.children[index];
        button.style.left = `${a.x}px`;
        button.style.top = `${a.y}px`;
        button.style.width = `${b.x - a.x}px`;
        button.style.height = `${b.y - a.y}px`;
      });
  }
  frame(timestamp) {
    const delta = this.previous
      ? Math.min((timestamp - this.previous) / 1000, 0.06)
      : 0;
    this.previous = timestamp;
    this.time += delta;
    const elapsed = this.time - this.phaseStart;
    if (this.phase === "boot") {
      const duration = this.reducedMotion ? 1.6 : 5.2,
        t = ease((elapsed - 0.8) / (duration - 0.8));
      this.camera.position.lerpVectors(
        this.closePosition,
        this.widePosition,
        t,
      );
      this.lookTarget.lerpVectors(this.closeTarget, this.wideTarget, t);
      this.camera.lookAt(this.lookTarget);
      if (elapsed > duration) this.setPhase("ready");
    }
    if (this.phase !== "off") {
      const poweredTime = this.time - this.powerStart,
        on = clamp(poweredTime * 0.9, 0, 1),
        white = clamp((poweredTime - 3) / 2, 0, 1),
        ledColor = new T.Color(0x286fff).lerp(
          new T.Color(0xc6e3ff),
          white * 0.65,
        );
      this.leds.forEach((led) => {
        led.material.emissive.copy(ledColor);
        led.material.emissiveIntensity =
          (8 + Math.sin(this.time * 5) * 0.35) * on;
      });
      this.powerMesh.material.emissive.set(0x8ac5ff);
      this.powerMesh.material.emissiveIntensity = 5 * on;
      this.consoleGlow.intensity = 2.2 * on;
      const night = this.phase === "home" || this.phase === "loading";
      this.ambient.intensity = T.MathUtils.damp(
        this.ambient.intensity,
        night ? 0.1 : 0.9,
        1,
        delta,
      );
      this.key.intensity = T.MathUtils.damp(
        this.key.intensity,
        night ? 0.18 : 2.0,
        1,
        delta,
      );
      this.fill.intensity = T.MathUtils.damp(
        this.fill.intensity,
        night ? 0.08 : 0.85,
        1,
        delta,
      );
      this.scene.environmentIntensity = T.MathUtils.damp(
        this.scene.environmentIntensity,
        night ? 0.05 : 0.23,
        1,
        delta,
      );
      this.screenFill.intensity = T.MathUtils.damp(
        this.screenFill.intensity,
        night ? 8 : 2,
        1,
        delta,
      );
    }
    if (this.phase === "ready") {
      this.discOut = T.MathUtils.damp(this.discOut, this.discTarget, 7, delta);
      this.disc.position.lerpVectors(
        this.restDisc,
        this.hoverPosition,
        this.discOut,
      );
      this.disc.rotation.set(
        0,
        -this.discOut * 0.18,
        this.discOut * Math.sin(this.time * 0.8) * 0.05,
      );
    }
    if (this.phase === "inserting") {
      const fly = this.reducedMotion ? 0.6 : 1.9,
        slide = this.reducedMotion ? 0.4 : 1.2;
      if (elapsed < fly) {
        const p = ease(elapsed / fly);
        this.disc.position.copy(this.flight.getPoint(p));
        this.disc.quaternion.slerpQuaternions(
          this.flightRotation,
          this.discRotation,
          p,
        );
      } else {
        const p = ease((elapsed - fly) / slide);
        this.disc.position.lerpVectors(this.approach, this.inserted, p);
        this.disc.quaternion.copy(this.discRotation);
      }
      if (elapsed > fly + slide) {
        this.disc.visible = false;
        this.setPhase("loading");
      }
    }
    if (this.phase === "loading" && elapsed > 1.7) this.setPhase("home");
    if (
      this.screen.update(this.phase, this.time, this.time - this.phaseStart)
    ) {
      this.ambilight.forEach((halo, index) => {
        const color = this.screen.colors[index];
        halo.material.uniforms.color.value.copy(color);
        halo.material.uniforms.strength.value =
          this.phase === "off"
            ? 0
            : this.phase === "home" || this.phase === "loading"
              ? 0.9
              : 0.15;
        this.lights[index].color.copy(color);
        this.lights[index].intensity =
          this.phase === "off" ? 0 : this.phase === "home" ? 1.2 : 0.4;
      });
    }
    this.updateControls();
    this.composer.render();
  }
}
