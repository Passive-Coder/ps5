import * as T from "three";
import {
  material,
  group,
  mesh,
  box,
  cylinder,
  rod,
  patch,
  bake,
} from "./geometry.mjs";
import { buildCar } from "./car-source.mjs";

const concrete = [0x8a887a, 0x656b69, 0x999383, 0x596368, 0x77766b].map(
  (c, i) => material(`concrete-${i}`, c),
);
const steel = material("painted-steel", 0x354347, 0.67, 0.55);
const dark = material("dark-metal", 0x182326, 0.6, 0.55);
const glass = material("city-glass", 0x2b4c53, 0.22, 0.72);
const window = material("window-light", 0x929b91, 0.47, 0.35);
const yellow = material("road-yellow", 0xc5a642, 0.8);
const railBlue = material("cladding-blue-rail", 0x345b6b, 0.67, 0.3);
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
function sign(parent, id, w, h, x, y, z, rotation = 0) {
  const mount = group(parent, `billboard-${id}`);
  mount.position.set(x, y, z);
  mount.rotation.y = rotation;
  box(mount, "billboard-frame", [w + 0.22, h + 0.22, 0.24], [0, 0, 0], dark);
  const p = mesh(
    mount,
    `sign-${id}`,
    new T.PlaneGeometry(w, h),
    white,
    [0, 0, 0.14],
  );
  for (const side of [-1, 1])
    rod(
      mount,
      [side * w * 0.38, -h / 2, 0],
      [side * w * 0.38, -h / 2 - 1.2, -0.35],
      0.045,
      steel,
    );
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
  const g = group(parent, `city-block-${index}`);
  const trim = material(
    `cladding-trim-${index}`,
    index % 3 === 0 ? 0x885a3c : 0x4f6060,
    0.66,
    0.3,
  );
  const facade = material(
    `concrete-facade-${index}`,
    [0x84918a, 0x777f7b, 0xa1a296, 0x637979, 0x8f9186][index % 5],
    0.9,
  );
  const side = x < 0 ? 1 : -1;
  const tiers =
    h < 25
      ? [[0, h, w, d, 0]]
      : [
          [0, h * 0.36, w, d, 0],
          [h * 0.36, h * 0.34, w * 0.87, d * 0.94, -side * w * 0.065],
          [h * 0.7, h * 0.3, w * 0.72, d * 0.83, -side * w * 0.14],
        ];
  const glazing = Array.from({ length: 4 }, (_, i) =>
    material(
      `city-window-${i}`,
      [0x3b5558, 0x526664, 0x223b43, 0x78817a][i],
      0.25,
      0.65,
    ),
  );
  for (const [base, height, width, depth, shift] of tiers) {
    const center = x + shift,
      inner = center + (side * width) / 2,
      front = z + depth / 2;
    box(
      g,
      "tower-tier",
      [width, height, depth],
      [center, base + height / 2, z],
      facade,
    );
    box(
      g,
      "projecting-cornice",
      [width + 0.65, 0.5, depth + 0.65],
      [center, base + height - 0.25, z],
      trim,
    );
    // Deep metal-framed window bays and slab edges break up the concrete masses.
    for (let y = base + 2.8; y < base + height - 1; y += 2.8) {
      box(
        g,
        "floor-reveal",
        [0.26, 0.17, depth + 0.12],
        [inner + side * 0.12, y - 1.03, z],
        steel,
      );
      box(
        g,
        "front-floor-reveal",
        [width + 0.12, 0.17, 0.26],
        [center, y - 1.03, front + 0.12],
        steel,
      );
      for (let q = -depth / 2 + 1.3; q < depth / 2 - 0.7; q += 2.25) {
        const pane = glazing[Math.floor(random() * 4)];
        box(
          g,
          "recessed-window",
          [0.035, 1.61, 1.3],
          [inner + side * 0.025, y, z + q],
          pane,
        );
        for (const edge of [-1, 1])
          box(
            g,
            "window-jamb",
            [0.2, 1.86, 0.09],
            [inner + side * 0.12, y, z + q + edge * 0.72],
            trim,
          );
        box(
          g,
          "window-sill",
          [0.36, 0.12, 1.55],
          [inner + side * 0.16, y - 0.87, z + q],
          steel,
        );
        box(
          g,
          "window-mullion",
          [0.075, 1.63, 0.038],
          [inner + side * 0.075, y, z + q],
          steel,
        );
        if (random() > 0.73) {
          box(
            g,
            "air-conditioner",
            [0.65, 0.63, 0.9],
            [inner + side * 0.3, y - 1.13, z + q],
            concrete[1],
          );
          for (let v = 0; v < 6; v++)
            box(
              g,
              "ac-vent",
              [0.022, 0.045, 0.7],
              [inner + side * 0.635, y - 1.35 + v * 0.08, z + q],
              dark,
            );
        }
      }
      for (let q = -width / 2 + 1.3; q < width / 2 - 0.7; q += 2.25) {
        box(
          g,
          "front-recessed-window",
          [1.3, 1.61, 0.035],
          [center + q, y, front + 0.025],
          glazing[Math.floor(random() * 4)],
        );
        for (const edge of [-1, 1])
          box(
            g,
            "front-window-jamb",
            [0.09, 1.86, 0.2],
            [center + q + edge * 0.72, y, front + 0.12],
            trim,
          );
        box(
          g,
          "front-window-sill",
          [1.55, 0.12, 0.36],
          [center + q, y - 0.87, front + 0.16],
          steel,
        );
        box(
          g,
          "front-window-mullion",
          [0.038, 1.63, 0.075],
          [center + q, y, front + 0.075],
          steel,
        );
      }
      if (Math.floor(y) % 3 === 0 && y < h * 0.65) {
        box(
          g,
          "service-walkway",
          [1.05, 0.12, depth * 0.65],
          [inner + side * 0.5, y - 1.3, z],
          steel,
        );
        for (let q = -depth * 0.32; q < depth * 0.32; q += 1.3)
          rod(
            g,
            [inner + side * 0.95, y - 1.2, z + q],
            [inner + side * 0.95, y - 0.45, z + q],
            0.025,
            trim,
          );
        rod(
          g,
          [inner + side * 0.95, y - 0.45, z - depth * 0.33],
          [inner + side * 0.95, y - 0.45, z + depth * 0.33],
          0.025,
          trim,
        );
      }
    }
    for (let q = -depth / 2; q <= depth / 2; q += depth / 5)
      box(
        g,
        "structural-buttress",
        [0.55, height, 0.34],
        [inner + side * 0.27, base + height / 2, z + q],
        trim,
      );
    for (let q = -width / 2; q <= width / 2; q += width / 4)
      box(
        g,
        "front-buttress",
        [0.34, height, 0.55],
        [center + q, base + height / 2, front + 0.27],
        trim,
      );
    for (let i = 0; i < 3; i++) {
      box(
        g,
        "roof-plant",
        [2.3, 0.85, 1.7],
        [center - width * 0.27 + i * width * 0.27, base + height + 0.42, z],
        steel,
      );
      cylinder(
        g,
        "vent-stack",
        0.2,
        0.25,
        2,
        [center - width * 0.27 + i * width * 0.27, base + height + 1, z - 2],
        steel,
      );
    }
  }
  const inner = x + (side * w) / 2;
  // Large signs stand out from the layered, weathered façades.
  if (index < 7)
    sign(
      g,
      `hero-${index}`,
      index % 2 ? 4 : 6,
      index % 2 ? 11 : 4,
      inner + side * 0.65,
      Math.min(h * 0.48, 21),
      z + d * 0.12,
      (side * Math.PI) / 2,
    );
  if (index % 2 === 0 && h > 30)
    sign(
      g,
      `vertical-${index}`,
      2.1,
      13,
      inner + side * 0.72,
      h * 0.7,
      z - d * 0.15,
      (side * Math.PI) / 2,
    );
  box(
    g,
    "shop-recess",
    [0.14, 2.7, 5.2],
    [inner + side * 0.08, 1.55, z + d * 0.25],
    dark,
  );
  for (let y = 0.55; y < 2.7; y += 0.18)
    box(
      g,
      "shop-roller-shutter",
      [0.17, 0.045, 3.6],
      [inner + side * 0.2, y, z + d * 0.27],
      steel,
    );
  box(
    g,
    "shop-canopy",
    [2.7, 0.22, 6.1],
    [inner + side * 1.2, 3.15, z + d * 0.25],
    trim,
  );
  for (const q of [-d * 0.27, d * 0.28]) {
    rod(
      g,
      [inner + side * 0.6, 0.3, z + q],
      [inner + side * 0.6, Math.min(21, h - 1), z + q],
      0.13,
      steel,
    );
    for (let y = 2; y < Math.min(21, h - 1); y += 3)
      box(
        g,
        "pipe-bracket",
        [0.7, 0.06, 0.11],
        [inner + side * 0.3, y, z + q],
        dark,
      );
  }
  if (index === 0) {
    // The reference's inset industrial frame and diagonal braces occupy the left foreground.
    for (const q of [-8, 5]) {
      box(
        g,
        "orange-frame-column",
        [0.7, 13, 0.6],
        [inner + 0.65, 9, z + q],
        trim,
      );
      rod(g, [inner + 0.8, 5, z + q], [inner + 0.8, 14, z + q + 6], 0.15, trim);
    }
    for (let y = 5; y < 17; y += 1.5)
      box(
        g,
        "industrial-louvre",
        [0.55, 0.14, 12],
        [inner + 0.45, y, z - 8],
        steel,
      );
    sign(g, "militech", 7, 3, inner + 1.6, 8, z + 8, Math.PI / 2);
  }
  bake(g);
}
function roundTower(parent, x, z, r, h) {
  const g = group(parent, "rounded-corporate-tower");
  cylinder(g, "concrete-core", r, r, h, [x, h / 2, z], concrete[3], 48);
  for (let y = 5; y < h; y += 3.2) {
    const ring = mesh(
      g,
      "circular-ledge",
      new T.TorusGeometry(r + 0.15, 0.12, 6, 64),
      steel,
      [x, y, z],
    );
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2,
        win = box(
          g,
          "curved-tower-window",
          [0.9, 1.9, 0.05],
          [
            x + Math.sin(a) * (r + 0.025),
            y + 1.45,
            z + Math.cos(a) * (r + 0.025),
          ],
          glass,
        );
      win.rotation.y = a;
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rod(
      g,
      [x + Math.sin(a) * (r + 0.12), 0, z + Math.cos(a) * (r + 0.12)],
      [x + Math.sin(a) * (r + 0.12), h, z + Math.cos(a) * (r + 0.12)],
      0.08,
      chrome,
    );
  }
  bake(g);
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
        box(street, "rail-post", [0.09, 1, 0.09], [x, 0.78, z], yellow);
        rod(street, [x, 1.2, z], [x, 1.2, z - 5.4], 0.035, yellow);
        box(
          street,
          "blue-barrier-beam",
          [0.13, 0.16, 5.4],
          [x, 0.43, z - 2.7],
          railBlue,
        );
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
  for (const z of [-8, -63, -153, -250]) {
    for (const x of [-3, 2]) {
      const arrow = group(street, "lane-arrow");
      arrow.position.set(x, 0.018, z);
      box(arrow, "arrow-shaft", [0.16, 0.012, 2.5], [0, 0, 0], white);
      for (const side of [-1, 1]) {
        const tip = box(
          arrow,
          "arrow-tip",
          [0.14, 0.012, 0.95],
          [side * 0.3, 0, -0.8],
          white,
        );
        tip.rotation.y = side * -0.72;
      }
    }
    mesh(
      street,
      "manhole",
      new T.CylinderGeometry(0.42, 0.42, 0.015, 32),
      steel,
      [-1, 0.013, z + 6],
    );
    box(
      street,
      "road-repair",
      [2.8, 0.004, 3.6],
      [-7.6, -0.012, z + 11],
      material("asphalt-patch", 0x444944, 0.98),
    );
    const bench = box(
      street,
      "bench",
      [0.6, 0.25, 2],
      [13.8, 0.72, z - 2],
      steel,
      0.04,
    );
    for (const dz of [-0.7, 0.7])
      box(
        street,
        "bench-leg",
        [0.4, 0.4, 0.07],
        [13.8, 0.42, z - 2 + dz],
        dark,
      );
  }
  palm(street, -13.4, -29, 9.2);
  palm(street, -13.4, -91, 8.5);
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
  for (const [z, y] of [
    [-52, 14],
    [-113, 7.7],
    [-216, 12],
  ]) {
    const g = group(root, `elevated-crossing-${-z}`);
    box(g, "elevated-deck", [60, 0.65, 3.2], [-3, y, z], steel);
    for (const x of [-19, 15]) {
      box(g, "bridge-support", [0.7, y, 1], [x, y / 2, z], concrete[1]);
      for (const offset of [-1.2, 1.2])
        rod(
          g,
          [x, y - 2, z + offset],
          [x + (x < 0 ? 2 : -2), y, z + offset],
          0.13,
          steel,
        );
    }
    for (const dz of [-1.5, 1.5]) {
      box(
        g,
        "bridge-edge-beam",
        [60, 0.54, 0.18],
        [-3, y + 0.38, z + dz],
        concrete[1],
      );
      rod(g, [-33, y + 1.25, z + dz], [27, y + 1.25, z + dz], 0.035, chrome);
      for (let x = -33; x < 28; x += 2)
        rod(g, [x, y + 0.5, z + dz], [x, y + 1.25, z + dz], 0.025, chrome);
    }
    if (z === -52) {
      for (const x of [-9, -4, 2, 8])
        rod(g, [15, 19, z], [x, y + 0.3, z - 1.2], 0.02, dark);
      box(g, "cable-pylon", [0.5, 19, 0.6], [15, 9.5, z], steel);
    }
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
  const blocks = [
    [-29, -22, 26, 44, 49],
    [-32, -69, 23, 32, 74],
    [-27, -112, 19, 28, 102],
    [-34, -158, 28, 36, 65],
    [-29, -204, 22, 33, 94],
    [-31, -256, 24, 43, 116],
    [-28, -315, 23, 38, 85],
    [25, -25, 18, 50, 17],
    [32, -86, 25, 38, 47],
    [26, -139, 18, 31, 73],
    [32, -194, 26, 41, 92],
    [27, -251, 20, 35, 68],
    [30, -310, 24, 42, 108],
  ];
  blocks.forEach(([x, z, w, d, h], i) => building(root, x, z, w, d, h, i));
  roundTower(root, -29, -93, 5.8, 79);
  const utilities = group(root, "fenced-utility-yard");
  for (let i = 0; i < 5; i++) {
    box(
      utilities,
      "power-transformer",
      [2.6, 3.1, 2.4],
      [-18, 1.6, -22 - i * 4.1],
      concrete[2],
      0.05,
    );
    const top = box(
      utilities,
      "sloped-transformer-top",
      [2.8, 0.22, 2.7],
      [-18, 3.2, -22 - i * 4.1],
      steel,
    );
    top.rotation.z = 0.12;
    for (let j = 0; j < 12; j++)
      box(
        utilities,
        "cooling-fin",
        [0.25, 2.4, 0.055],
        [-16.58, 1.6, -23.03 - i * 4.1 + j * 0.19],
        steel,
      );
  }
  bake(utilities);
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
  sign(root, "hotel", 4.6, 2.2, -15.4, 10.5, -5, Math.PI / 2);
  sign(root, "kiosk", 1.5, 2.7, 11.6, 1.75, -4.5);
  sign(root, "right-poster", 4.5, 7, 16, 13, -7, -0.25);
  buildCar(root);
  van(root, -5.4, -2.5, 0x929185, 0);
  van(root, -8.8, -25, 0x747c70, 1);
  van(root, -1.1, -44, 0x526c5f, 2).scale.set(1.3, 1.5, 1.3);
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
