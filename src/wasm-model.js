import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as T from "three";

async function loadCompiledScene(asset, decoder) {
  const bytes = new Uint8Array(asset.asset_size());
  for (let i = 0; i < bytes.length; i++) bytes[i] = asset.asset_read(i);
  const length = new DataView(bytes.buffer).getUint32(0, true);
  const records = JSON.parse(
    new TextDecoder().decode(bytes.subarray(4, 4 + length)),
  );
  const dataStart = 4 + length;
  const surfaces = records.surfaces.map((s) => {
    const color = new T.Color().fromArray(s.color || [1, 1, 1]);
    const m = s.unlit
      ? new T.MeshBasicMaterial({ color })
      : new T.MeshStandardMaterial({
          color,
          metalness: s.metal ?? 0,
          roughness: s.rough ?? 0.5,
        });
    m.name = s.label;
    if (s.bothSides) m.side = T.DoubleSide;
    return m;
  });
  const shapes = await Promise.all(
    records.shapes.map(async (shape) =>
      Promise.all(
        shape.map(async (p) => {
          const channels = {},
            types = {};
          for (const [semantic, name] of [
            ["POSITION", "position"],
            ["NORMAL", "normal"],
            ["TEXCOORD_0", "uv"],
          ])
            if (p.channels[semantic] !== undefined) {
              channels[name] = p.channels[semantic];
              types[name] = "Float32Array";
            }
          const buffer = bytes.buffer.slice(
            dataStart + p.start,
            dataStart + p.start + p.length,
          );
          const geometry = await decoder.decodeGeometry(buffer, {
            attributeIDs: channels,
            attributeTypes: types,
            useUniqueIDs: true,
          });
          return { geometry, material: surfaces[p.surface] };
        }),
      ),
    ),
  );
  const parts = records.parts.map((p) => {
    const shape = shapes[p.shape];
    const object =
      shape?.length === 1
        ? new T.Mesh(shape[0].geometry, shape[0].material)
        : new T.Group();
    if (shape?.length > 1)
      for (const s of shape) object.add(new T.Mesh(s.geometry, s.material));
    object.name = p.label || "part";
    if (p.at) object.position.fromArray(p.at);
    if (p.rotation) object.quaternion.fromArray(p.rotation);
    if (p.scale) object.scale.fromArray(p.scale);
    return object;
  });
  records.parts.forEach((p, i) => {
    for (const child of p.children || []) parts[i].add(parts[child]);
  });
  const root = new T.Group();
  root.add(...records.roots.map((i) => parts[i]));
  return root;
}

export async function loadWasmModel(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Model returned ${response.status}: ${url}`);
  const { instance } = await WebAssembly.instantiateStreaming(response);
  const decoder = new DRACOLoader().setDecoderPath("/draco/").setWorkerLimit(2);
  try {
    if (instance.exports.asset_format?.() === 2)
      return await loadCompiledScene(instance.exports, decoder);
    const { memory, model_ptr, model_size } = instance.exports;
    const bytes = memory.buffer.slice(model_ptr(), model_ptr() + model_size());
    const gltf = await new GLTFLoader()
      .setDRACOLoader(decoder)
      .parseAsync(bytes, "/assets/");
    gltf.scene.userData.animationClips = gltf.animations;
    return gltf.scene;
  } finally {
    decoder.dispose();
  }
}
