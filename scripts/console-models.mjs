import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const CONSOLES = {
  pro: { name: 'PS5 Pro', edition: 'Digital edition', year: '2024', height: 3.88, depth: 2.16, width: 0.70, disc: false, description: 'Sculpted white panels. Three signature ribs. Every angle, considered.', detail: 'Three cooling ribs', number: '03' },
  slim: { name: 'PS5 Slim', edition: 'Disc edition', year: '2023', height: 3.58, depth: 2.16, width: 0.68, disc: true, description: 'A smaller silhouette, split side panels, and an integrated disc drive.', detail: 'Split side panels', number: '02' },
  original: { name: 'PS5', edition: 'Original · Disc edition', year: '2020', height: 3.90, depth: 2.60, width: 0.77, disc: true, description: 'The original sweeping silhouette. Continuous plates and a glossy black core.', detail: 'Continuous side plates', number: '01' },
};

const materials = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xe6e7e8, roughness: 0.40, metalness: 0.02, clearcoat: 0.2, clearcoatRoughness: 0.45 }),
  upper: new THREE.MeshPhysicalMaterial({ color: 0xe6e7e8, roughness: 0.27, metalness: 0.02, clearcoat: 0.35 }),
  core: new THREE.MeshPhysicalMaterial({ color: 0x101318, roughness: 0.27, metalness: 0.17, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.58, metalness: 0.12 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.90 }),
  edge: new THREE.MeshStandardMaterial({ color: 0x2b3037, roughness: 0.4, metalness: 0.45 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x777b83, roughness: 0.3, metalness: 0.85 }),
  button: new THREE.MeshPhysicalMaterial({ color: 0xc6c9cd, roughness: 0.35, transmission: 0.08, thickness: 0.03, clearcoat: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x174dff, emissive: 0x123fff, emissiveIntensity: 2.2, roughness: 0.25 }),
};

function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, position, material = materials.dark, radius = 0.015) {
  return mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(v => v / 2))), material, parent, position);
}

function cylinder(parent, radius, depth, position, material, radial = 48) {
  const object = mesh(new THREE.CylinderGeometry(radius, radius, depth, radial), material, parent, position);
  object.rotation.x = Math.PI / 2;
  return object;
}

function tube(parent, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(curve, Math.max(20, points.length * 8), radius, 6, closed), material, parent);
}

function shapeMesh(parent, draw, depth, material, bevel = 0.015) {
  const shape = new THREE.Shape();
  draw(shape);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 28, steps: 1 });
  return mesh(geometry, material, parent);
}

const smoothstep = (a, b, value) => THREE.MathUtils.smoothstep(value, a, b);

function shellPoint(config, side, t, u, inset = 0) {
  const { height: h, depth: d, width: w, disc } = config;
  const y = (t - 0.5) * h;
  const front = d / 2 - 0.12 * Math.sin(Math.PI * t) + 0.025 * t;
  const back = -d / 2 + 0.035 * Math.sin(Math.PI * t);
  const z = THREE.MathUtils.lerp(back, front, u);
  const flare = 0.095 * Math.pow(t, 5) + 0.025 * Math.pow(1 - t, 6) - 0.035 * Math.sin(Math.PI * t);
  const bow = 0.042 * Math.sin(Math.PI * u);
  const drive = disc && side === 1 ? 0.18 * (1 - smoothstep(0.37, 0.64, t)) * smoothstep(0.15, 0.8, u) : 0;
  const wrap = (config === CONSOLES.pro ? 0.19 : 0.23) * (1 - t) * smoothstep(0.76, 1, u);
  return [side * (w / 2 + flare + bow + drive - wrap - inset), y + 0.025 * Math.sin(Math.PI * u) * (1 - t), z];
}

// Each panel is a closed, gently bowed solid, so grazing angles show a real edge.
function shellGeometry(config, side, lower, upper, inset = 0, thickness = 0.026) {
  const rows = 50;
  const columns = 42;
  const positions = [];
  const indices = [];
  const lowerAt = typeof lower === 'function' ? lower : () => lower;
  const upperAt = typeof upper === 'function' ? upper : () => upper;
  const layerSize = (rows + 1) * (columns + 1);
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) {
        const u = col / columns;
        const t = THREE.MathUtils.lerp(lowerAt(u), upperAt(u), row / rows);
        const point = shellPoint(config, side, t, u, inset + layer * thickness);
        positions.push(...point);
      }
    }
  }
  const quad = (a, b, c, d, reverse = false) => {
    if (reverse) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let layer = 0; layer < 2; layer++) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = layer * layerSize + row * (columns + 1) + col;
        quad(a, a + columns + 1, a + columns + 2, a + 1, (side === 1) !== (layer === 0));
      }
    }
  }
  for (let col = 0; col < columns; col++) {
    quad(col, col + 1, layerSize + col + 1, layerSize + col, side === 1);
    const a = rows * (columns + 1) + col;
    quad(a, a + layerSize, a + layerSize + 1, a + 1, side === 1);
  }
  for (let row = 0; row < rows; row++) {
    const a = row * (columns + 1);
    quad(a, a + layerSize, a + layerSize + columns + 1, a + columns + 1, side === 1);
    const b = a + columns;
    quad(b, b + columns + 1, b + layerSize + columns + 1, b + layerSize, side === 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080b10';
  ctx.beginPath();
  ctx.moveTo(105, 34); ctx.lineTo(105, 175); ctx.lineTo(127, 183); ctx.lineTo(127, 74);
  ctx.bezierCurveTo(154, 81, 158, 91, 150, 107); ctx.lineTo(150, 141);
  ctx.bezierCurveTo(192, 151, 201, 103, 172, 77); ctx.bezierCurveTo(157, 63, 128, 52, 105, 45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(96, 144); ctx.lineTo(96, 168); ctx.lineTo(63, 180);
  ctx.bezierCurveTo(45, 188, 55, 195, 74, 190); ctx.lineTo(96, 182); ctx.lineTo(96, 202);
  ctx.bezierCurveTo(59, 216, 20, 207, 28, 188); ctx.bezierCurveTo(32, 176, 69, 155, 96, 144); ctx.fill();
  ctx.beginPath(); ctx.moveTo(138, 166); ctx.lineTo(172, 154);
  ctx.bezierCurveTo(211, 143, 244, 160, 224, 178); ctx.bezierCurveTo(207, 191, 167, 207, 138, 217);
  ctx.lineTo(138, 195); ctx.lineTo(195, 175); ctx.bezierCurveTo(208, 169, 192, 165, 181, 170);
  ctx.lineTo(138, 186); ctx.closePath(); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let logoTexture;
let logoMaterial;
function emblem(parent, size, position, rotation = [0, 0, 0]) {
  logoTexture ??= makeLogoTexture();
  logoMaterial ??= new THREE.MeshStandardMaterial({ map: logoTexture, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  const object = mesh(new THREE.PlaneGeometry(size, size), logoMaterial, parent, position);
  object.name = 'playstation-mark';
  object.rotation.set(...rotation);
  object.castShadow = false;
  return object;
}

function frontDetails(group, config, variant) {
  const frontAt = y => config.depth / 2 - 0.12 * Math.sin(Math.PI * (y / config.height + 0.5)) + 0.006;
  const port = (y, type) => {
    const z = frontAt(y);
    const w = type === 'a' ? 0.125 : 0.085;
    const h = type === 'a' ? 0.046 : 0.029;
    box(group, [w + 0.012, h + 0.012, 0.014], [0, y, z], materials.metal, 0.01);
    box(group, [w, h, 0.017], [0, y, z + 0.006], materials.dark, 0.009);
    box(group, [w * 0.68, 0.008, 0.019], [0, y - (type === 'a' ? 0.007 : 0), z + 0.009], materials.edge, 0.002);
  };
  port(-0.68, variant === 'original' ? 'a' : 'c');
  port(-0.94, 'c');
  const power = cylinder(group, 0.022, 0.009, [0, -config.height / 2 + 0.23, frontAt(-config.height / 2 + 0.23) + 0.009], materials.edge);
  power.name = 'Power button';
  const powerRing = mesh(new THREE.TorusGeometry(0.011, 0.0016, 4, 20, Math.PI * 1.6), materials.metal, group, [0, power.position.y, power.position.z + 0.007]);
  powerRing.rotation.z = Math.PI * 0.7;
  box(group, [0.002, 0.012, 0.004], [0, power.position.y + 0.008, power.position.z + 0.008], materials.metal, 0.001);

  for (const side of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= 70; i++) {
      const t = 0.055 + 0.90 * i / 70;
      const p = shellPoint(config, side, t, 0.97, 0.045);
      points.push(p);
    }
    tube(group, points, 0.009, materials.blue).name = 'console-light';
    for (let i = 0; i < 52; i++) {
      const t = 0.065 + 0.86 * i / 52;
      const p = shellPoint(config, side, t, 0.945, 0.035);
      box(group, [0.075, 0.018, 0.13], [p[0] - side * 0.035, p[1], p[2] - 0.025], materials.dark, 0.002);
    }
  }

  if (config.disc) {
    // The drive belongs to the lower right shell, with a visible recessed mouth.
    const y = -config.height * 0.27;
    const drivePoint = t => {
      const p = shellPoint(config, 1, t, 1, 0.007);
      p[0] += 0.23 * (1 - t);
      return p;
    };
    const x = drivePoint(y / config.height + 0.5)[0] - 0.05;
    const z = frontAt(y) + 0.035;
    const rows=64, cols=8, positions=[], indices=[], layerSize=(rows+1)*(cols+1);
    for(let layer=0;layer<2;layer++)for(let row=0;row<=rows;row++){
      const t=.008+row/rows*.61,p=drivePoint(t),coreEdge=(config.width-.07)/2*(.4+.6*t);
      const inner=THREE.MathUtils.lerp(coreEdge,p[0],smoothstep(.32,.618,t));
      for(let col=0;col<=cols;col++)positions.push(THREE.MathUtils.lerp(inner,p[0],col/cols),p[1],frontAt(p[1])-.12*layer);
    }
    const quad=(a,b,c,d,reverse=false)=>indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));
    for(let layer=0;layer<2;layer++)for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const a=layer*layerSize+row*(cols+1)+col;quad(a,a+1,a+cols+2,a+cols+1,layer===1);
    }
    for(let row=0;row<rows;row++)for(const col of [0,cols]){const a=row*(cols+1)+col;quad(a,a+cols+1,a+cols+1+layerSize,a+layerSize,col===cols);}
    for(let col=0;col<cols;col++)for(const row of [0,rows]){const a=row*(cols+1)+col;quad(a,a+layerSize,a+layerSize+1,a+1,row===rows);}
    const housing=new THREE.BufferGeometry();housing.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));housing.setIndex(indices);housing.computeVertexNormals();
    mesh(housing,materials.white,group);
    const slot = box(group, [0.047, config.height * 0.36, 0.02], [x, y, z], materials.dark, 0.018);
    const slotPoints = slot.geometry.attributes.position;
    for (let i = 0; i < slotPoints.count; i++) slotPoints.setZ(i, slotPoints.getZ(i) + frontAt(slotPoints.getY(i) + y) - frontAt(y));
    slot.geometry.computeVertexNormals();
    box(group, [0.051, 0.085, 0.025], [x, y - config.height * 0.18 + 0.02, z + 0.003], materials.white, 0.012);
    box(group, [0.018, 0.003, 0.028], [x, y - config.height * 0.18 + 0.016, z + 0.008], materials.metal, 0.001);
  }
}

function rearDetails(group, config) {
  const z = -config.depth / 2 + 0.055;
  for (let i = 0; i < 53; i++) {
    const y = -config.height / 2 + 0.2 + i * (config.height - 0.45) / 53;
    box(group, [config.width * 0.76, 0.026, 0.04], [0, y, z], materials.edge, 0.003);
  }
  box(group, [config.width * 0.77, 1.12, 0.055], [0, -0.81, z - 0.015], materials.dark, 0.04);
  const rearPort = (x, y, w, h, mat = materials.metal) => {
    box(group, [w + 0.015, h + 0.015, 0.02], [x, y, z - 0.05], mat, 0.004);
    box(group, [w, h, 0.022], [x, y, z - 0.062], materials.dark, 0.003);
  };
  rearPort(-0.13, -0.47, 0.10, 0.045);
  rearPort(0.06, -0.47, 0.10, 0.045);
  rearPort(-0.1, -0.72, 0.14, 0.10);
  rearPort(0.1, -0.94, 0.15, 0.06);
  rearPort(0, -1.22, 0.19, 0.065, materials.edge);
  const topY = config.height / 2 - 0.145;
  for (let i = 0; i < 30; i++) {
    box(group, [config.width * 0.9, 0.045, 0.025], [0, topY, -config.depth / 2 + 0.15 + i * (config.depth - 0.3) / 30], materials.edge, 0.003);
  }
}

export function buildConsole(variant = 'pro') {
  const config = CONSOLES[variant];
  if (!config) throw new Error(`Unknown console: ${variant}`);
  const group = new THREE.Group();
  group.name = config.name;
  const plates = new THREE.Group();
  plates.name = 'White side plates';
  group.add(plates);
  const coreGeometry = new THREE.BoxGeometry(config.width - 0.07, config.height - 0.18, config.depth - 0.09, 6, 72, 28);
  const attr = coreGeometry.attributes.position;
  const radius = 0.085;
  const inner = new THREE.Vector3((config.width - 0.07) / 2 - radius, (config.height - 0.18) / 2 - radius, (config.depth - 0.09) / 2 - radius);
  for (let i = 0; i < attr.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(attr, i);
    const nearest = point.clone().clamp(inner.clone().negate(), inner);
    point.sub(nearest).normalize().multiplyScalar(radius).add(nearest);
    const y = point.y;
    const t = y / config.height + 0.5;
    const z = point.z;
    if (z > 0) point.z -= 0.12 * Math.sin(Math.PI * t);
    const frontTaper = 1 - (variant === 'pro' ? 0.5 : 0.6) * (1 - t) * smoothstep(0.55, 0.95, z / (config.depth / 2));
    point.x *= (1 - 0.055 * Math.sin(Math.PI * t)) * frontTaper;
    const back = -config.depth / 2 + 0.035 * Math.sin(Math.PI * t);
    const front = config.depth / 2 - 0.12 * Math.sin(Math.PI * t) + 0.025 * t;
    const u = THREE.MathUtils.clamp((point.z - back) / (front - back), 0, 1);
    const side = Math.sign(point.x) || 1;
    const clearance = Math.abs(shellPoint(config, side, t, u, 0.04)[0]);
    point.x = side * Math.min(Math.abs(point.x), clearance);
    attr.setXYZ(i, point.x, point.y, point.z);
  }
  coreGeometry.deleteAttribute('normal');
  coreGeometry.deleteAttribute('uv');
  const roundedCore = mergeVertices(coreGeometry);
  roundedCore.computeVertexNormals();
  coreGeometry.dispose();
  mesh(roundedCore, materials.core, group);

  for (const side of [-1, 1]) {
    if (variant === 'original') {
      mesh(shellGeometry(config, side, 0, 1), materials.white, plates);
    } else {
      const seam = u => 0.585 + 0.007 * (u - 0.5);
      const gap = variant === 'pro' ? 0.059 : 0.011;
      mesh(shellGeometry(config, side, 0, u => seam(u) - gap / 2), materials.white, plates);
      mesh(shellGeometry(config, side, u => seam(u) + gap / 2, 1), variant === 'slim' ? materials.upper : materials.white, plates);
      if (variant === 'pro') {
        for (let rib = 0; rib < 3; rib++) {
          const center = u => seam(u) + (rib - 1) * 0.019;
          mesh(shellGeometry(config, side, u => center(u) - 0.004, u => center(u) + 0.004, 0.009, 0.025), materials.edge, group);
        }
      }
    }
  }

  frontDetails(group, config, variant);
  rearDetails(group, config);
  const logoPoint = shellPoint(config, -1, 0.925, 0.13, -0.003);
  emblem(plates, 0.18, logoPoint, [0, -Math.PI / 2, 0]);

  const stand = new THREE.Group();
  stand.name = 'Vertical stand';
  const base = mesh(new THREE.CylinderGeometry(0.70, 0.73, 0.045, 96), variant === 'original' ? materials.dark : materials.metal, stand, [0, -config.height / 2 - 0.055, 0]);
  base.scale.z = 0.76;
  const baseInner = mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.055, 96), materials.dark, stand, [0, -config.height / 2 - 0.035, 0]);
  baseInner.scale.z = 0.76;
  group.add(stand);
  group.userData = { config, stand, plates };
  return group;
}

function drawControllerOutline(s) {
  s.moveTo(-0.49, 0.38);
  s.bezierCurveTo(-0.34, 0.43, 0.34, 0.43, 0.49, 0.38);
  s.bezierCurveTo(0.64, 0.38, 0.70, 0.27, 0.75, 0.07);
  s.bezierCurveTo(0.81, -0.14, 0.84, -0.39, 0.76, -0.53);
  s.bezierCurveTo(0.72, -0.59, 0.65, -0.57, 0.60, -0.47);
  s.lineTo(0.38, -0.16);
  s.bezierCurveTo(0.30, -0.10, -0.30, -0.10, -0.38, -0.16);
  s.lineTo(-0.60, -0.47);
  s.bezierCurveTo(-0.65, -0.57, -0.72, -0.59, -0.76, -0.53);
  s.bezierCurveTo(-0.84, -0.39, -0.81, -0.14, -0.75, 0.07);
  s.bezierCurveTo(-0.70, 0.27, -0.64, 0.38, -0.49, 0.38);
}

function symbol(parent, kind, x, y, z) {
  const r = 0.036;
  const color = materials.metal;
  const points = kind === 'triangle' ? [[x, y + r, z], [x - r * 0.87, y - r * 0.65, z], [x + r * 0.87, y - r * 0.65, z]] : kind === 'square' ? [[x - r * 0.72, y - r * 0.72, z], [x + r * 0.72, y - r * 0.72, z], [x + r * 0.72, y + r * 0.72, z], [x - r * 0.72, y + r * 0.72, z]] : [];
  if (points.length) {
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0x686f78 }));
    parent.add(line);
  } else if (kind === 'circle') {
    mesh(new THREE.TorusGeometry(r * 0.82, 0.003, 5, 36), color, parent, [x, y, z]);
  } else {
    for (const direction of [-1, 1]) {
      const bar = box(parent, [r * 1.6, 0.005, 0.004], [x, y, z], color, 0.002);
      bar.rotation.z = direction * Math.PI / 4;
    }
  }
}

export function buildController() {
  const group = new THREE.Group();
  group.name = 'DualSense wireless controller';
  shapeMesh(group, drawControllerOutline, 0.18, materials.white, 0.065);
  // The dark central face flows down both inside edges of the white grips.
  const face = shapeMesh(group, s => {
    s.moveTo(-0.32, 0.32); s.lineTo(0.32, 0.32);
    s.bezierCurveTo(0.34, 0.20, 0.40, 0.07, 0.49, -0.07);
    s.lineTo(0.65, -0.52); s.bezierCurveTo(0.64, -0.55, 0.62, -0.51, 0.60, -0.47);
    s.lineTo(0.38, -0.15); s.bezierCurveTo(0.28, -0.09, -0.28, -0.09, -0.38, -0.15);
    s.lineTo(-0.60, -0.47); s.bezierCurveTo(-0.62, -0.51, -0.64, -0.55, -0.65, -0.52);
    s.lineTo(-0.49, -0.07); s.bezierCurveTo(-0.40, 0.07, -0.34, 0.20, -0.32, 0.32);
  }, 0.026, materials.dark, 0.018);
  face.position.z = 0.234;

  const padOutline = s => {
    s.moveTo(-0.315, 0.385); s.bezierCurveTo(-0.18, 0.405, 0.18, 0.405, 0.315, 0.385);
    s.lineTo(0.282, 0.132); s.quadraticCurveTo(0.275, 0.079, 0.217, 0.077);
    s.lineTo(-0.217, 0.077); s.quadraticCurveTo(-0.275, 0.079, -0.282, 0.132); s.closePath();
  };
  const pad = shapeMesh(group, padOutline, 0.032, materials.white, 0.014);
  pad.position.z = 0.267;
  for (const side of [-1, 1]) {
    tube(group, [[side * 0.323, 0.371, 0.277], [side * 0.308, 0.26, 0.277], [side * 0.291, 0.13, 0.277], [side * 0.26, 0.085, 0.277]], 0.0038, materials.blue);
    const x = side * 0.265;
    const y = -0.066;
    cylinder(group, 0.147, 0.028, [x, y, 0.278], materials.edge);
    cylinder(group, 0.128, 0.045, [x, y, 0.308], materials.dark);
    cylinder(group, 0.108, 0.043, [x, y, 0.35], materials.rubber);
    cylinder(group, 0.084, 0.008, [x, y, 0.376], materials.rubber);
    mesh(new THREE.TorusGeometry(0.101, 0.003, 6, 52), materials.edge, group, [x, y, 0.375]);
    box(group, [0.054, 0.080, 0.02], [side * 0.377, 0.305, 0.27], materials.button, 0.026);
    box(group, [0.22, 0.10, 0.15], [side * 0.49, 0.40, 0.095], materials.dark, 0.035);
    const trigger = box(group, [0.23, 0.14, 0.11], [side * 0.49, 0.345, -0.075], materials.dark, 0.04);
    trigger.rotation.x = -0.3;
  }

  const dpadX = -0.525;
  const dpadY = 0.20;
  for (let i = 0; i < 4; i++) {
    const button = shapeMesh(group, s => {
      s.moveTo(-0.041, 0.047); s.lineTo(0.041, 0.047); s.lineTo(0.045, -0.002);
      s.lineTo(0, -0.04); s.lineTo(-0.045, -0.002); s.closePath();
    }, 0.023, materials.button, 0.01);
    const angle = i * Math.PI / 2;
    button.position.set(dpadX - Math.sin(angle) * 0.072, dpadY + Math.cos(angle) * 0.072, 0.248);
    button.rotation.z = angle;
    const tx = dpadX - Math.sin(angle) * 0.088;
    const ty = dpadY + Math.cos(angle) * 0.088;
    const arrow = shapeMesh(group, s => { s.moveTo(0, 0.012); s.lineTo(-0.010, -0.006); s.lineTo(0.010, -0.006); s.closePath(); }, 0.001, materials.metal, 0);
    arrow.position.set(tx, ty, 0.283);
    arrow.rotation.z = angle;
  }

  const buttonPositions = [['triangle', 0.525, 0.29], ['circle', 0.617, 0.20], ['cross', 0.525, 0.108], ['square', 0.433, 0.20]];
  for (const [kind, x, y] of buttonPositions) {
    cylinder(group, 0.060, 0.012, [x, y, 0.247], materials.edge);
    cylinder(group, 0.053, 0.025, [x, y, 0.266], materials.button);
    symbol(group, kind, x, y, 0.281);
  }

  for (let row = 0; row < 3; row++) {
    const count = 5 - row;
    for (let col = 0; col < count; col++) cylinder(group, 0.0058, 0.003, [(col - (count - 1) / 2) * 0.026, 0.036 - row * 0.020, 0.282], materials.rubber, 10);
  }
  emblem(group, 0.092, [0, -0.072, 0.294]);
  box(group, [0.067, 0.018, 0.015], [0, -0.161, 0.282], materials.edge, 0.008);
  box(group, [0.020, 0.004, 0.016], [0, -0.193, 0.281], materials.metal, 0.001);
  box(group, [0.065, 0.024, 0.012], [0, 0.43, 0.1], materials.dark, 0.01);
  return group;
}

export function disposeModel(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    // Materials are shared by all variants and must survive a model switch.
  });
}
