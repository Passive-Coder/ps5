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
import { DRIVE_LANE_X, roadOffset } from "../src/checkpoints.js";

const concrete = [0x8a887a, 0x656b69, 0x999383, 0x596368, 0x77766b].map(
  (c, i) => material(`concrete-${i}`, c),
);
const steel = material("painted-steel", 0x354347, 0.67, 0.55);
const dark = material("dark-metal", 0x182326, 0.6, 0.55);
const glass = material("city-glass", 0x2b4c53, 0.22, 0.72);
const yellow = material("road-yellow", 0xc5a642, 0.8);
const railBlue = material("cladding-blue-rail", 0x345b6b, 0.67, 0.3);
const white = material("road-white", 0xbeb9a2, 0.86);
const red = material("tail-light", 0xee3531, 0.2);
const rubber = material("rubber", 0x101719, 0.95);
const chrome = material("alloy", 0x74817f, 0.24, 0.88);
const carGlass = material("car-glass", 0x132526, 0.1, 0.85);
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
  const g = group(parent, "date-palm");
  const bark = material("palm-bark", 0x70634b, 0.96);
  const oldLeaf = material("palm-dry-leaf", 0x7d7950, 0.98);
  const leafMats = [0x65724c, 0x526745, 0x6c784e, 0x7a7e52].map((c) =>
    material("palm-leaf", c, 0.89),
  );
  leafMats.forEach((m) => (m.side = T.DoubleSide));
  for (let j = 0; j < 18; j++) {
    const y0 = (height * j) / 18,
      y1 = (height * (j + 1)) / 18;
    const lean = (t) => 0.6 * (t / height) ** 2;
    rod(
      g,
      [x + lean(y0), y0, z],
      [x + lean(y1), y1, z],
      0.16 * (1 - j / 45),
      bark,
      "curved-palm-trunk",
    );
  }
  for (let y = 0.3; y < height; y += 0.19) {
    const ring = mesh(
      g,
      "trunk-leaf-scar",
      new T.TorusGeometry(0.145 * (1 - (y / height) * 0.4), 0.016, 4, 10),
      oldLeaf,
      [x + 0.6 * (y / height) ** 2, y, z],
    );
    ring.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996,
      length = 2.7 + random() * 0.9;
    const points = [];
    const point = (t) =>
      new T.Vector3(
        x + 0.6 + Math.cos(angle) * length * t,
        height + Math.sin(t * Math.PI) * 1.9 - t * t * 1.1 + (i % 3) * 0.17,
        z + Math.sin(angle) * length * t,
      );
    for (let j = 0; j <= 18; j++) points.push(point(j / 18));
    for (let j = 0; j < 18; j++)
      rod(
        g,
        points[j].toArray(),
        points[j + 1].toArray(),
        0.018,
        oldLeaf,
        "frond-rib",
      );
    for (let j = 2; j < 18; j++) {
      const t = j / 18,
        mid = point(t),
        len = 0.72 * Math.sin(Math.PI * t) ** 0.65;
      for (const side of [-1, 1]) {
        const spread = angle + side * 1.1;
        const tip = mid
          .clone()
          .add(
            new T.Vector3(
              Math.cos(spread) * len,
              -0.16 - t * 0.16,
              Math.sin(spread) * len,
            ),
          );
        const along = new T.Vector3(
          Math.cos(angle) * 0.09,
          0.015,
          Math.sin(angle) * 0.09,
        );
        const geo = new T.BufferGeometry();
        geo.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            [
              ...mid.clone().sub(along).toArray(),
              ...mid.clone().add(along).toArray(),
              ...tip.toArray(),
              ...mid
                .clone()
                .add(tip)
                .multiplyScalar(0.5)
                .add(new T.Vector3(0, 0.045, 0))
                .toArray(),
            ],
            3,
          ),
        );
        geo.setAttribute(
          "uv",
          new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0.5, 0.5], 2),
        );
        geo.setIndex([0, 1, 3, 1, 2, 3, 2, 0, 3]);
        geo.computeVertexNormals();
        mesh(g, "pinnate-leaflet", geo, leafMats[(i + j) % 4]);
      }
    }
  }
  bake(g);
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
    sign(g, "militech", 10, 3.5, -18.5, 11.2, -54, 1.2);
  }
  bake(g);
}
function windowedOffice(parent) {
  const g = group(parent, "green-windowed-office");
  const green = material("cladding-office-green", 0x36584d, 0.75, 0.2);
  const rust = material("cladding-office-rust", 0x986c48, 0.68, 0.32);
  const glazing = material("reference-window-bay", 0xffffff, 0.37, 0.26);
  box(g, "office-core", [70, 49, 12], [0, 24.5, 0], green);
  for (const [width, x, z, rot] of [
    [70, 0, 6.05, 0],
    [12, 35.05, 0, Math.PI / 2],
  ]) {
    const face = group(g, "deep-windowed-elevation");
    face.position.set(x, 0, z);
    face.rotation.y = rot;
    for (let bx = -width / 2 + 4; bx < width / 2; bx += 8) {
      for (const y of [11, 28, 44]) {
        box(face, "deep-window-reveal", [6.4, 11.7, 0.25], [bx, y, 0.12], dark);
        mesh(
          face,
          "glazed-window-grid",
          new T.PlaneGeometry(5.65, 10.8),
          glazing,
          [bx, y, 0.28],
        );
        for (const edge of [-1, 1]) {
          box(
            face,
            "rust-window-jamb",
            [0.5, 12.5, 0.8],
            [bx + edge * 3.2, y, 0.45],
            rust,
            0.04,
          );
          box(
            face,
            "rust-window-header",
            [6.8, 0.5, 0.8],
            [bx, y + edge * 6, 0.45],
            rust,
            0.04,
          );
        }
        for (let row = -5; row < 5.5; row += 1.35)
          box(
            face,
            "projecting-window-transom",
            [5.7, 0.06, 0.2],
            [bx, y + row, 0.4],
            steel,
          );
        for (let q = -2.2; q < 2.3; q += 1.1)
          box(
            face,
            "window-mullion",
            [0.055, 10.8, 0.16],
            [bx + q, y, 0.38],
            steel,
          );
      }
      for (const y of [3, 19.5, 36.5])
        for (let j = 0; j < 6; j++)
          box(
            face,
            "horizontal-service-louvre",
            [6.2, 0.16, 0.4],
            [bx, y + j * 0.35, 0.35],
            steel,
          );
      box(
        face,
        "deep-green-pilaster",
        [0.8, 49, 1.2],
        [bx + 3.8, 24.5, 0.55],
        green,
        0.07,
      );
    }
    for (const y of [5, 21, 38, 49])
      box(
        face,
        "office-projecting-cornice",
        [width + 1, 0.65, 1.8],
        [0, y, 0.65],
        green,
      );
  }
  bake(g);
  g.position.set(-62, 0, -36);
}
function goldTowerElevation(parent, width, height, x, z, rotation) {
  const face = group(parent, "flared-tower-bays");
  face.position.set(x, 0, z);
  face.rotation.y = rotation;
  const gold = material("cladding-gold-structural-frame", 0xb39c73, 0.57, 0.55);
  const panel = material("reference-tower-louvres", 0xffffff, 0.65, 0.3);
  const bays = Math.round(width / 10.5),
    bw = width / bays,
    bottom = 16,
    top = height - 2;
  for (let i = 0; i < bays; i++) {
    const cx = -width / 2 + bw * (i + 0.5);
    const shape = new T.Shape();
    shape.moveTo(cx - bw * 0.29, bottom);
    shape.lineTo(cx + bw * 0.29, bottom);
    shape.lineTo(cx + bw * 0.43, top - 8);
    shape.lineTo(cx + bw * 0.49, top);
    shape.lineTo(cx - bw * 0.49, top);
    shape.lineTo(cx - bw * 0.43, top - 8);
    shape.closePath();
    const hole = new T.Path();
    hole.moveTo(cx - bw * 0.22, bottom + 2);
    hole.lineTo(cx - bw * 0.39, top - 2);
    hole.lineTo(cx + bw * 0.39, top - 2);
    hole.lineTo(cx + bw * 0.22, bottom + 2);
    hole.closePath();
    shape.holes.push(hole);
    mesh(
      face,
      "flared-gold-megaframe",
      new T.ExtrudeGeometry(shape, {
        depth: 1.7,
        bevelEnabled: true,
        bevelSize: 0.09,
        bevelThickness: 0.09,
        bevelSegments: 2,
        steps: 1,
      }),
      gold,
      [0, 0, 0.35],
    );
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [
          cx - bw * 0.38,
          top - 2,
          0.4,
          cx + bw * 0.38,
          top - 2,
          0.4,
          cx - bw * 0.215,
          bottom + 2,
          0.4,
          cx + bw * 0.215,
          bottom + 2,
          0.4,
        ],
        3,
      ),
    );
    geometry.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2),
    );
    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    geometry.computeVertexNormals();
    mesh(face, "deep-louvered-trapezoid", geometry, panel);
    for (let y = bottom + 3; y < top - 2; y += 1.25) {
      const t = (y - bottom) / (top - bottom),
        w = bw * (0.43 + t * 0.32);
      box(
        face,
        "recessed-metal-floor-slat",
        [w, 0.1, 0.14],
        [cx, y, 0.55],
        steel,
      );
    }
    box(
      face,
      "tower-top-crown",
      [bw + 0.25, 0.9, 3.5],
      [cx, top + 1, 1.1],
      gold,
      0.06,
    );
    for (const edge of [-1, 1]) {
      const a = new T.Vector3(cx + edge * bw * 0.3, bottom - 8, 0.2),
        b = new T.Vector3(cx + edge * bw * 0.29, bottom + 2, 1.7);
      const beam = box(
        face,
        "diagonal-podium-buttress",
        [0.8, a.distanceTo(b), 1.2],
        a.clone().add(b).multiplyScalar(0.5).toArray(),
        gold,
        0.05,
      );
      beam.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        b.sub(a).normalize(),
      );
    }
  }
  for (let y = 3; y < 16; y += 3.2) {
    box(face, "podium-glazing", [width, 0.85, 0.08], [0, y, 0.08], glass);
    box(
      face,
      "podium-slab-edge",
      [width + 0.8, 0.7, 1.3],
      [0, y + 0.9, 0.4],
      steel,
    );
    for (let q = -width / 2; q < width / 2; q += 1.2)
      box(
        face,
        "podium-window-mullion",
        [0.05, 0.9, 0.1],
        [q, y, 0.16],
        chrome,
      );
  }
}
function referenceArchitecture(parent) {
  windowedOffice(parent);
  const tower = group(parent, "gold-braced-megatower");
  box(
    tower,
    "megatower-core",
    [42, 60, 34],
    [0, 30, 0],
    material("cladding-tower-blue-grey", 0x455456, 0.73, 0.3),
  );
  goldTowerElevation(tower, 42, 60, 0, 17.02, 0);
  goldTowerElevation(tower, 34, 60, 21.02, 0, Math.PI / 2);
  for (const y of [15, 58])
    box(tower, "deep-transfer-floor", [44, 1, 36], [0, y, 0], steel);
  bake(tower);
  tower.position.set(-46, 0, -98);
  const pale = group(parent, "pale-skyline-crown");
  const grey = material("concrete-pale-crown", 0xa7a79b, 0.89);
  box(pale, "concrete-crown-core", [27, 142, 32], [0, 71, 0], grey);
  for (let q = -12; q <= 12; q += 4) {
    box(pale, "vertical-dark-glazing", [2, 132, 0.09], [q, 66, 16.05], glass);
    box(pale, "deep-concrete-fin", [0.7, 142, 1.5], [q + 1.4, 71, 16.5], grey);
  }
  for (let y = 8; y < 142; y += 8)
    box(pale, "crown-horizontal-ribbon", [27, 0.8, 1.6], [0, y, 16.4], steel);
  bake(pale);
  pale.position.set(-19, 0, -170);
  sign(parent, "nc-mark", 8, 12, -11, 75, -152);
}
function bendDistrict(root) {
  root.updateMatrixWorld(true);
  const point = new T.Vector3();
  const center = new T.Vector3();
  // Buildings remain rigid. Warping their sparsely tessellated cores made the
  // walls cut through the denser facade meshes and hide the recessed detail.
  for (const child of root.children) {
    if (child.name === "player-car" || child.name === "checkpoints") continue;
    if (
      ![
        "street",
        "construction-safety-barriers",
        "fenced-utility-yard",
      ].includes(child.name)
    ) {
      new T.Box3().setFromObject(child).getCenter(center);
      // Left-side industrial blocks follow the reference's fixed city grid;
      // only the right-side frontage steps outward with the turning road.
      if (center.x > 0) child.position.x += roadOffset(-center.z);
      continue;
    }
    child.traverse((o) => {
      if (!o.isMesh) return;
      const inverse = o.matrixWorld.clone().invert();
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        point.x += roadOffset(-point.z);
        point.applyMatrix4(inverse);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      o.geometry.computeVertexNormals();
    });
  }
}
function roundTower(parent, x, z, r, h, base = 0) {
  const g = group(parent, "rounded-corporate-tower");
  cylinder(
    g,
    "glass-banded-core",
    r,
    r,
    h,
    [x, h / 2, z],
    material("reference-facade-2", 0xffffff, 0.46, 0.3),
    64,
  );
  for (let y = 5; y < h; y += 3.2) {
    const ring = mesh(
      g,
      "circular-ledge",
      new T.TorusGeometry(r + 0.15, 0.12, 6, 64),
      steel,
      [x, y, z],
    );
    ring.rotation.x = Math.PI / 2;
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
  g.position.y = base;
}
function van(parent, x, z, color = 0x8b8c80, id = 0) {
  const g = group(parent, `traffic-${id}`);
  g.position.set(x, 0, z);
  const paint = material(`traffic-paint-${id}`, color, 0.66, 0.22);
  const body = box(g, "van-body", [2.12, 1.3, 4.5], [0, 1.55, 0], paint, 0.16);
  const bodyVertices = body.geometry.attributes.position;
  for (let i = 0; i < bodyVertices.count; i++) {
    const taper = T.MathUtils.clamp((bodyVertices.getY(i) + 0.1) / 0.75, 0, 1);
    let depth = bodyVertices.getZ(i);
    if (depth > 1.6) depth -= 0.5 * taper;
    if (depth < -1.6) depth += 0.6 * taper;
    bodyVertices.setXYZ(
      i,
      bodyVertices.getX(i) * (1 - 0.1 * taper),
      bodyVertices.getY(i),
      depth,
    );
  }
  body.geometry.computeVertexNormals();
  // Open wheel arches expose the tyres instead of covering them with a solid box.
  for (const side of [-1, 1]) {
    const positions = [],
      indices = [],
      uv = [];
    for (let i = 0; i <= 120; i++) {
      const z = -2.25 + (i / 120) * 4.5;
      let low = 0.35;
      for (const axle of [-1.38, 1.4])
        if (Math.abs(z - axle) < 0.46)
          low = Math.max(low, 0.4 + Math.sqrt(0.46 ** 2 - (z - axle) ** 2));
      positions.push(side * 1.06, low, z, side * 1.06, 0.95, z);
      uv.push(i / 120, 0, i / 120, 1);
      if (i < 120) {
        const n = i * 2,
          quad = [n, n + 1, n + 2, n + 1, n + 3, n + 2];
        indices.push(...(side < 0 ? quad.reverse() : quad));
      }
    }
    const shell = new T.BufferGeometry();
    shell.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    shell.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    shell.setIndex(indices);
    shell.computeVertexNormals();
    mesh(g, "van-lower-side", shell, paint);
  }
  for (const end of [-1, 1])
    box(
      g,
      "van-lower-end",
      [2.06, 0.55, 0.15],
      [0, 0.65, end * 2.16],
      paint,
      0.05,
    );
  box(g, "van-roof", [1.9, 0.13, 3.3], [0, 2.22, -0.04], paint, 0.06);
  box(g, "bumper", [2.14, 0.26, 0.2], [0, 0.56, 2.26], dark, 0.04);
  patch(
    g,
    "sloping-rear-panel",
    [
      [1.01, 1.12, 2.27],
      [-1.01, 1.12, 2.27],
      [-0.91, 2.06, 1.84],
      [0.91, 2.06, 1.84],
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    for (let vent = 0; vent < 5; vent++)
      box(
        g,
        "rear-roof-vent",
        [0.12, 0.025, 0.06],
        [side * (0.37 + vent * 0.11), 2.09, 1.84],
        dark,
      );
    box(
      g,
      "brake-light",
      [0.86, 0.045, 0.04],
      [side * 0.51, 1.18, 2.27],
      red,
      0.015,
    );
    box(
      g,
      "vertical-tail-light",
      [0.065, 0.28, 0.035],
      [side * 0.95, 0.76, 2.27],
      red,
      0.015,
    );
    const cabWindow = [
      [side * 1.06, 1.48, -1.97],
      [side * 1.06, 1.48, -0.82],
      [side * 0.965, 2.04, -0.82],
      [side * 0.965, 2.04, -1.62],
    ];
    if (side < 0) cabWindow.reverse();
    patch(g, "cab-window", cabWindow, carGlass);
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
      [0.89, 2.03, -1.76],
      [-0.89, 2.03, -1.76],
    ],
    carGlass,
  );
  for (const side of [-1, 1]) {
    box(
      g,
      "rub-strip",
      [0.035, 0.075, 4.15],
      [side * 1.073, 0.85, 0],
      dark,
      0.018,
    );
    for (const dz of [-0.73, 0.8])
      box(
        g,
        "sliding-door-seam",
        [0.012, 1.26, 0.015],
        [side * 1.066, 1.45, dz],
        steel,
      );
    box(g, "door-track", [0.026, 0.035, 1.8], [side * 1.08, 1.7, 0.65], steel);
    box(
      g,
      "van-door-handle",
      [0.025, 0.045, 0.23],
      [side * 1.08, 1.48, -0.62],
      dark,
      0.009,
    );
    box(
      g,
      "van-mirror",
      [0.17, 0.22, 0.25],
      [side * 1.16, 1.88, -1.67],
      dark,
      0.04,
    );
    for (const dz of [-1.38, 1.4]) {
      const hub = cylinder(
        g,
        "van-wheel-hub",
        0.24,
        0.24,
        0.24,
        [side * 1.055, 0.4, dz],
        chrome,
        24,
      );
      hub.rotation.z = Math.PI / 2;
    }
  }
  bake(g);
  return g;
}
function constructionTruck(parent, x, z) {
  const g = group(parent, "traffic-flatbed");
  g.position.set(x, 0, z);
  const paint = material("cladding-truck-container", 0x566a51, 0.78, 0.2);
  box(g, "truck-chassis", [2.25, 0.28, 6.3], [0, 0.7, 0], dark);
  box(g, "truck-flatbed", [2.4, 0.25, 4.1], [0, 1, 0.8], steel);
  box(g, "green-container", [2.15, 2.15, 2.8], [0, 2.15, 0.1], paint, 0.06);
  for (const side of [-1, 1]) {
    for (let dz = -1.1; dz < 1.5; dz += 0.18)
      box(
        g,
        "container-rib",
        [0.055, 1.9, 0.045],
        [side * 1.1, 2.15, dz],
        paint,
      );
    box(
      g,
      "container-corner",
      [0.09, 2.25, 0.09],
      [side * 1.1, 2.15, 1.53],
      steel,
    );
    box(
      g,
      "truck-mirror",
      [0.16, 0.3, 0.21],
      [side * 1.24, 2.15, -2.3],
      dark,
      0.025,
    );
    for (const axle of [-2.2, 0.85, 2.1]) {
      const tyre = cylinder(
        g,
        "truck-tyre",
        0.43,
        0.43,
        0.28,
        [side * 1.07, 0.43, axle],
        rubber,
        24,
      );
      tyre.rotation.z = Math.PI / 2;
      const hub = cylinder(
        g,
        "truck-hub",
        0.25,
        0.25,
        0.29,
        [side * 1.09, 0.43, axle],
        chrome,
        24,
      );
      hub.rotation.z = Math.PI / 2;
    }
    box(
      g,
      "rear-truck-lamp",
      [0.3, 0.11, 0.04],
      [side * 0.85, 0.83, 2.92],
      red,
    );
  }
  box(g, "truck-cab", [2.14, 1.65, 1.7], [0, 1.65, -2.18], paint, 0.1);
  box(g, "cab-windscreen", [1.9, 0.66, 0.02], [0, 2.03, -3.05], carGlass, 0.03);
  box(g, "truck-bumper", [2.35, 0.22, 0.19], [0, 0.61, 2.94], dark);
  for (const side of [-1, 1])
    box(
      g,
      "truck-cab-window",
      [0.025, 0.6, 1.05],
      [side * 1.08, 2.03, -2.25],
      carGlass,
      0.03,
    );
  bake(g);
  return g;
}
export function createCity(car) {
  seed = 8301;
  const root = new T.Group();
  root.name = "night-city";
  const street = group(root, "street");
  box(
    street,
    "district-ground",
    [400, 0.2, 800],
    [0, -0.36, -150],
    material("asphalt", 0x73736a, 0.96),
  );
  mesh(
    street,
    "asphalt",
    new T.BoxGeometry(24.5, 0.2, 410, 1, 1, 205),
    material("asphalt", 0x595b57, 0.96),
    [-2.25, -0.12, -150],
  );
  for (const x of [-17.6, 12]) {
    mesh(
      street,
      "sidewalk",
      new T.BoxGeometry(15, 0.32, 410, 1, 1, 205),
      material("pavement", 0xa49d8b, 0.96),
      [x < 0 ? -21.6 : 17, 0.1, -150],
    );
    mesh(
      street,
      "curb",
      new T.BoxGeometry(0.25, 0.37, 410, 1, 1, 205),
      concrete[2],
      [x < 0 ? -14 : 9.45, 0.12, -150],
    );
  }
  for (let z = 35; z > -350; z -= 5.4) {
    for (const x of [-8.5, -3, 3])
      box(street, "lane-marking", [0.1, 0.012, 2.8], [x, 0.001, z], white);
    for (const x of [-13.6, 9])
      box(street, "edge-line", [0.12, 0.014, 5.5], [x, 0.002, z], yellow);
    box(street, "paving-joint", [6.9, 0.008, 0.024], [13, 0.267, z], steel);
    box(street, "storm-drain", [0.55, 0.013, 1.2], [9.65, 0.275, z + 1], dark);
    for (let j = 0; j < 5; j++)
      box(
        street,
        "drain-slat",
        [0.5, 0.025, 0.025],
        [9.65, 0.29, z + 0.55 + j * 0.22],
        steel,
      );
    if (z % 2 < 1) {
      for (const x of [-13.8, 9.6]) {
        const rail =
          x > 0 ? material("cladding-road-rail", 0xa77e4b, 0.72, 0.35) : yellow;
        box(street, "rail-post", [0.075, 0.9, 0.075], [x, 0.73, z], rail);
        rod(street, [x, 1.12, z], [x, 1.12, z - 5.4], 0.032, rail);
        rod(street, [x, 0.76, z], [x, 0.76, z - 5.4], 0.025, rail);
        box(
          street,
          "blue-barrier-beam",
          [0.13, 0.16, 5.4],
          [x, 0.43, z - 2.7],
          railBlue,
        );
        if (x < 0)
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
  for (const crossing of [-82, -160, -250, -320]) {
    for (let x = -13; x < 9; x += 0.8)
      box(street, "crosswalk", [0.43, 0.015, 3.8], [x, 0.009, crossing], white);
    box(
      street,
      "stop-line",
      [22, 0.015, 0.17],
      [-2, 0.01, crossing + 3],
      white,
    );
  }
  // Fence, urban furniture, lamp poles and overhead utilities give the street its scale.
  for (let z = 0; z > -330; z -= 15) {
    for (const x of [-16.5, 11.1]) {
      if (x > 0 && z === 0) continue;
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
    if (z % 30 === 0 && z < -15) palm(street, 13.7, z - 6, 7.8 + random() * 2);
    if (z < -15)
      box(street, "utility-box", [0.65, 1.1, 0.52], [14, 0.8, z], steel, 0.04);
    box(street, "bollard", [0.16, 0.8, 0.16], [10.2, 0.65, z], dark, 0.02);
    box(
      street,
      "bollard-reflector",
      [0.165, 0.1, 0.165],
      [10.2, 0.96, z],
      yellow,
    );
    // Animated pedestrian meshes are loaded from their own WASM asset.
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
  }
  box(
    street,
    "foreground-drain-bed",
    [0.85, 0.025, 2],
    [10.0, 0.278, -0.6],
    dark,
  );
  for (let i = 0; i < 15; i++)
    box(
      street,
      "foreground-drain-grate",
      [0.8, 0.028, 0.027],
      [10.0, 0.3, 0.3 - i * 0.13],
      steel,
    );
  const roadPanel = mesh(
    street,
    "road-paint-panel",
    new T.PlaneGeometry(2.9, 4),
    material("road-paint", 0xc5c4af, 0.93),
    [DRIVE_LANE_X, 0.005, -14],
  );
  roadPanel.rotation.x = -Math.PI / 2;
  palm(street, -13.4, -48, 16);
  palm(street, -13.4, -110, 13);
  const lampOrange = material("cladding-lamp-orange", 0xb58b40, 0.63, 0.4);
  rod(street, [-14, 0, -46], [-14, 8.4, -46], 0.085, steel);
  for (const side of [-1, 1]) {
    rod(
      street,
      [-14, 8.4, -46],
      [-14 + side * 4.1, 8.65, -46],
      0.06,
      lampOrange,
    );
    box(
      street,
      "long-orange-light",
      [4.8, 0.13, 0.38],
      [-14 + side * 2.6, 8.67, -46],
      lampOrange,
    );
    box(
      street,
      "light-diffuser",
      [4.5, 0.025, 0.28],
      [-14 + side * 2.6, 8.59, -46],
      white,
    );
  }
  // Dense horizontal security bars and angled spikes behind the roadside rail.
  for (let z = 5; z > -120; z -= 3) {
    rod(street, [-15, 0.3, z], [-15, 3.4, z], 0.035, chrome);
    for (let y = 0.7; y < 3.4; y += 0.28)
      rod(street, [-15, y, z], [-15, y, z - 3], 0.012, chrome);
    rod(street, [-15, 3.4, z], [-14.7, 3.75, z], 0.022, chrome);
  }
  for (const [z, y] of [
    [-52, 14],
    [-113, 7.7],
    [-216, 12],
  ]) {
    const g = group(root, `elevated-crossing-${-z}`);
    const pedestrianBridge = z === -113;
    const bridgeFrame = pedestrianBridge
      ? material("cladding-footbridge-orange", 0xb99151, 0.65, 0.3)
      : steel;
    box(g, "elevated-deck", [60, 0.65, 3.2], [-3, y, z], bridgeFrame);
    for (const x of [-19, 15]) {
      box(
        g,
        "bridge-support",
        [pedestrianBridge ? 1.3 : 0.7, y, 1],
        [x, y / 2, z],
        concrete[1],
      );
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
        pedestrianBridge ? bridgeFrame : concrete[1],
      );
      rod(
        g,
        [-33, y + 1.25, z + dz],
        [27, y + 1.25, z + dz],
        0.035,
        bridgeFrame,
      );
      for (let x = -33; x < 28; x += 2) {
        rod(g, [x, y + 0.5, z + dz], [x, y + 1.25, z + dz], 0.025, bridgeFrame);
        if (pedestrianBridge && x < 27)
          box(
            g,
            "bridge-rail-panel",
            [1.85, 0.78, 0.045],
            [x + 0.96, y + 0.82, z + dz],
            glass,
          );
      }
    }
    if (pedestrianBridge) {
      for (let i = 0; i < 24; i++)
        box(
          g,
          "footbridge-stair",
          [3.2, 0.22, 0.52],
          [-19, 0.3 + i * 0.32, z + 12 - i * 0.5],
          concrete[2],
        );
      for (const x of [-20.55, -17.45])
        rod(g, [x, 1.25, z + 12], [x, y + 1.25, z], 0.045, bridgeFrame);
    }
    if (z === -52) {
      for (const x of [-9, -4, 2, 8])
        rod(g, [15, 19, z], [x, y + 0.3, z - 1.2], 0.02, dark);
      box(g, "cable-pylon", [0.5, 19, 0.6], [15, 9.5, z], steel);
    }
    if (z === -52) {
      for (const child of g.children) child.position.z -= z;
      g.position.z = z;
      g.rotation.y = -0.38;
    }
    bake(g);
  }
  for (const z of [-89, -180, -270]) {
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
    [25, -25, 18, 50, 14],
    [32, -86, 25, 38, 47],
    [26, -139, 18, 31, 73],
    [32, -194, 26, 41, 92],
    [27, -251, 20, 35, 68],
    [30, -310, 24, 42, 108],
  ];
  blocks.forEach(([x, z, w, d, h], i) => {
    if (i > 2 && i !== 7) building(root, x, z, w, d, h, i);
  });
  const storefront = group(root, "shaded-storefront");
  box(storefront, "storefront-mass", [17, 12, 43], [26, 6, -18], dark);
  for (const y of [4.2, 8.5, 11.5])
    box(storefront, "storefront-overhang", [21, 0.75, 44], [24, y, -18], steel);
  for (let z = 1; z > -40; z -= 4) {
    box(
      storefront,
      "shop-front-recess",
      [0.08, 3.5, 3.4],
      [17.45, 2.1, z],
      carGlass,
    );
    box(
      storefront,
      "shop-front-pier",
      [0.65, 8.6, 0.38],
      [17.2, 4.3, z + 1.8],
      steel,
    );
  }
  bake(storefront);
  storefront.position.x = 8;
  referenceArchitecture(root);
  roundTower(root, -43, -82, 10, 12, 14);
  sign(root, "hero-0", 5.4, 7.2, -17.4, 11, -46, 0.25);
  sign(root, "hero-1", 5.2, 7, -16.7, 14.2, -97, 0.3);
  sign(root, "masala", 8, 2.6, -30, 11.6, -57, 0.3);
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
  const barriers = group(root, "construction-safety-barriers");
  const orange = material("cladding-safety-orange", 0xbb7442, 0.83, 0.2);
  const barrierFace = material("reference-barrier-panel", 0xffffff, 0.86);
  for (let z = 3; z > -85; z -= 3.1) {
    box(
      barriers,
      "concrete-barrier-foot",
      [0.6, 0.25, 2.9],
      [-13.4, 0.17, z],
      concrete[2],
      0.05,
    );
    box(
      barriers,
      "inset-safety-panel",
      [0.16, 0.78, 2.6],
      [-13.4, 0.65, z],
      concrete[2],
      0.025,
    );
    for (const dz of [-1.32, 1.32])
      box(
        barriers,
        "orange-panel-post",
        [0.2, 0.95, 0.07],
        [-13.31, 0.7, z + dz],
        orange,
      );
    for (const y of [0.35, 1.04])
      box(
        barriers,
        "orange-panel-rail",
        [0.2, 0.07, 2.7],
        [-13.31, y, z],
        orange,
      );
    const face = mesh(
      barriers,
      "barrier-marked-face",
      new T.PlaneGeometry(2.45, 0.64),
      barrierFace,
      [-13.285, 0.72, z],
    );
    face.rotation.y = Math.PI / 2;
  }
  bake(barriers);
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
  sign(root, "kiosk", 1.5, 2.7, 14.5, 1.75, -4.5);
  sign(root, "right-poster", 4.5, 7, 16, 13, -7, -0.25);
  root.add(car);
  van(root, DRIVE_LANE_X - 5.4, -3.3, 0x929185, 0);
  van(root, -5.8, -25, 0x747c70, 1);
  constructionTruck(root, DRIVE_LANE_X - 3.1, -44);
  van(root, 1.4, -83, 0x707b77, 3);
  van(root, -5.3, -137, 0x9e9785, 4);
  const checkpoints = group(root, "checkpoints");
  for (let i = 0; i < 4; i++) {
    const marker = group(checkpoints, `checkpoint-${i}`);
    marker.position.set(
      DRIVE_LANE_X + roadOffset(22 + i * 54),
      0,
      -22 - i * 54,
    );
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
  bendDistrict(root);
  return root;
}
