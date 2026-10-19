import * as T from "three";
import { readFile } from "node:fs/promises";

// Native source is licensed for use inside this application. Keep editable files
// and preparation output in .cache; publish only the compiled city package.
export async function buildCar() {
  const source = JSON.parse(await readFile(".cache/caliburn/car.json", "utf8"));
  const root = new T.Group();
  root.name = "player-car";
  const materials = new Map(
    Object.entries(source.surfaces).map(
      ([name, [color, metalness, roughness]]) => {
        const m = new T.MeshStandardMaterial({ color, metalness, roughness });
        m.name = name;
        return [name, m];
      },
    ),
  );
  const wheels = new Map();
  for (const [name, color, metalness, roughness] of [
    ["car-engine-deck", 0xffffff, 0.45, 0.28],
    ["car-rear-livery", 0xffffff, 0.62, 0.23],
    ["car-numberplate", 0xffffff, 0.1, 0.6],
    ["car-wheel-cover", 0x595a52, 0.93, 0.23],
    ["car-rim-edge", 0xafa58a, 0.95, 0.18],
  ]) {
    const m = new T.MeshStandardMaterial({ color, metalness, roughness });
    m.name = name;
    materials.set(name, m);
  }
  for (const part of source.parts) {
    let parent = root;
    if (part.wheel) {
      if (!wheels.has(part.wheel)) {
        const wheel = new T.Group();
        wheel.name = part.wheel;
        const front = part.wheel.includes("front"),
          right = part.wheel.includes("right");
        wheel.position.set(
          (right ? 1.07 : -1.07) * source.scale,
          (front ? 0.37212 : 0.3903) * source.scale,
          (front ? -1.57404 : 1.6235) * source.scale,
        );
        root.add(wheel);
        wheels.set(part.wheel, wheel);
      }
      parent = wheels.get(part.wheel);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(part.p, 3));
    geometry.setAttribute("normal", new T.Float32BufferAttribute(part.n, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(part.uv, 2));
    let surface = part.surface;
    if (part.name === "Plane.013") surface = "car-engine-deck";
    if (part.name === "Plane.025") surface = "car-rear-livery";
    if (
      [
        "car-engine-deck",
        "car-rear-livery",
        "car-taillight",
        "car-pearl",
      ].includes(surface)
    ) {
      const p = geometry.attributes.position,
        uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        if (surface === "car-engine-deck")
          uv.setXY(i, p.getX(i) / 0.9 + 0.5, (p.getZ(i) - 0.65) / 1.3);
        else if (surface === "car-taillight")
          uv.setXY(i, p.getX(i) / 2.1 + 0.5, (p.getY(i) - 0.71) / 0.11);
        else if (surface === "car-pearl")
          uv.setXY(i, (p.getZ(i) + 2.5) / 5, p.getY(i) / 1.2);
        else uv.setXY(i, p.getX(i) / 2.25 + 0.5, (p.getY(i) - 0.15) / 0.65);
      }
    }
    const mesh = new T.Mesh(geometry, materials.get(surface));
    mesh.name = `caliburn-${part.name}-${part.surface}`;
    parent.add(mesh);
  }
  for (const [name, wheel] of wheels) {
    const side = name.endsWith("right") ? 1 : -1,
      front = name.includes("front");
    const radius = front ? 0.285 : 0.305,
      outer = side * (front ? 0.04 : 0.115);
    const profile = [];
    for (let i = 0; i <= 16; i++) {
      const r = (radius * i) / 16;
      profile.push(new T.Vector2(r, 0.033 * Math.sqrt(1 - (r / radius) ** 2)));
    }
    const disc = new T.Mesh(
      new T.LatheGeometry(profile.reverse(), 64),
      materials.get("car-wheel-cover"),
    );
    disc.rotation.z = (-side * Math.PI) / 2;
    disc.position.x = outer;
    disc.name = "caliburn-polished-wheel-disc";
    wheel.add(disc);
    const rim = new T.Mesh(
      new T.TorusGeometry(radius, 0.012, 8, 64),
      materials.get("car-rim-edge"),
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = outer;
    rim.name = "caliburn-rim-lip";
    wheel.add(rim);
  }
  const plate = new T.Mesh(
    new T.PlaneGeometry(0.33, 0.14),
    materials.get("car-numberplate"),
  );
  plate.position.set(0, 0.47, 2.405);
  plate.name = "caliburn-rear-numberplate";
  root.add(plate);
  return root;
}
