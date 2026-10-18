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
    const mesh = new T.Mesh(geometry, materials.get(part.surface));
    mesh.name = `caliburn-${part.name}-${part.surface}`;
    parent.add(mesh);
  }
  return root;
}
