# ACM–VIT Cyberpunk room

A desktop-only, full-screen scene based on the supplied PS5/TV/cabinet reference. Small screens and devices without a mouse or trackpad receive the computer-only fallback.

## Run

```sh
npm install
npm run dev
```

Press the PS5 power button. Its lights come on, the TV displays the PlayStation and ACM–VIT marks, and the camera pulls back to the room. Hover over the Cyberpunk case in the open cabinet shelf, then click the exposed disc to insert it into the console. The TV launches the animated Cyberpunk home, then the camera moves in so the TV nearly fills the screen, with the controller in front. Click App, Web, FOSS, or DevOps to enter the 3D daylight street. Select checkpoint 01–04 to drive there automatically, including reversing to an earlier checkpoint. Hold W/S, the arrow keys, or the forward/reverse buttons for manual movement. The car stops at checkpoints and opens their question panel. Return to the AOIs with the on-screen arrow or Escape. TV edge colors drive the twelve sections of wall lighting, including the live 3D game.

## Checkpoint questions

Question content is awaiting the supplied AOI questions. Add them to `QUESTIONS` in `src/checkpoints.js`, in checkpoint order for each AOI. Entries support `{ prompt, options, answer }`; `answer` is an optional zero-based correct option. Until content arrives, checkpoints display “Question coming soon.” No sample questions have been invented.

## WebAssembly assets

Room geometry is embedded in `public/assets/room.wasm`, driving geometry and the detailed Caliburn in `public/assets/city.wasm`, and the pedestrian mesh in `public/assets/pedestrian.wasm`. Every mesh uses the local WASM Draco decoder. The city uses compiled scene records with encoded data, consumed by the renderer; it contains no embedded GLB or standalone vehicle download. The application has no model export feature.

`npm run build` builds the website using the committed WASM assets. `npm run models` regenerates geometry. The car preparation step requires Blender and the locally downloaded native model:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec .cache/caliburn/source.blend --python scripts/prepare-car.py
npm run models
```

The [Rayfield Caliburn model by Seatla Morake](https://www.blendkit.com/asset-gallery-detail/ac12883b-5482-4653-adfc-6faa4e09c903/) is used under BlenderKit's [Royalty Free license for incorporation in software](https://www.blendkit.com/terms-and-conditions-2026/). Editable source, intermediate meshes, and local renders stay in ignored directories. The licensed vehicle is part of the compiled application scene; the model is not licensed for extraction or redistribution as a separate asset. The native mesh, coordinate system, wheel pivots, and runtime geometry budget are prepared by `scripts/prepare-car.py`. The reference wheel covers, license plate, livery UVs, and engine-deck surfaces are prepared in `scripts/car-source.mjs`.

The game display and case use the supplied Cyberpunk artwork. The ACM mark is the supplied image. The 3D geometry is a visual reconstruction from reference photographs.

Temporary screenshots, local notes, build output, and dependencies are ignored by Git.

## Surface assets

The driving scene uses locally hosted CC0 scanned maps by Rob Tuytel / Poly Haven: [Asphalt 02](https://polyhaven.com/a/asphalt_02), [Concrete Layers 02](https://polyhaven.com/a/concrete_layers_02), and [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02). Diffuse, OpenGL normal, and roughness maps are loaded from `public/assets/textures/`. Geometry remains in the WASM scene module.

The exact street composition is based on CD Projekt Red's [official Mac Streetview press image](https://press.cdn.cdpr.app/media/assets/808/Cyberpunk2077_Mac_Streetview_EN.png), available in the [official press collection](https://press.cdprojektred.com/en/224/808). The [Caliburn](https://breshke.artstation.com/projects/nY5EyK) and [Villefort Columbus](https://breshke.artstation.com/projects/ZG1xBm) concept pages by original vehicle designer Paul Breshke provide additional shape references.

`public/assets/textures/street-details.webp` contains rectified surface patches from that press image: physical billboards, window grids, tower louvers, barrier markings, and the car numberplate. These are mapped onto modeled surfaces; the photograph is not the gameplay background. To regenerate the compact atlas, place the original 2880×1800 image in the ignored `.cache/references/Streetview.png` path and run `python3 scripts/prepare-reference-textures.py` (Pillow required). The full-resolution reference stays outside the committed application assets.

The circular podium uses `public/assets/textures/district-facades.png`, generated with the built-in image generation tool using the supplied street images as architectural references. Prompt: “Four orthographic industrial facade elevations: dark teal louvres and rust framing; grey brutalist glass ribbons and fins; curved dark office glazing; pale concrete high-rise panels. Neutral albedo lighting, surface wear, no sky, people, vehicles, posters or perspective.” The foreground office and gold megatower use separately modeled window reveals, mullions, projecting crowns, flared structural frames, and recessed louvers. The palm crowns have modeled ribs and individual paired leaflets.

The lighting also uses the CC0 [Industrial Sunset 02](https://polyhaven.com/a/industrial_sunset_02) HDRI by Sergej Majboroda for material reflections.

The pedestrian source is a [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) human, using the [web GLB conversion](https://github.com/927tanmay/react-ai-voice-avatar/blob/main/assets/avatars/aarav.glb), stored at `scripts/assets/pedestrian.glb` for reproducible WASM builds. The Microsoft MIT notice is included in `public/assets/ROCKETBOX-LICENSE.txt`. Walking poses animate the imported skeleton; no replacement body geometry is made at runtime.

The street is a reconstruction from the supplied images. It does not contain the original Cyberpunk 2077 map, shaders, or engine and is not pixel identical to the gameplay captures.
