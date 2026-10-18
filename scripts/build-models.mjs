import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import { createRoom } from './scene-source.mjs';

// Texture artwork is attached by the browser; this build exports geometry only.
global.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {} }) }) };
const source = createRoom();
const document = new Document(), buffer = document.createBuffer();
const unlit = document.createExtension(KHRMaterialsUnlit);
const scene = document.createScene('PlayStation room');
const materialCache = new Map();
let meshCount = 0;
function convert(object) {
  const node = document.createNode(object.name || 'part').setTranslation(object.position.toArray()).setRotation(object.quaternion.toArray()).setScale(object.scale.toArray());
  if (object.isMesh) {
    const geometry = object.geometry;
    if (!materialCache.has(object.material)) {
      const source = object.material;
      const material = document.createMaterial(source.name || `surface-${materialCache.size}`)
        .setBaseColorFactor([...(source.color?.toArray() || [1, 1, 1]), source.opacity ?? 1])
        .setMetallicFactor(source.metalness || 0).setRoughnessFactor(source.roughness ?? .5)
        .setDoubleSided(source.side === 2);
      if (source.transparent) material.setAlphaMode('BLEND');
      if (source.isMeshBasicMaterial) material.setExtension('KHR_materials_unlit', unlit.createUnlit());
      materialCache.set(source, material);
    }
    const primitive = document.createPrimitive().setMaterial(materialCache.get(object.material));
    for (const [name, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
      const attribute = geometry.attributes[name];
      if (attribute) primitive.setAttribute(semantic, document.createAccessor().setType(`VEC${attribute.itemSize}`).setArray(attribute.array.slice()).setBuffer(buffer));
    }
    const indices = geometry.index ? geometry.index.array.slice() : Uint32Array.from({length: geometry.attributes.position.count}, (_, i) => i);
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    node.setMesh(document.createMesh(object.name).addPrimitive(primitive)); meshCount++;
  }
  for (const child of object.children) node.addChild(convert(child));
  return node;
}
scene.addChild(convert(source));
document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5, quantizationBits: { POSITION: 16, NORMAL: 10, TEXCOORD: 12 } });
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression, KHRMaterialsUnlit]).registerDependencies({
  'draco3d.encoder': await draco.createEncoderModule(), 'draco3d.decoder': await draco.createDecoderModule(),
});
const glb = await io.writeBinary(document);
const jsonSize=new DataView(glb.buffer,glb.byteOffset).getUint32(12,true);
const manifest=JSON.parse(new TextDecoder().decode(glb.subarray(20,20+jsonSize)));
if(!manifest.meshes.every(mesh=>mesh.primitives.every(primitive=>primitive.extensions?.KHR_draco_mesh_compression)))throw new Error('Every scene mesh must use the WebAssembly Draco decoder');

function uleb(value) { const bytes = []; do { let byte = value & 127; value >>>= 7; if (value) byte |= 128; bytes.push(byte); } while (value); return bytes; }
function sleb(value) { const bytes = []; for (;;) { let byte = value & 127; value >>= 7; const done = (value === 0 && !(byte & 64)) || (value === -1 && (byte & 64)); bytes.push(done ? byte : byte | 128); if (done) return bytes; } }
const name = text => { const b = new TextEncoder().encode(text); return [...uleb(b.length), ...b]; };
const section = (id, bytes) => new Uint8Array([id, ...uleb(bytes.length), ...bytes]);
const functionBody = value => { const b = [0, 0x41, ...sleb(value), 0x0b]; return [...uleb(b.length), ...b]; };
const chunks = [new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
  section(1, [1, 0x60, 0, 1, 0x7f]), section(3, [2, 0, 0]),
  section(5, [1, 0, ...uleb(Math.ceil(glb.length / 65536))]),
  section(7, [3, ...name('memory'), 2, 0, ...name('model_ptr'), 0, 0, ...name('model_size'), 0, 1]),
  section(10, [2, ...functionBody(0), ...functionBody(glb.length)]),
];
// Keep large payloads as typed arrays instead of expanding them onto the JS stack.
const prefix = new Uint8Array([1, 0, 0x41, 0, 0x0b, ...uleb(glb.length)]);
chunks.push(new Uint8Array([11, ...uleb(prefix.length + glb.length)]), prefix, glb);
const wasm = new Uint8Array(chunks.reduce((n, b) => n + b.length, 0));
let offset = 0; for (const chunk of chunks) { wasm.set(chunk, offset); offset += chunk.length; }
const { instance } = await WebAssembly.instantiate(wasm);
if (instance.exports.model_size() !== glb.length) throw new Error('WASM asset validation failed');
await mkdir('public/assets', { recursive: true });
await mkdir('public/draco', { recursive: true });
await writeFile('public/assets/room.wasm', wasm);
for (const file of ['draco_wasm_wrapper.js', 'draco_decoder.wasm']) await copyFile(`node_modules/three/examples/jsm/libs/draco/gltf/${file}`, `public/draco/${file}`);
console.log(`Built ${meshCount} compressed meshes in room.wasm (${(wasm.length / 1024).toFixed(0)} kB).`);
