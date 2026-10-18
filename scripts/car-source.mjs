import * as T from "three";
import {
  material,
  group,
  mesh,
  box,
  cylinder,
  rod,
  bake,
} from "./geometry.mjs";

const paint = material("car-paint", 0x087f89, 0.24, 0.65);
const pearl = material("car-pearl", 0xd7d8c9, 0.22, 0.48);
const navy = material("car-lower-paint", 0x073947, 0.3, 0.54);
const black = material("car-carbon", 0x0c1418, 0.43, 0.35);
const glass = material("car-glass", 0x10282b, 0.12, 0.75);
const rubber = material("rubber", 0x131515, 0.92, 0);
const gold = material("wheel-alloy", 0xa69b79, 0.27, 0.85);
const metal = material("car-machined-metal", 0x6e7b7b, 0.24, 0.85);
const red = material("tail-light", 0xc71721, 0.2, 0.22);
const led = material("car-headlight", 0xd9edee, 0.18, 0.3);
const yellow = material("car-gold-trim", 0xb1a86d, 0.3, 0.7);

function surface(parent, name, fn, uCount, vCount, mat, flip = true) {
  const p = [],
    uv = [],
    indices = [];
  for (let j = 0; j <= vCount; j++)
    for (let i = 0; i <= uCount; i++) {
      p.push(...fn(i / uCount, j / vCount));
      uv.push(i / uCount, j / vCount);
      if (i < uCount && j < vCount) {
        const k = j * (uCount + 1) + i;
        const quad = [
          k,
          k + 1,
          k + uCount + 1,
          k + 1,
          k + uCount + 2,
          k + uCount + 1,
        ];
        indices.push(...(flip ? quad.reverse() : quad));
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return mesh(parent, name, g, mat);
}
function curve(parent, name, points, radius, mat) {
  const path = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  return mesh(
    parent,
    name,
    new T.TubeGeometry(path, Math.max(24, points.length * 8), radius, 8, false),
    mat,
  );
}
const sections = [
  [-2.52, 0.84, 0.66, 0.69],
  [-2.36, 1.02, 0.78, 0.83],
  [-1.9, 1.1, 0.9, 1.02],
  [-1.5, 1.12, 0.94, 1.06],
  [-1.0, 1.05, 0.97, 0.96],
  [-0.4, 1.025, 1.0, 0.91],
  [0.3, 1.06, 1.01, 0.94],
  [1.0, 1.14, 1.0, 1.05],
  [1.55, 1.18, 0.99, 1.1],
  [2.05, 1.17, 0.99, 1.06],
  [2.39, 1.05, 0.93, 0.98],
  [2.53, 0.91, 0.8, 0.82],
];
function section(z) {
  let i = 0;
  while (i < sections.length - 2 && z > sections[i + 1][0]) i++;
  const a = sections[i],
    b = sections[i + 1],
    t = T.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1),
    s = t * t * (3 - 2 * t);
  return [
    T.MathUtils.lerp(a[1], b[1], s),
    T.MathUtils.lerp(a[2], b[2], s),
    T.MathUtils.lerp(a[3], b[3], s),
  ];
}
function bodyTop(x, z) {
  const [w, c, edge] = section(z),
    t = Math.abs(x);
  return c + (edge - c) * Math.pow(t, 1.8) + 0.035 * Math.sin(t * Math.PI);
}
function canopy(x, t) {
  const z = -1.2 + t * 2.25;
  const dome = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.65);
  const width = 0.79 + 0.055 * Math.sin(t * Math.PI);
  return [
    x * width,
    bodyTop(x * 0.73, z) +
      0.35 * dome * Math.pow(Math.max(0, 1 - x * x), 0.38) +
      0.015,
    z,
  ];
}
export function buildCar(parent) {
  const car = group(parent, "player-car");
  // Smooth shoulder surfaces and cut wheel wells are built as actual shell geometry.
  for (const [start, end, mat] of [
    [-2.52, -0.82, pearl],
    [-0.82, 2.53, paint],
  ]) {
    surface(
      car,
      "sculpted-upper-shell",
      (u, v) => {
        const z = start + (end - start) * v,
          x = u * 2 - 1;
        return [x * section(z)[0], bodyTop(x, z), z];
      },
      60,
      100,
      mat,
    );
    for (const side of [-1, 1])
      surface(
        car,
        "sculpted-side-shell",
        (u, v) => {
          const z = start + (end - start) * u,
            [w] = section(z),
            arch = Math.max(
              ...[-1.61, 1.55].map((a) =>
                Math.abs(z - a) < 0.52
                  ? 0.43 + Math.sqrt(0.52 * 0.52 - (z - a) ** 2)
                  : 0.29,
              ),
            );
          const low = Math.max(0.3, arch),
            high = bodyTop(1, z);
          const y = low + (high - low) * v;
          return [
            side * (w - 0.055 * Math.sin(v * Math.PI) - 0.05 * (1 - v)),
            y,
            z,
          ];
        },
        130,
        12,
        mat,
        side > 0,
      );
  }
  surface(car, "crystal-canopy", (u, v) => canopy(u * 2 - 1, v), 56, 64, glass);
  // Painted roof spine and curved pillars frame the dark panoramic canopy.
  surface(
    car,
    "roof-spine",
    (u, v) => {
      const p = canopy((u * 2 - 1) * 0.49, 0.29 + v * 0.37);
      p[1] += 0.014;
      return p;
    },
    28,
    32,
    paint,
  );
  for (const side of [-1, 1])
    curve(
      car,
      "canopy-pillar",
      Array.from({ length: 18 }, (_, i) => canopy(side * 0.97, i / 17)),
      0.025,
      paint,
    );
  surface(
    car,
    "rear-engine-glass",
    (u, v) => {
      const z = 0.76 + v * 1.15,
        x = (u * 2 - 1) * 0.67;
      return [x, bodyTop(x / section(z)[0], z) + 0.025, z];
    },
    24,
    28,
    black,
  );
  for (let i = 0; i < 12; i++) {
    const z = 0.85 + i * 0.079;
    const w = 0.61 - 0.06 * Math.sin((i / 11) * Math.PI);
    curve(
      car,
      "engine-louvre",
      [
        [-w, 1.047, z],
        [-0.3, 1.06, z],
        [0.3, 1.06, z],
        [w, 1.047, z],
      ],
      0.012,
      metal,
    );
  }
  for (const side of [-1, 1]) {
    curve(
      car,
      "engine-rail",
      [
        [side * 0.67, 1.043, 0.77],
        [side * 0.7, 1.052, 1.3],
        [side * 0.74, 1.013, 1.93],
      ],
      0.023,
      paint,
    );
    curve(
      car,
      "door-shut-line",
      [
        [side * 1.052, 0.94, -0.85],
        [side * 1.04, 0.63, -0.65],
        [side * 1.04, 0.37, -0.4],
        [side * 1.08, 0.37, 0.93],
        [side * 1.15, 0.7, 1.04],
      ],
      0.005,
      black,
    );
    box(
      car,
      "flush-door-handle",
      [0.016, 0.023, 0.18],
      [side * 1.047, 0.85, 0.1],
      metal,
      0.006,
    );
    const sill = box(
      car,
      "deep-side-skirt",
      [0.11, 0.14, 2.19],
      [side * 1.04, 0.29, 0.03],
      navy,
      0.045,
    );
    curve(
      car,
      "mirror-stalk",
      [
        [side * 0.89, 1.02, -0.73],
        [side * 1.14, 1.06, -0.91],
      ],
      0.018,
      black,
    );
    box(
      car,
      "aero-mirror",
      [0.24, 0.09, 0.31],
      [side * 1.17, 1.07, -0.91],
      pearl,
      0.045,
    );
    box(
      car,
      "mirror-glass",
      [0.19, 0.052, 0.012],
      [side * 1.17, 1.08, -0.754],
      metal,
      0.02,
    );
    surface(
      car,
      "side-air-intake",
      (u, v) => [side * (1.08 + u * 0.06), 0.38 + v * 0.22, 0.62 + u * 0.39],
      10,
      10,
      black,
      side > 0,
    );
    for (let k = 0; k < 4; k++)
      rod(
        car,
        [side * 1.12, 0.41 + k * 0.04, 0.69],
        [side * 1.15, 0.43 + k * 0.04, 0.94],
        0.009,
        navy,
      );
  }
  // Broad curved tail, inset diffuser, and thin light strips follow the reference silhouette.
  surface(
    car,
    "rounded-tail",
    (u, v) => {
      const x = u * 2 - 1;
      return [
        x * (1.07 - 0.06 * Math.cos(v * Math.PI)),
        0.37 + v * 0.58,
        2.36 +
          0.16 * Math.sqrt(Math.max(0, 1 - x * x)) -
          0.065 * Math.sin(v * Math.PI),
      ];
    },
    64,
    22,
    paint,
    false,
  );
  surface(
    car,
    "rear-diffuser",
    (u, v) => {
      const x = u * 2 - 1;
      return [x * 0.99, 0.25 + v * 0.3, 2.39 + 0.11 * (1 - x * x)];
    },
    48,
    14,
    black,
    false,
  );
  surface(
    car,
    "rear-grille",
    (u, v) => {
      const x = u * 2 - 1;
      return [x * 0.72, 0.62 + v * 0.16, 2.526 - 0.045 * x * x];
    },
    32,
    8,
    black,
    false,
  );
  for (let i = -15; i <= 15; i++)
    rod(car, [i * 0.043, 0.63, 2.535], [i * 0.043, 0.77, 2.535], 0.006, metal);
  for (const side of [-1, 1]) {
    curve(
      car,
      "sculpted-tail-light",
      [
        [side * 0.22, 0.82, 2.527],
        [side * 0.49, 0.82, 2.513],
        [side * 0.73, 0.85, 2.486],
        [side * 0.96, 0.9, 2.425],
        [side * 1.045, 0.88, 2.35],
      ],
      0.019,
      red,
    );
    curve(
      car,
      "tail-light-return",
      [
        [side * 0.68, 0.823, 2.494],
        [side * 0.81, 0.805, 2.475],
        [side * 0.92, 0.833, 2.445],
      ],
      0.012,
      red,
    );
    curve(
      car,
      "headlight-strip",
      [
        [side * 0.45, 0.753, -2.48],
        [side * 0.74, 0.771, -2.45],
        [side * 0.96, 0.81, -2.3],
      ],
      0.015,
      led,
    );
    const pipe = cylinder(
      car,
      "exhaust",
      0.064,
      0.064,
      0.16,
      [side * 0.7, 0.37, 2.48],
      black,
      24,
    );
    pipe.rotation.x = Math.PI / 2;
  }
  curve(
    car,
    "rear-gold-belt",
    [
      [-1.02, 0.56, 2.42],
      [-0.72, 0.555, 2.51],
      [0, 0.55, 2.544],
      [0.72, 0.555, 2.51],
      [1.02, 0.56, 2.42],
    ],
    0.018,
    yellow,
  );
  for (let i = -3; i <= 3; i++)
    box(
      car,
      "diffuser-fin",
      [0.025, 0.12, 0.34],
      [i * 0.23, 0.29, 2.37],
      black,
      0.005,
    );
  const plate = box(
    car,
    "plate-frame",
    [0.36, 0.16, 0.025],
    [0, 0.47, 2.53],
    metal,
    0.015,
  );
  box(
    car,
    "license-plate",
    [0.3, 0.105, 0.008],
    [0, 0.47, 2.549],
    black,
    0.005,
  );
  box(car, "rear-emblem", [0.08, 0.038, 0.012], [0, 0.735, 2.55], metal, 0.008);
  surface(
    car,
    "front-bumper",
    (u, v) => {
      const x = u * 2 - 1;
      return [
        x * (0.91 + v * 0.02),
        0.3 + v * 0.37,
        -2.51 - 0.035 * (1 - x * x),
      ];
    },
    48,
    16,
    pearl,
  );
  box(car, "front-intake", [1.35, 0.16, 0.06], [0, 0.42, -2.56], black, 0.04);
  bake(car);
  for (const side of [-1, 1])
    for (const z of [-1.61, 1.55]) {
      const wheel = group(car, `wheel-${side}-${z}`);
      wheel.position.set(side * 1.04, 0.43, z);
      // Rounded low-profile tyres have tread grooves and recessed turbine wheels.
      const tyre = mesh(
        wheel,
        "tyre",
        new T.TorusGeometry(0.342, 0.088, 16, 64),
        rubber,
      );
      tyre.rotation.y = Math.PI / 2;
      const tread = cylinder(
        wheel,
        "tread",
        0.421,
        0.421,
        0.18,
        [0, 0, 0],
        rubber,
        64,
      );
      tread.rotation.z = Math.PI / 2;
      for (const x of [-0.067, 0.0, 0.067]) {
        const groove = mesh(
          wheel,
          "tread-groove",
          new T.TorusGeometry(0.421, 0.003, 4, 64),
          black,
          [x, 0, 0],
        );
        groove.rotation.y = Math.PI / 2;
      }
      const disc = cylinder(
        wheel,
        "brake-disc",
        0.285,
        0.285,
        0.11,
        [0, 0, 0],
        metal,
        48,
      );
      disc.rotation.z = Math.PI / 2;
      const outer = mesh(
        wheel,
        "forged-wheel-lip",
        new T.TorusGeometry(0.331, 0.018, 8, 64),
        gold,
        [side * 0.112, 0, 0],
      );
      outer.rotation.y = Math.PI / 2;
      const inner = mesh(
        wheel,
        "wheel-shadow",
        new T.TorusGeometry(0.298, 0.029, 8, 64),
        black,
        [side * 0.095, 0, 0],
      );
      inner.rotation.y = Math.PI / 2;
      for (let j = 0; j < 20; j++) {
        const a = (j / 20) * Math.PI * 2;
        const spoke = box(
          wheel,
          "turbine-spoke",
          [0.045, 0.245, 0.027],
          [side * 0.117, Math.sin(a) * 0.17, Math.cos(a) * 0.17],
          gold,
          0.007,
        );
        spoke.rotation.x = -a + Math.PI / 2 + 0.2;
      }
      const hub = cylinder(
        wheel,
        "hub",
        0.062,
        0.062,
        0.05,
        [side * 0.138, 0, 0],
        gold,
        24,
      );
      hub.rotation.z = Math.PI / 2;
      bake(wheel);
    }
  return car;
}
