import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const material = (name, color, roughness = 0.8, metalness = 0.05) => {
  const m = new T.MeshStandardMaterial({ color, roughness, metalness });
  m.name = name;
  return m;
};
export function group(parent, name) {
  const g = new T.Group();
  g.name = name;
  parent.add(g);
  return g;
}
export function mesh(parent, name, geo, mat, at = [0, 0, 0]) {
  const m = new T.Mesh(geo, mat);
  m.name = name;
  m.position.set(...at);
  parent.add(m);
  return m;
}
export function box(parent, name, size, at, mat, round = 0) {
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
export function cylinder(parent, name, r1, r2, h, at, mat, segments = 12) {
  return mesh(
    parent,
    name,
    new T.CylinderGeometry(r1, r2, h, segments),
    mat,
    at,
  );
}
export function rod(parent, a, b, r, mat, name = "pipe") {
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
export function patch(parent, name, vertices, mat) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices.flat(), 3));
  g.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return mesh(parent, name, g, mat);
}
// Bake static detail into material batches. Named moving parts and sign faces stay separate.
export function bake(g) {
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
    if (
      /^(concrete-|asphalt|pavement|cladding|painted-steel)/.test(
        o.material.name,
      )
    ) {
      const p = geo.attributes.position,
        n = geo.attributes.normal,
        uv = geo.attributes.uv;
      const scale = o.material.name.startsWith("asphalt") ? 3 : 2;
      for (let i = 0; i < p.count; i++) {
        const x = Math.abs(n.getX(i)),
          y = Math.abs(n.getY(i)),
          z = Math.abs(n.getZ(i));
        uv.setXY(
          i,
          (y > x && y > z ? p.getX(i) : x > z ? p.getZ(i) : p.getX(i)) / scale,
          (y > x && y > z ? p.getZ(i) : p.getY(i)) / scale,
        );
      }
    }
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
