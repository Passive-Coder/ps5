import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import {
  KHRDracoMeshCompression,
  KHRMaterialsUnlit,
  KHRMaterialsSpecular,
} from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { createRoom } from "./scene-source.mjs";
import { createCity } from "./city-source.mjs";
import { buildCar } from "./car-source.mjs";

// Texture artwork is attached by the browser; this build exports geometry only.
global.document = {
  createElement: () => ({
    getContext: () => new Proxy({}, { get: () => () => {} }),
  }),
};
async function exportModel(source, filename) {
  const io = new NodeIO()
    .registerExtensions([
      KHRDracoMeshCompression,
      KHRMaterialsUnlit,
      KHRMaterialsSpecular,
    ])
    .registerDependencies({
      "draco3d.encoder": await draco.createEncoderModule(),
      "draco3d.decoder": await draco.createDecoderModule(),
    });
  const imported = typeof source === "string";
  const document = imported ? await io.read(source) : new Document(),
    buffer = imported
      ? document.getRoot().listBuffers()[0]
      : document.createBuffer();
  const unlit = document.createExtension(KHRMaterialsUnlit);
  const scene = imported ? null : document.createScene(source.name);
  if (imported) {
    // Voice-avatar facial morphs are unused by this street scene.
    for (const mesh of document.getRoot().listMeshes()) {
      mesh.setWeights([]);
      for (const primitive of mesh.listPrimitives())
        for (const target of primitive.listTargets()) {
          primitive.removeTarget(target);
          target.dispose();
        }
    }
    for (const node of document.getRoot().listNodes()) node.setWeights([]);
    for (const accessor of document.getRoot().listAccessors())
      if (
        accessor.listParents().every((parent) => parent === document.getRoot())
      )
        accessor.dispose();
  }
  const materialCache = new Map();
  let meshCount = 0;
  function convert(object) {
    const node = document
      .createNode(object.name || "part")
      .setTranslation(object.position.toArray())
      .setRotation(object.quaternion.toArray())
      .setScale(object.scale.toArray());
    if (object.isMesh) {
      const geometry = object.geometry;
      if (!materialCache.has(object.material)) {
        const source = object.material;
        const material = document
          .createMaterial(source.name || `surface-${materialCache.size}`)
          .setBaseColorFactor([
            ...(source.color?.toArray() || [1, 1, 1]),
            source.opacity ?? 1,
          ])
          .setMetallicFactor(source.metalness || 0)
          .setRoughnessFactor(source.roughness ?? 0.5)
          .setDoubleSided(source.side === 2);
        if (source.transparent) material.setAlphaMode("BLEND");
        if (source.isMeshBasicMaterial)
          material.setExtension("KHR_materials_unlit", unlit.createUnlit());
        materialCache.set(source, material);
      }
      const primitive = document
        .createPrimitive()
        .setMaterial(materialCache.get(object.material));
      for (const [name, semantic] of [
        ["position", "POSITION"],
        ["normal", "NORMAL"],
        ["uv", "TEXCOORD_0"],
      ]) {
        const attribute = geometry.attributes[name];
        if (attribute)
          primitive.setAttribute(
            semantic,
            document
              .createAccessor()
              .setType(`VEC${attribute.itemSize}`)
              .setArray(attribute.array.slice())
              .setBuffer(buffer),
          );
      }
      const indices = geometry.index
        ? geometry.index.array.slice()
        : Uint32Array.from(
            { length: geometry.attributes.position.count },
            (_, i) => i,
          );
      primitive.setIndices(
        document
          .createAccessor()
          .setType("SCALAR")
          .setArray(indices)
          .setBuffer(buffer),
      );
      node.setMesh(document.createMesh(object.name).addPrimitive(primitive));
      meshCount++;
    }
    for (const child of object.children) node.addChild(convert(child));
    return node;
  }
  if (imported) meshCount = document.getRoot().listMeshes().length;
  else scene.addChild(convert(source));
  document
    .createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 5,
      decodeSpeed: 5,
      quantizationBits: {
        POSITION: 16,
        NORMAL: filename === "city" ? 12 : 10,
        TEXCOORD: filename === "city" ? 16 : 12,
      },
    });
  const glb = await io.writeBinary(document);
  const jsonSize = new DataView(glb.buffer, glb.byteOffset).getUint32(12, true);
  const manifest = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonSize)),
  );
  if (
    !manifest.meshes.every((mesh) =>
      mesh.primitives.every(
        (primitive) => primitive.extensions?.KHR_draco_mesh_compression,
      ),
    )
  )
    throw new Error("Every scene mesh must use the WebAssembly Draco decoder");

  let payload = glb;
  const compiledCity = filename === "city";
  if (compiledCity) {
    // A closed scene package, not an embedded GLB or a standalone vehicle file.
    // Only the application's renderer consumes the compiled scene records.
    const dataStart = 20 + jsonSize + 8;
    const binary = glb.subarray(
      dataStart,
      dataStart + manifest.buffers[0].byteLength,
    );
    const records = {
      surfaces: manifest.materials.map((m) => ({
        label: m.name,
        color: m.pbrMetallicRoughness?.baseColorFactor,
        metal: m.pbrMetallicRoughness?.metallicFactor,
        rough: m.pbrMetallicRoughness?.roughnessFactor,
        bothSides: m.doubleSided,
        unlit: !!m.extensions?.KHR_materials_unlit,
      })),
      shapes: manifest.meshes.map((m) =>
        m.primitives.map((p) => {
          const draco = p.extensions.KHR_draco_mesh_compression;
          const view = manifest.bufferViews[draco.bufferView];
          return {
            start: view.byteOffset || 0,
            length: view.byteLength,
            channels: draco.attributes,
            surface: p.material,
          };
        }),
      ),
      parts: manifest.nodes.map((n) => ({
        label: n.name,
        at: n.translation,
        rotation: n.rotation,
        scale: n.scale,
        shape: n.mesh,
        children: n.children,
      })),
      roots: manifest.scenes[manifest.scene || 0].nodes,
    };
    const header = new TextEncoder().encode(JSON.stringify(records));
    payload = new Uint8Array(4 + header.length + binary.length);
    new DataView(payload.buffer).setUint32(0, header.length, true);
    payload.set(header, 4);
    payload.set(binary, 4 + header.length);
  }

  function uleb(value) {
    const bytes = [];
    do {
      let byte = value & 127;
      value >>>= 7;
      if (value) byte |= 128;
      bytes.push(byte);
    } while (value);
    return bytes;
  }
  function sleb(value) {
    const bytes = [];
    for (;;) {
      let byte = value & 127;
      value >>= 7;
      const done = (value === 0 && !(byte & 64)) || (value === -1 && byte & 64);
      bytes.push(done ? byte : byte | 128);
      if (done) return bytes;
    }
  }
  const name = (text) => {
    const b = new TextEncoder().encode(text);
    return [...uleb(b.length), ...b];
  };
  const section = (id, bytes) =>
    new Uint8Array([id, ...uleb(bytes.length), ...bytes]);
  const functionBody = (value) => {
    const b = [0, 0x41, ...sleb(value), 0x0b];
    return [...uleb(b.length), ...b];
  };
  const chunks = compiledCity
    ? [
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
        section(1, [2, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 1, 0x7f]),
        section(3, [3, 1, 0, 0]),
        section(5, [1, 0, ...uleb(Math.ceil(payload.length / 65536))]),
        section(7, [
          3,
          ...name("asset_read"),
          0,
          0,
          ...name("asset_size"),
          0,
          1,
          ...name("asset_format"),
          0,
          2,
        ]),
        section(10, [
          3,
          ...(() => {
            // Decode individual package bytes within WASM; no raw memory export.
            const b = [
              0,
              0x20,
              0,
              0x2d,
              0,
              0,
              0x20,
              0,
              0x41,
              ...sleb(1103515245),
              0x6c,
              0x41,
              ...sleb(12345),
              0x6a,
              0x41,
              16,
              0x76,
              0x73,
              0x41,
              ...sleb(255),
              0x71,
              0x0b,
            ];
            return [...uleb(b.length), ...b];
          })(),
          ...functionBody(payload.length),
          ...functionBody(2),
        ]),
      ]
    : [
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
        section(1, [1, 0x60, 0, 1, 0x7f]),
        section(3, [2, 0, 0]),
        section(5, [1, 0, ...uleb(Math.ceil(glb.length / 65536))]),
        section(7, [
          3,
          ...name("memory"),
          2,
          0,
          ...name("model_ptr"),
          0,
          0,
          ...name("model_size"),
          0,
          1,
        ]),
        section(10, [2, ...functionBody(0), ...functionBody(glb.length)]),
      ];
  // Keep large payloads as typed arrays instead of expanding them onto the JS stack.
  const stored = payload.slice();
  if (compiledCity)
    for (let i = 0; i < stored.length; i++)
      stored[i] ^= ((Math.imul(i, 1103515245) + 12345) >>> 16) & 255;
  const prefix = new Uint8Array([1, 0, 0x41, 0, 0x0b, ...uleb(stored.length)]);
  chunks.push(
    new Uint8Array([11, ...uleb(prefix.length + stored.length)]),
    prefix,
    stored,
  );
  const wasm = new Uint8Array(chunks.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    wasm.set(chunk, offset);
    offset += chunk.length;
  }
  const { instance } = await WebAssembly.instantiate(wasm);
  if (
    (compiledCity
      ? instance.exports.asset_size()
      : instance.exports.model_size()) !== payload.length
  )
    throw new Error("WASM asset validation failed");
  await mkdir("public/assets", { recursive: true });
  await mkdir("public/draco", { recursive: true });
  await writeFile(`public/assets/${filename}.wasm`, wasm);
  console.log(
    `Built ${meshCount} compressed meshes in ${filename}.wasm (${(wasm.length / 1024).toFixed(0)} kB).`,
  );
}

await exportModel(createRoom(), "room");
await exportModel(createCity(await buildCar()), "city");
await exportModel("scripts/assets/pedestrian.glb", "pedestrian");
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm"])
  await copyFile(
    `node_modules/three/examples/jsm/libs/draco/gltf/${file}`,
    `public/draco/${file}`,
  );
