import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { buildConsole, buildController, CONSOLES, disposeModel } from './models.js';

export class StudioViewer {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.variant = 'pro';
    this.orientation = 'vertical';
    this.theme = 'light';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf6f6f3, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.65;
    room.dispose();
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 26;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.04;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.7;
    this.controls.addEventListener('start', () => { this.transition = null; });

    this.setupLights();
    this.setupGround();
    this.console = buildConsole('pro');
    this.controller = buildController();
    this.scene.add(this.console, this.controller);
    this.setLayout(false);
    this.resize();
    this.resetView(false);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(viewport);
    this.clock = new THREE.Timer();
    this.frame = this.frame.bind(this);
    this.renderer.setAnimationLoop(this.frame);
    canvas.addEventListener('keydown', event => this.onKey(event));
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.renderer.setAnimationLoop(null);
      viewport.dispatchEvent(new CustomEvent('viewer-error', { detail: 'The graphics connection was interrupted. Reload the studio to reconnect.' }));
    });
    document.addEventListener('visibilitychange', () => {
      this.renderer.setAnimationLoop(document.hidden ? null : this.frame);
      this.clock.reset();
    });
  }

  setupLights() {
    this.ambient = new THREE.HemisphereLight(0xf2f6ff, 0xa0a09a, 2.0);
    this.scene.add(this.ambient);
    this.key = new THREE.DirectionalLight(0xfffaf1, 4.2);
    this.key.position.set(-3, 7, 5);
    this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0xe8efff, 2.0);
    this.fill.position.set(5, 4, 3);
    this.scene.add(this.fill);
    this.rim = new THREE.DirectionalLight(0xffffff, 3);
    this.rim.position.set(2, 6, -5);
    this.scene.add(this.rim);
  }

  setupGround() {
    const size = 512;
    this.shadowTarget = new THREE.WebGLRenderTarget(size, size);
    this.blurTarget = new THREE.WebGLRenderTarget(size, size);
    this.shadowCamera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.001, 6);
    this.shadowCamera.position.set(0, -0.02, 0);
    this.shadowCamera.up.set(0, 0, -1);
    this.shadowCamera.lookAt(0, 1, 0);
    this.shadowMaterial = new THREE.ShaderMaterial({
      vertexShader: 'varying float vHeight; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vHeight = max(worldPosition.y, 0.0); gl_Position = projectionMatrix * viewMatrix * worldPosition; }',
      fragmentShader: 'varying float vHeight; void main() { gl_FragColor = vec4(0.08, 0.09, 0.11, exp(-vHeight * 3.4) * 0.48); }',
      side: THREE.DoubleSide,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ map: this.shadowTarget.texture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.7 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.scale.x = -1;
    this.ground.material.side = THREE.DoubleSide;
    this.ground.position.y = -0.01;
    this.scene.add(this.ground);
    this.blurScene = new THREE.Scene();
    this.blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.horizontalBlur = new THREE.ShaderMaterial({ ...HorizontalBlurShader, uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms), depthTest: false, depthWrite: false });
    this.verticalBlur = new THREE.ShaderMaterial({ ...VerticalBlurShader, uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms), depthTest: false, depthWrite: false });
    this.blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.horizontalBlur);
    this.blurScene.add(this.blurQuad);
    this.shadowDirty = true;
  }

  updateGround() {
    const previousTarget = this.renderer.getRenderTarget();
    const previousClear = this.renderer.getClearColor(new THREE.Color());
    const previousAlpha = this.renderer.getClearAlpha();
    const previousBackground = this.scene.background;
    this.ground.visible = false;
    this.scene.background = null;
    this.scene.overrideMaterial = this.shadowMaterial;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(this.shadowTarget);
    this.renderer.render(this.scene, this.shadowCamera);
    this.scene.overrideMaterial = null;
    this.scene.background = previousBackground;
    this.ground.visible = true;
    this.horizontalBlur.uniforms.tDiffuse.value = this.shadowTarget.texture;
    this.horizontalBlur.uniforms.h.value = 2.2 / 512;
    this.blurQuad.material = this.horizontalBlur;
    this.renderer.setRenderTarget(this.blurTarget);
    this.renderer.render(this.blurScene, this.blurCamera);
    this.verticalBlur.uniforms.tDiffuse.value = this.blurTarget.texture;
    this.verticalBlur.uniforms.v.value = 2.2 / 512;
    this.blurQuad.material = this.verticalBlur;
    this.renderer.setRenderTarget(this.shadowTarget);
    this.renderer.render(this.blurScene, this.blurCamera);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousClear, previousAlpha);
    this.shadowDirty = false;
  }

  layoutTarget() {
    const c = CONSOLES[this.variant];
    const horizontal = this.orientation === 'horizontal';
    return {
      consolePosition: new THREE.Vector3(horizontal ? -0.40 : -0.45, horizontal ? c.width / 2 + (c.disc ? 0.26 : 0.13) : c.height / 2 + 0.09, 0),
      consoleRotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, horizontal ? -Math.PI / 2 : 0)),
      controllerPosition: new THREE.Vector3(horizontal ? 2.65 : 1.22, 0.69, horizontal ? 0.45 : 0.80),
    };
  }

  setLayout(animate = true) {
    const target = this.layoutTarget();
    this.console.userData.stand.visible = this.orientation === 'vertical';
    this.controller.rotation.set(-0.14, this.variant === 'pro' && this.orientation === 'vertical' ? -0.50 : 0.50, -0.025);
    if (animate && !this.reducedMotion) {
      this.objectTransition = { start: performance.now(), fromPosition: this.console.position.clone(), fromRotation: this.console.quaternion.clone(), fromController: this.controller.position.clone(), ...target };
    } else {
      this.console.position.copy(target.consolePosition);
      this.console.quaternion.copy(target.consoleRotation);
      this.controller.position.copy(target.controllerPosition);
      this.objectTransition = null;
    }
    this.shadowDirty = true;
  }

  setModel(variant) {
    if (!CONSOLES[variant] || variant === this.variant) return;
    this.scene.remove(this.console);
    disposeModel(this.console);
    this.variant = variant;
    this.console = buildConsole(variant);
    this.scene.add(this.console);
    this.setLayout(false);
    this.resetView();
  }

  setOrientation(orientation) {
    if (!['vertical', 'horizontal'].includes(orientation) || this.orientation === orientation) return;
    this.orientation = orientation;
    this.setLayout();
    this.resetView();
  }

  setController(visible) {
    this.controller.visible = visible;
    this.shadowDirty = true;
    this.resetView();
  }

  setTheme(theme) {
    this.theme = theme;
    const dark = theme === 'dark';
    this.ambient.intensity = dark ? 0.8 : 2.0;
    this.key.intensity = dark ? 3.8 : 4.2;
    this.fill.intensity = dark ? 1.6 : 2.0;
    this.rim.intensity = dark ? 5 : 3;
    this.rim.color.set(dark ? 0x9cb9ff : 0xffffff);
    this.scene.environmentIntensity = dark ? 0.34 : 0.65;
    this.ground.material.opacity = dark ? 0.9 : 0.7;
    this.renderer.toneMappingExposure = dark ? 0.95 : 1.22;
  }

  layoutBounds() {
    const target = this.layoutTarget();
    const position = this.console.position.clone();
    const rotation = this.console.quaternion.clone();
    const controllerPosition = this.controller.position.clone();
    this.console.position.copy(target.consolePosition);
    this.console.quaternion.copy(target.consoleRotation);
    this.controller.position.copy(target.controllerPosition);
    this.console.updateMatrixWorld(true);
    this.controller.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const root of [this.console, this.controller]) {
      root.traverseVisible(object => {
        if (object.isMesh) bounds.expandByObject(object);
      });
    }
    this.console.position.copy(position);
    this.console.quaternion.copy(rotation);
    this.controller.position.copy(controllerPosition);
    this.console.updateMatrixWorld(true);
    this.controller.updateMatrixWorld(true);
    return bounds;
  }

  resetView(animate = true) {
    const horizontal = this.orientation === 'horizontal';
    const aspect = Math.max(0.3, this.viewport.clientWidth / this.viewport.clientHeight);
    const bounds = this.layoutBounds();
    const target = bounds.getCenter(new THREE.Vector3());
    const direction = horizontal ? new THREE.Vector3(4.5, 4.2, 7.5).normalize() : new THREE.Vector3(this.variant === 'pro' ? -7.2 : 7.2, 2.7, 7.5).normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const halfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(target);
          distance = Math.max(distance, Math.abs(offset.dot(up)) / halfFov + offset.dot(direction), Math.abs(offset.dot(right)) / (halfFov * aspect) + offset.dot(direction));
        }
      }
    }
    const position = target.clone().addScaledVector(direction, distance * 1.16);
    if (animate && !this.reducedMotion) {
      this.transition = { start: performance.now(), fromPosition: this.camera.position.clone(), fromTarget: this.controls.target.clone(), position, target };
    } else {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.transition = null;
      this.controls.update();
    }
    this.canvas.setAttribute('aria-label', `${CONSOLES[this.variant].name} 3D model in ${this.orientation} position. Drag to orbit, scroll to zoom. Use arrow keys to rotate and plus or minus to zoom.`);
  }

  resize() {
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.lastWidth && (this.lastWidth !== width || this.lastHeight !== height)) this.resetView(false);
    this.lastWidth = width;
    this.lastHeight = height;
  }

  onKey(event) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    this.transition = null;
    if (event.key === '0') return this.resetView();
    if (event.key === 'ArrowLeft') spherical.theta -= 0.1;
    if (event.key === 'ArrowRight') spherical.theta += 0.1;
    if (event.key === 'ArrowUp') spherical.phi -= 0.08;
    if (event.key === 'ArrowDown') spherical.phi += 0.08;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, this.controls.minDistance, this.controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
  }

  async saveImage() {
    const oldBackground = this.scene.background;
    try {
      this.scene.background = new THREE.Color(this.theme === 'dark' ? '#171b22' : '#f6f6f3');
      this.renderer.render(this.scene, this.camera);
      const blob = await new Promise((resolve, reject) => this.canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image export failed')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${this.variant === 'original' ? 'ps5' : `ps5-${this.variant}`}-${this.orientation}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.scene.background = oldBackground;
    }
  }

  frame() {
    this.clock.update();
    const now = performance.now();
    const easing = t => 1 - Math.pow(1 - Math.min(t, 1), 3);
    if (this.transition) {
      const t = (now - this.transition.start) / 800;
      const a = easing(t);
      this.camera.position.lerpVectors(this.transition.fromPosition, this.transition.position, a);
      this.controls.target.lerpVectors(this.transition.fromTarget, this.transition.target, a);
      if (t >= 1) this.transition = null;
    }
    if (this.objectTransition) {
      const t = (now - this.objectTransition.start) / 800;
      const a = easing(t);
      const transition = this.objectTransition;
      this.console.position.lerpVectors(transition.fromPosition, transition.consolePosition, a);
      this.console.position.y += Math.sin(Math.PI * a) * 0.45;
      this.console.quaternion.slerpQuaternions(transition.fromRotation, transition.consoleRotation, a);
      this.controller.position.lerpVectors(transition.fromController, transition.controllerPosition, a);
      this.shadowDirty = true;
      if (t >= 1) this.objectTransition = null;
    }
    this.controls.update(Math.min(this.clock.getDelta(), 0.05));
    if (this.shadowDirty) this.updateGround();
    this.renderer.render(this.scene, this.camera);
  }
}
