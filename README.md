# PS5 Design Studio

A local interactive Three.js study of the PS5 Original, Slim, and Pro, reconstructed from the four supplied reference photographs. The controller and consoles are procedural meshes, with separate curved plates, chassis, vents, buttons, ports, disc housings, and cooling ribs.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Build a static version with `npm run build`, then use `npm run preview` to inspect it.

## Controls

- Drag to orbit; scroll or pinch to zoom.
- Focus the model and use arrow keys to rotate, `+` / `−` to zoom, and `0` to reset.
- Select a console, change its position, show or hide the DualSense, and switch between light and dark studios.
- The bottom toolbar has auto rotation, reset, and PNG export. Fullscreen is in the upper right.
- The reference library retains the original photographs and can switch directly to the corresponding model and orientation.

This is a visual reconstruction from photographs, not an official Sony mesh or a dimensional CAD model. Fonts load from Google Fonts, with local sans-serif fallbacks. Three.js and all reference images are served from the project.
