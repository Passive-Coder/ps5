import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export async function loadWasmModel(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Model returned ${response.status}: ${url}`);
  const { instance } = await WebAssembly.instantiateStreaming(response);
  const { memory, model_ptr, model_size } = instance.exports;
  const bytes = memory.buffer.slice(model_ptr(), model_ptr() + model_size());
  const decoder = new DRACOLoader().setDecoderPath("/draco/").setWorkerLimit(2);
  try {
    return (
      await new GLTFLoader()
        .setDRACOLoader(decoder)
        .parseAsync(bytes, "/assets/")
    ).scene;
  } finally {
    decoder.dispose();
  }
}
