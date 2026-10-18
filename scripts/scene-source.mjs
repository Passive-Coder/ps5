import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildConsole, buildController } from './console-models.mjs';

const white = new T.MeshStandardMaterial({ color: 0xe9e7df, roughness: .36 });
const interior = new T.MeshStandardMaterial({ color: 0xd8d6cd, roughness: .8 });
const black = new T.MeshStandardMaterial({ color: 0x080a0d, roughness: .28, metalness: .25 });
const screen = new T.MeshBasicMaterial({ color: 0x030405 });
const silver = new T.MeshStandardMaterial({ color: 0x7c8289, metalness: .85, roughness: .24 });
const mat = (color, roughness = .8) => new T.MeshStandardMaterial({ color, roughness });

function box(root, name, size, at, material, radius = .015) {
  const mesh = new T.Mesh(new RoundedBoxGeometry(...size, 2, radius), material);
  mesh.name = name; mesh.position.set(...at); root.add(mesh); return mesh;
}
function plane(root, name, width, height, at, material) {
  const mesh = new T.Mesh(new T.PlaneGeometry(width, height), material);
  mesh.name = name; mesh.position.set(...at); root.add(mesh); return mesh;
}
function group(root, name) { const g = new T.Group(); g.name = name; root.add(g); return g; }

function bake(root) {
  root.updateMatrixWorld(true);
  const batches = new Map(), retained = [];
  const inverse = root.matrixWorld.clone().invert();
  root.traverse(object => {
    if (!object.isMesh && !object.isLine) return;
    const transform = new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    if (['Power button', 'console-light', 'playstation-mark'].includes(object.name)) {
      const copy = object.clone(); transform.decompose(copy.position, copy.quaternion, copy.scale);
      retained.push(copy); return;
    }
    let geometry;
    if (object.isLine) {
      const attr = object.geometry.attributes.position;
      const points = Array.from({length: attr.count}, (_, i) => new T.Vector3().fromBufferAttribute(attr, i));
      geometry = new T.TubeGeometry(new T.CatmullRomCurve3(points, true), 32, .0025, 5, true);
    } else geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(transform);
    geometry.deleteAttribute('uv'); geometry.deleteAttribute('color');
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const material = object.isLine ? silver : object.material;
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  });
  root.clear();
  for (const [material, geometries] of batches) {
    const mesh = new T.Mesh(mergeGeometries(geometries), material);
    mesh.name = `${root.name}-body`; root.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  root.add(...retained);
  return root;
}

export function createRoom() {
  const root = new T.Group(); root.name = 'room';
  const room = group(root, 'architecture');
  plane(room, 'wall', 80, 45, [0, 13, -1.75], mat(0xc7c4b9));
  const floor = plane(room, 'floor', 80, 60, [0, -.05, 7], mat(0x9a8c78, .75));
  floor.rotation.x = -Math.PI / 2;
  box(room, 'skirting', [80, .20, .12], [0, .10, -1.65], white);
  for (let i = -20; i <= 20; i++) box(room, 'floor-joint', [.012, .002, 40], [i * 1.6, -.045, 5], mat(0x665c50));

  const cabinet = group(root, 'cabinet');
  box(cabinet, 'worktop', [17.6, .26, 3.05], [0, 3.95, .02], white, .025);
  box(cabinet, 'bottom', [17.3, .18, 2.80], [0, .38, -.05], white);
  box(cabinet, 'cabinet-back', [17.3, 3.5, .14], [0, 2.1, -1.30], interior);
  for (const x of [-8.57, -2.85, 2.85, 8.57]) box(cabinet, 'cabinet-side', [.16, 3.48, 2.8], [x, 2.13, -.05], white);
  for (const side of [-1, 1]) {
    box(cabinet, 'cabinet-door', [5.52, 3.36, .17], [side * 5.72, 2.11, 1.36], white, .012);
    box(cabinet, 'cabinet-handle', [.55, .10, .25], [side * 5.72, 3.70, 1.49], white);
    box(cabinet, 'cabinet-foot', [5.1, .25, 2.1], [side * 5.72, .17, -.1], interior);
  }
  box(cabinet, 'center-shelf', [5.6, .16, 2.7], [0, 1.95, -.02], white);
  // The lower compartment retains the small dock seen in the room reference.
  box(cabinet, 'handheld-dock', [2.2, .45, .60], [.1, .68, .65], black, .05);
  box(cabinet, 'handheld', [2.4, 1.0, .16], [.1, 1.0, .62], mat(0x303438), .1);
  box(cabinet, 'handheld-screen', [1.63, .80, .018], [.1, 1.02, .72], screen, .018);

  const console = bake(buildConsole('original'));
  console.name = 'ps5'; console.position.set(-7.25, 6.03, .25); console.rotation.y = -.28;
  console.getObjectByName('Power button').name = 'power-button';
  root.add(console);

  const television = group(root, 'television');
  box(television, 'tv-body', [11.96, 6.84, .26], [0, 8.38, -.65], black, .055);
  box(television, 'tv-inner-bezel', [11.77, 6.64, .035], [0, 8.38, -.49], mat(0x15171a, .4), .012);
  plane(television, 'tv-screen', 11.59, 6.5194, [0, 8.40, -.462], screen);
  for (const side of [-1, 1]) {
    const leg = box(television, 'tv-leg', [.07, .76, .09], [side * 4.95, 4.62, -.30], silver);
    leg.rotation.z = side * -.43; leg.rotation.x = -.35;
    box(television, 'tv-foot', [.78, .055, .26], [side * 5.12, 4.15, -.16], black);
  }
  box(television, 'tv-bottom-badge', [.26, .045, .012], [5.45, 5.04, -.49], silver, .001);
  box(television, 'soundbar', [8.20, .63, .53], [0, 4.40, .14], black, .06);
  for (const x of [-3.47, 3.47]) {
    const speaker = new T.Mesh(new T.CylinderGeometry(.24, .24, .014, 48), mat(0x15171b));
    speaker.rotation.x = Math.PI / 2; speaker.position.set(x, 4.40, .42); television.add(speaker);
    const ring = new T.Mesh(new T.TorusGeometry(.25, .008, 6, 48), silver);
    ring.position.set(x, 4.4, .43); television.add(ring);
  }

  const controller = bake(buildController()); controller.name = 'controller';
  controller.position.set(7.3, 4.76, .65); controller.rotation.set(-.13, -.12, -.025); root.add(controller);

  const game = group(root, 'game-case'); game.position.set(-.75, 2.91, 1.22); game.rotation.x = -.08;
  const blue = mat(0x154582, .3);
  box(game, 'case-plastic', [1.60, 1.91, .15], [0, 0, 0], blue, .045);
  plane(game, 'case-art', 1.47, 1.78, [0, 0, .083], white);
  const disc = group(root, 'disc'); disc.position.set(-.75, 2.91, 1.23);
  const edge = new T.Mesh(new T.CylinderGeometry(.60, .60, .018, 96), silver);
  edge.rotation.x = Math.PI / 2; edge.name = 'disc-edge'; disc.add(edge);
  const face = new T.Mesh(new T.RingGeometry(.095, .60, 96), silver);
  face.position.z = .011; face.name = 'disc-art'; disc.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -.011; back.name = 'disc-back'; disc.add(back);
  const hub = new T.Mesh(new T.RingGeometry(.052, .096, 48), mat(0x8b939b, .12)); hub.position.z = .012; disc.add(hub);

  const lightMaterial = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const halos=[...[-5.65,5.65].flatMap(x=>[10.6,8.4,6.2].map(y=>[x,y,6,4.8])),...[11.7,5.0].flatMap(y=>[-4,0,4].map(x=>[x,y,6.7,5]))];
  halos.forEach(([x,y,width,height],index)=>plane(root,`ambilight-${index}`,width,height,[x,y,-1.69],lightMaterial.clone()));
  return root;
}
