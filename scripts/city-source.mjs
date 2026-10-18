import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const material = (name, color, roughness = 0.8, metalness = 0.05) => {
  const m = new T.MeshStandardMaterial({ color, roughness, metalness });
  m.name = name;
  return m;
};
const concrete = [0x8a887a, 0x656b69, 0x999383, 0x596368, 0x77766b].map(
  (c, i) => material(`concrete-${i}`, c),
);
const steel = material("painted-steel", 0x354347, 0.67, 0.55);
const dark = material("dark-metal", 0x182326, 0.6, 0.55);
const glass = material("city-glass", 0x2b4c53, 0.22, 0.72);
const window = material("window-light", 0x929b91, 0.47, 0.35);
const yellow = material("road-yellow", 0xc5a642, 0.8);
const white = material("road-white", 0xbeb9a2, 0.86);
const red = material("tail-light", 0xee3531, 0.2);
const rubber = material("rubber", 0x101719, 0.95);
const chrome = material("alloy", 0x74817f, 0.24, 0.88);
const teal = material("car-paint", 0x086974, 0.26, 0.62);
const carGlass = material("car-glass", 0x132526, 0.1, 0.85);
const leaf = material("palm-leaf", 0x526341, 0.95);
leaf.side = T.DoubleSide;
const skin = material("skin", 0x8a6850, 0.93);
const clothing = [0x344047, 0x53534b, 0x675b48, 0x293d3c, 0x666873].map(
  (c, i) => material(`clothing-${i}`, c),
);
let seed = 8301;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function group(parent, name) {
  const g = new T.Group();
  g.name = name;
  parent.add(g);
  return g;
}
function mesh(parent, name, geo, mat, at = [0, 0, 0]) {
  const m = new T.Mesh(geo, mat);
  m.name = name;
  m.position.set(...at);
  parent.add(m);
  return m;
}
function box(parent, name, size, at, mat, round = 0) {
  return mesh(
    parent,
    name,
    round
      ? new RoundedBoxGeometry(...size, 2, round)
      : new T.BoxGeometry(...size),
    mat,
    at,
  );
}
function cylinder(parent, name, r1, r2, h, at, mat, segments = 12) {
  return mesh(
    parent,
    name,
    new T.CylinderGeometry(r1, r2, h, segments),
    mat,
    at,
  );
}
function rod(parent, a, b, r, mat, name = "pipe") {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    d = end.clone().sub(start);
  const m = cylinder(
    parent,
    name,
    r,
    r,
    d.length(),
    start.clone().add(end).multiplyScalar(0.5).toArray(),
    mat,
    8,
  );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}
function patch(parent, name, vertices, mat) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices.flat(), 3));
  g.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return mesh(parent, name, g, mat);
}
// Bake static detail into material batches. Named moving parts and sign faces stay separate.
function bake(g) {
  g.updateMatrixWorld(true);
  const inverse = g.matrixWorld.clone().invert(),
    batches = new Map(),
    retained = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.startsWith("sign-")) {
      const copy = o.clone();
      const transform = inverse.clone().multiply(o.matrixWorld);
      transform.decompose(copy.position, copy.quaternion, copy.scale);
      retained.push(copy);
      return;
    }
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(geo);
  });
  g.clear();
  for (const [mat, geos] of batches) {
    mesh(g, `${g.name}-${mat.name}`, mergeGeometries(geos), mat);
    for (const geo of geos) geo.dispose();
  }
  if (retained.length) g.add(...retained);
  return g;
}
function sign(parent, id, w, h, x, y, z, rotation = 0) {
  box(parent, "billboard-frame", [w + 0.2, h + 0.2, 0.18], [x, y, z], dark);
  const p = mesh(parent, `sign-${id}`, new T.PlaneGeometry(w, h), white, [
    x,
    y,
    z + 0.11,
  ]);
  p.rotation.y = rotation;
  return p;
}
function palm(parent, x, z, height = 8) {
  const trunk = material("palm-trunk", 0x6b6350);
  rod(parent, [x, 0, z], [x + 0.4, height, z], 0.14, trunk);
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI * 2) / 14,
      length = 2.0 + random() * 1.3;
    const positions = [],
      indices = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10,
        a = angle + Math.sin(t * 3) * 0.15;
      const mid = new T.Vector3(
        x + 0.4 + Math.cos(a) * t * length,
        height + Math.sin(t * Math.PI) * 0.8 - t * 0.7,
        z + Math.sin(a) * t * length,
      );
      const half = 0.22 * Math.sin(t * Math.PI) + 0.008;
      positions.push(
        mid.x + Math.sin(a) * half,
        mid.y,
        mid.z - Math.cos(a) * half,
        mid.x - Math.sin(a) * half,
        mid.y,
        mid.z + Math.cos(a) * half,
      );
      if (j < 10) {
        const k = j * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        Array(22)
          .fill(0)
          .flatMap((_, j) => [j % 2, Math.floor(j / 2) / 10]),
        2,
      ),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    mesh(parent, "palm-frond", geo, leaf);
  }
}
function person(parent, x, z, id) {
  const g = group(parent, `pedestrian-${id}`),
    cloth = clothing[id % clothing.length];
  g.position.set(x, 0.27, z);
  g.rotation.y = id * 1.91;
  mesh(g, "head", new T.SphereGeometry(0.115, 10, 8), skin, [0, 1.55, 0]);
  cylinder(g, "neck", 0.06, 0.065, 0.12, [0, 1.39, 0], skin);
  box(g, "jacket", [0.43, 0.59, 0.26], [0, 1.08, 0], cloth, 0.09);
  box(g, "hips", [0.31, 0.2, 0.24], [0, 0.71, 0], dark, 0.04);
  for (const s of [-1, 1]) {
    rod(
      g,
      [s * 0.1, 0.72, 0],
      [s * 0.13, 0.39, s * 0.08],
      0.065,
      dark,
      "thigh",
    );
    rod(
      g,
      [s * 0.13, 0.39, s * 0.08],
      [s * 0.13, 0.08, -s * 0.11],
      0.055,
      dark,
      "shin",
    );
    box(
      g,
      "boot",
      [0.14, 0.12, 0.29],
      [s * 0.13, 0.055, -s * 0.11 - 0.05],
      rubber,
      0.025,
    );
    rod(
      g,
      [s * 0.24, 1.3, 0],
      [s * 0.31, 1.02, s * 0.04],
      0.06,
      cloth,
      "upper-arm",
    );
    rod(
      g,
      [s * 0.31, 1.02, s * 0.04],
      [s * 0.34, 0.79, s * 0.1],
      0.045,
      skin,
      "forearm",
    );
    mesh(g, "hand", new T.SphereGeometry(0.055, 8, 6), skin, [
      s * 0.34,
      0.76,
      s * 0.1,
    ]);
  }
  cylinder(g, "hair", 0.117, 0.11, 0.09, [0, 1.64, 0], dark);
}
function building(parent, x, z, w, d, h, index) {
  const g = group(parent, `city-block-${index}`),
    mat = concrete[index % concrete.length];
  box(g, "tower", [w, h, d], [x, h / 2, z], mat);
  const inner = x < 0 ? x + w / 2 + 0.06 : x - w / 2 - 0.06;
  const front = z + d / 2 + 0.04;
  // Recessed windows, horizontal slabs, exterior service ducts and staggered balconies.
  for (let y = 4; y < h - 1; y += 2.5) {
    box(g, "floor-slab", [w + 0.22, 0.13, d + 0.2], [x, y - 0.7, z], steel);
    for (let a = -w / 2 + 0.8; a < w / 2; a += 1.35) {
      box(
        g,
        "front-window",
        [0.75, 1.45, 0.08],
        [x + a, y, front],
        random() > 0.84 ? window : glass,
      );
      if (random() > 0.7)
        box(
          g,
          "ac-unit",
          [0.65, 0.38, 0.35],
          [x + a, y - 0.8, front + 0.15],
          steel,
        );
    }
    for (let a = -d / 2 + 0.8; a < d / 2; a += 1.55)
      box(
        g,
        "side-window",
        [0.075, 1.48, 0.88],
        [inner, y, z + a],
        random() > 0.85 ? window : glass,
      );
    if (y < 25 && Math.floor(y) % 3 === 1) {
      box(g, "balcony", [w * 0.6, 0.16, 1.2], [x, y - 0.8, front + 0.5], mat);
      rod(
        g,
        [x - w * 0.3, y - 0.1, front + 1],
        [x + w * 0.3, y - 0.1, front + 1],
        0.035,
        steel,
      );
      for (let a = -w * 0.3; a < w * 0.3; a += 0.55)
        rod(
          g,
          [x + a, y - 0.8, front + 1],
          [x + a, y - 0.1, front + 1],
          0.022,
          steel,
        );
    }
  }
  for (let a = -w / 2; a <= w / 2; a += w / 4)
    box(g, "pilaster", [0.3, h + 0.2, 0.5], [x + a, h / 2, front + 0.2], steel);
  for (let a = 0; a < 3; a++) {
    const px = x - w * 0.35 + a * w * 0.35;
    cylinder(g, "roof-vent", 0.38, 0.38, 1.3, [px, h + 0.55, z], steel);
    box(
      g,
      "roof-machinery",
      [1.8, 1.3, 1.5],
      [px, h + 0.65, z + 2],
      concrete[1],
    );
    rod(g, [px, h + 0.8, z], [px, h + 4 + random() * 4, z], 0.035, dark);
  }
  const inward = x < 0 ? x + w / 2 + 0.25 : x - w / 2 - 0.25;
  for (let a = 0; a < 2; a++)
    rod(g, [inward, 2, z + a * 1.2], [inward, h - 2, z + a * 1.2], 0.11, steel);
  if (index % 2 === 0) {
    sign(g, index, Math.min(w * 0.72, 7), 3.3, x, 5.4, front + 0.4);
    if (h > 36)
      sign(g, index + 20, 2.5, 10, x + w * 0.25, h * 0.67, front + 0.4);
  }
  bake(g);
}
function sportsCar(parent) {
  const car = group(parent, "player-car");
  // Cross sections make the low, curved body continuous around all four sides.
  const stations = [
    [-2.36, 0.78, 0.63, 0.35],
    [-2.13, 1.04, 0.78, 0.34],
    [-1.6, 1.11, 0.85, 0.35],
    [-0.7, 1.07, 0.87, 0.34],
    [0.45, 1.08, 0.92, 0.35],
    [1.35, 1.13, 0.96, 0.35],
    [2.12, 1.09, 0.84, 0.35],
    [2.32, 0.91, 0.72, 0.38],
  ];
  const vertices = [],
    indices = [],
    uv = [];
  for (let j = 0; j < stations.length; j++) {
    const [z, w, top, bottom] = stations[j];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      vertices.push(
        Math.sign(c) * Math.pow(Math.abs(c), 0.48) * w,
        (top + bottom) / 2 +
          (Math.sign(s) * Math.pow(Math.abs(s), 0.6) * (top - bottom)) / 2,
        z,
      );
      uv.push(i / 24, j / (stations.length - 1));
      if (j < stations.length - 1) {
        const k = j * 24 + i,
          n = j * 24 + ((i + 1) % 24);
        indices.push(k, n, k + 24, n, n + 24, k + 24);
      }
    }
  }
  const body = new T.BufferGeometry();
  body.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  body.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  body.setIndex(indices);
  body.computeVertexNormals();
  mesh(car, "sculpted-body", body, teal);
  box(car, "underbody", [1.97, 0.24, 4.48], [0, 0.32, 0], dark, 0.13);
  // Sloped glass cabin and narrow painted roof, set ahead of the rear engine vents.
  patch(
    car,
    "windscreen",
    [
      [-0.84, 0.85, -0.92],
      [0.84, 0.85, -0.92],
      [0.65, 1.37, -0.23],
      [-0.65, 1.37, -0.23],
    ],
    carGlass,
  );
  patch(
    car,
    "roof",
    [
      [-0.65, 1.37, -0.23],
      [0.65, 1.37, -0.23],
      [0.62, 1.38, 0.48],
      [-0.62, 1.38, 0.48],
    ],
    teal,
  );
  patch(
    car,
    "rear-glass",
    [
      [0.62, 1.38, 0.48],
      [0.85, 0.94, 1.08],
      [-0.85, 0.94, 1.08],
      [-0.62, 1.38, 0.48],
    ],
    carGlass,
  );
  for (const side of [-1, 1]) {
    const pane = patch(
      car,
      "side-glass",
      [
        [side * 0.91, 0.87, -0.77],
        [side * 0.68, 1.33, -0.2],
        [side * 0.65, 1.34, 0.48],
        [side * 0.94, 0.9, 1.02],
      ],
      carGlass,
    );
    pane.material.side = T.DoubleSide;
    rod(
      car,
      [side * 0.94, 0.86, -0.89],
      [side * 0.68, 1.37, -0.23],
      0.035,
      teal,
    );
    rod(car, [side * 0.65, 1.38, 0.48], [side * 0.95, 0.9, 1.1], 0.045, teal);
    box(car, "sill", [0.08, 0.14, 3.65], [side * 1.075, 0.43, 0], teal, 0.03);
    box(
      car,
      "intake",
      [0.035, 0.21, 0.68],
      [side * 1.09, 0.64, 0.75],
      dark,
      0.035,
    );
    box(
      car,
      "door-handle",
      [0.035, 0.025, 0.22],
      [side * 1.085, 0.86, 0.1],
      chrome,
      0.008,
    );
    box(
      car,
      "mirror",
      [0.22, 0.1, 0.29],
      [side * 1.16, 1.02, -0.62],
      teal,
      0.05,
    );
    for (const z of [-1.52, 1.47]) {
      const wheel = group(car, `wheel-${side}-${z}`);
      wheel.position.set(side * 1.03, 0.44, z);
      const tyre = cylinder(
        wheel,
        "tyre",
        0.45,
        0.45,
        0.25,
        [0, 0, 0],
        rubber,
        40,
      );
      tyre.rotation.z = Math.PI / 2;
      const rim = cylinder(
        wheel,
        "rim",
        0.33,
        0.33,
        0.265,
        [0, 0, 0],
        chrome,
        32,
      );
      rim.rotation.z = Math.PI / 2;
      const inset = cylinder(
        wheel,
        "rim-inset",
        0.27,
        0.27,
        0.275,
        [0, 0, 0],
        dark,
        32,
      );
      inset.rotation.z = Math.PI / 2;
      for (let spoke = 0; spoke < 10; spoke++) {
        const a = (spoke * Math.PI) / 5;
        rod(
          wheel,
          [side * 0.142, 0, 0],
          [side * 0.142, Math.sin(a) * 0.3, Math.cos(a) * 0.3],
          0.025,
          chrome,
          "spoke",
        );
      }
      const hub = cylinder(
        wheel,
        "hub",
        0.07,
        0.07,
        0.29,
        [0, 0, 0],
        chrome,
        16,
      );
      hub.rotation.z = Math.PI / 2;
      bake(wheel);
    }
  }
  for (let i = 0; i < 9; i++)
    box(
      car,
      "engine-louvre",
      [1.38, 0.028, 0.07],
      [0, 1.0 - i * 0.014, 1.12 + i * 0.085],
      dark,
      0.008,
    );
  box(car, "rear-bumper", [1.98, 0.28, 0.15], [0, 0.49, 2.19], dark, 0.06);
  box(car, "rear-grille", [1.38, 0.16, 0.035], [0, 0.73, 2.3], dark, 0.02);
  box(
    car,
    "yellow-rear-accent",
    [1.94, 0.025, 0.028],
    [0, 0.58, 2.3],
    yellow,
    0.006,
  );
  for (const side of [-1, 1]) {
    const light = box(
      car,
      "rear-light",
      [0.6, 0.055, 0.04],
      [side * 0.72, 0.82, 2.22],
      red,
      0.02,
    );
    light.rotation.z = side * 0.1;
    const tip = box(
      car,
      "rear-light-tip",
      [0.16, 0.045, 0.045],
      [side * 0.48, 0.77, 2.26],
      red,
      0.01,
    );
    tip.rotation.z = side * -0.5;
    const lamp = box(
      car,
      "headlamp",
      [0.54, 0.045, 0.08],
      [side * 0.69, 0.71, -2.17],
      white,
      0.02,
    );
    lamp.rotation.y = side * 0.13;
    const exhaust = cylinder(
      car,
      "exhaust",
      0.08,
      0.08,
      0.19,
      [side * 0.71, 0.4, 2.31],
      chrome,
      16,
    );
    exhaust.rotation.x = Math.PI / 2;
  }
  box(car, "rear-plate", [0.32, 0.15, 0.018], [0, 0.52, 2.285], chrome, 0.012);
  // Keep the four wheel groups independent; the rest becomes a handful of materials.
  const wheels = car.children.filter((o) => o.name.startsWith("wheel-"));
  car.remove(...wheels);
  bake(car);
  car.add(...wheels);
  return car;
}
function van(parent, x, z, color = 0x8b8c80, id = 0) {
  const g = group(parent, `traffic-${id}`);
  g.position.set(x, 0, z);
  const paint = material(`traffic-paint-${id}`, color, 0.66, 0.22);
  box(g, "van-body", [2.12, 1.82, 4.5], [0, 1.29, 0], paint, 0.2);
  box(g, "van-roof", [2.03, 0.13, 3.9], [0, 2.22, 0.15], paint, 0.08);
  box(g, "bumper", [2.14, 0.26, 0.2], [0, 0.56, 2.26], dark, 0.04);
  for (const side of [-1, 1]) {
    box(
      g,
      "rear-window",
      [0.83, 0.67, 0.025],
      [side * 0.49, 1.79, 2.26],
      carGlass,
      0.05,
    );
    box(
      g,
      "brake-light",
      [0.12, 0.35, 0.04],
      [side * 0.98, 1.04, 2.27],
      red,
      0.015,
    );
    box(
      g,
      "cab-window",
      [0.04, 0.74, 0.84],
      [side * 1.065, 1.75, -1.24],
      carGlass,
      0.04,
    );
    for (const a of [-1.38, 1.4]) {
      const w = cylinder(
        g,
        "van-wheel",
        0.4,
        0.4,
        0.23,
        [side * 1.04, 0.4, a],
        rubber,
        20,
      );
      w.rotation.z = Math.PI / 2;
    }
  }
  patch(
    g,
    "van-windscreen",
    [
      [-0.93, 1.45, -2.28],
      [0.93, 1.45, -2.28],
      [0.89, 2.03, -2.19],
      [-0.89, 2.03, -2.19],
    ],
    carGlass,
  );
  box(g, "door-seam", [0.02, 1.37, 0.025], [0, 1.4, 2.28], dark);
  bake(g);
  return g;
}
export function createCity() {
  seed = 8301;
  const root = new T.Group();
  root.name = "night-city";
  const street = group(root, "street");
  box(
    street,
    "asphalt",
    [23, 0.2, 410],
    [-2, -0.12, -150],
    material("asphalt", 0x595b57, 0.96),
  );
  for (const x of [-17.6, 12]) {
    box(
      street,
      "sidewalk",
      [7, 0.32, 410],
      [x, 0.1, -150],
      material("pavement", 0xa49d8b, 0.96),
    );
    box(
      street,
      "curb",
      [0.25, 0.37, 410],
      [x < 0 ? -14 : 8.45, 0.12, -150],
      concrete[2],
    );
  }
  for (let z = 35; z > -350; z -= 5.4) {
    for (const x of [-6.3, -0.7, 4.7])
      box(street, "lane-marking", [0.1, 0.012, 2.8], [x, 0.001, z], white);
    for (const x of [-13.6, 8])
      box(street, "edge-line", [0.12, 0.014, 5.5], [x, 0.002, z], yellow);
    box(street, "paving-joint", [6.9, 0.008, 0.024], [12, 0.267, z], steel);
    box(street, "storm-drain", [0.55, 0.013, 1.2], [8.65, 0.275, z + 1], dark);
    for (let j = 0; j < 5; j++)
      box(
        street,
        "drain-slat",
        [0.5, 0.025, 0.025],
        [8.65, 0.29, z + 0.55 + j * 0.22],
        steel,
      );
    if (z % 2 < 1) {
      for (const x of [-13.8, 8.6]) {
        box(street, "rail-post", [0.09, 1, 0.09], [x, 0.78, z], steel);
        rod(street, [x, 1.2, z], [x, 1.2, z - 5.4], 0.04, chrome);
        box(
          street,
          "safety-panel",
          [0.08, 0.35, 2.3],
          [x, 0.76, z - 1.2],
          z % 3 < 1 ? yellow : steel,
        );
      }
    }
  }
  for (const crossing of [-31, -111, -205, -290]) {
    for (let x = -13; x < 8; x += 0.8)
      box(street, "crosswalk", [0.43, 0.015, 3.8], [x, 0.009, crossing], white);
    box(
      street,
      "stop-line",
      [21, 0.015, 0.17],
      [-2.5, 0.01, crossing + 3],
      white,
    );
  }
  // Fence, urban furniture, lamp poles and overhead utilities give the street its scale.
  for (let z = 0; z > -330; z -= 15) {
    for (const x of [-16.5, 11.1]) {
      rod(street, [x, 0.3, z], [x, 7.5, z], 0.075, steel);
      rod(street, [x, 7.5, z], [x + (x < 0 ? 2 : -2), 7.9, z], 0.075, steel);
      box(
        street,
        "street-light",
        [1.3, 0.12, 0.35],
        [x + (x < 0 ? 2.5 : -2.5), 7.87, z],
        white,
        0.05,
      );
    }
    if (z % 30 === 0) palm(street, 13.7, z - 6, 7.8 + random() * 2);
    box(street, "utility-box", [0.65, 1.1, 0.52], [14, 0.8, z], steel, 0.04);
    box(street, "bollard", [0.16, 0.8, 0.16], [9.2, 0.65, z], yellow, 0.02);
    person(street, 10.4 + random() * 4, z - 4, Math.abs(z) + 1);
    if (z % 30 === 0) person(street, 13 + random(), z - 9, Math.abs(z) + 2);
  }
  // Chain-link fencing on the left, behind the roadside safety rail.
  for (let z = 5; z > -120; z -= 3) {
    rod(street, [-15, 0.3, z], [-15, 3.4, z], 0.035, chrome);
    for (let y = 0.7; y < 3.4; y += 0.38)
      rod(street, [-15, y, z], [-15, y, z - 3], 0.012, chrome);
    for (let y = 0.3; y < 3; y += 0.65) {
      rod(street, [-15, y, z], [-15, y + 0.65, z - 1.5], 0.009, steel);
      rod(street, [-15, y + 0.65, z], [-15, y, z - 1.5], 0.009, steel);
    }
  }
  for (const z of [-36, -122, -219, -305]) {
    const g = group(root, `elevated-crossing-${-z}`);
    box(g, "bridge-deck", [62, 0.8, 4.3], [-3, 11.2, z], steel);
    for (const x of [-19, 17]) {
      box(g, "bridge-pier", [1.1, 11, 1.3], [x, 5.5, z], concrete[1]);
      for (const offset of [-1.8, 1.8])
        rod(g, [x, 10.4, z + offset], [x + 2, 11.2, z + offset], 0.13, steel);
    }
    for (const offset of [-2, 2]) {
      box(g, "parapet", [62, 1.0, 0.13], [-3, 11.9, z + offset], steel);
      box(g, "bridge-rail", [62, 0.1, 0.12], [-3, 12.62, z + offset], chrome);
      for (let x = -32; x < 28; x += 2)
        rod(g, [x, 11.6, z + offset], [x, 12.6, z + offset], 0.035, chrome);
    }
    for (let x = -30; x < 28; x += 3)
      box(g, "bridge-rib", [0.18, 0.35, 4.4], [x, 10.65, z], dark);
    bake(g);
  }
  for (const z of [-24, -89, -180, -270]) {
    for (const x of [-12, 9.5])
      rod(street, [x, 0.3, z], [x, 6.8, z], 0.07, steel);
    rod(street, [-12, 6.8, z], [9.5, 6.8, z], 0.04, steel);
    for (const x of [-8, -2, 5]) {
      box(
        street,
        "traffic-signal",
        [0.35, 0.85, 0.24],
        [x, 6.2, z],
        dark,
        0.06,
      );
      const green = material("signal-green", 0x3aaf78);
      mesh(street, "green-light", new T.SphereGeometry(0.1, 8, 6), green, [
        x,
        5.97,
        z + 0.14,
      ]);
    }
    for (const y of [7, 7.22, 7.44])
      rod(street, [-26, y, z + 1], [24, y, z + 1], 0.012, dark);
  }
  bake(street);
  for (let i = 0; i < 13; i++) {
    const z = -10 - i * 27;
    building(
      root,
      -24 - random() * 4,
      z,
      16 + random() * 8,
      23,
      30 + random() * 59,
      i * 2,
    );
    building(
      root,
      24 + random() * 3,
      z - 9,
      14 + random() * 6,
      23,
      34 + random() * 65,
      i * 2 + 1,
    );
  }
  const skyline = group(root, "distant-skyline");
  for (let i = 0; i < 30; i++) {
    const h = 28 + random() * 130;
    box(
      skyline,
      "distant-tower",
      [7 + random() * 17, h, 10 + random() * 15],
      [(random() - 0.5) * 250, h / 2, -365 - random() * 120],
      concrete[i % 5],
    );
  }
  bake(skyline);
  sign(root, "hotel", 4.6, 2.2, -19, 13.5, 1);
  sign(root, "kiosk", 1.8, 3.1, 14.2, 2.2, -3);
  sportsCar(root);
  van(root, -5.4, -5, 0x929185, 0);
  van(root, -8.8, -25, 0x747c70, 1);
  van(root, -1.1, -50, 0x526c5f, 2);
  van(root, 5.9, -83, 0x707b77, 3);
  van(root, -5.3, -137, 0x9e9785, 4);
  const checkpoints = group(root, "checkpoints");
  for (let i = 0; i < 4; i++) {
    const marker = group(checkpoints, `checkpoint-${i}`);
    marker.position.set(2, 0, -22 - i * 54);
    const m = material(`checkpoint-${i}`, 0xd3df55, 0.35, 0.1);
    const ring = mesh(
      marker,
      "checkpoint-ring",
      new T.TorusGeometry(1.55, 0.035, 6, 64),
      m,
      [0, 0.025, 0],
    );
    ring.rotation.x = -Math.PI / 2;
    box(marker, "beacon", [0.055, 4, 0.055], [0, 2, 0], m);
    const diamond = mesh(
      marker,
      "checkpoint-diamond",
      new T.OctahedronGeometry(0.3),
      m,
      [0, 4.2, 0],
    );
    diamond.rotation.z = Math.PI / 4;
  }
  return root;
}
