# PS5 viewer implementation plan

Goal: deliver a working local 3D viewer faithful to the supplied silhouettes and visible details.

Architecture: Vite serves a small vanilla JavaScript application. Three.js handles meshes, physically based materials, lighting, camera controls, and export. The inspector uses ordinary accessible HTML controls. The original references are local assets.

Files: `src/models.js` builds the console variants and controller; `src/viewer.js` owns rendering and camera transitions; `src/main.js` connects the controls; `src/style.css` defines the responsive studio; `index.html` contains the interface.

- [x] Create the studio interface and retain the reference images locally.
- [x] Build the console and controller geometry, retaining separate mesh groups for plates, stand, and controller.
- [x] Connect model selection, orientation, lighting, turntable, reset, fullscreen, and PNG export.
- [x] Build the application and inspect desktop/mobile rendering and actual control behavior. Correct issues seen in the rendered model against the references.

Review focus: white panels must have visible thickness and curved silhouettes; each variant must retain its own seam and disc details; horizontal placement must reach the floor without clipping; camera framing must adapt to narrow screens; missing WebGL and export failures must produce a usable message.

## Verification

- `npm run build` succeeds. Vite reports the expected large Three.js bundle advisory; the application bundle is approximately 160 kB compressed.
- Browser inspection covered all three console variants, both positions, light and dark studios, keyboard orbit, controller visibility, turntable start/pause, reset, reference selection, fullscreen, and a successful PNG download.
- Desktop review used 1360 × 900; mobile review used 390 × 844. Camera framing now fits the combined visible meshes instead of using fixed distances.
- A geometric clearance check sampled the chassis triangles for each variant and found no chassis penetration through the outer white surface. The chassis uses 10,464 triangles with subdivisions along its curves.
- No browser console errors were recorded during the final check.
- The saved desktop preview is `artifacts/studio-preview.png`.

Limit: geometry is reconstructed visually from the supplied photographs; exact manufacturing dimensions and physical clearances are not certified.
