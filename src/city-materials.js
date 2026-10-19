import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export function canvasTexture(width, height, draw) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export async function loadCityMaterials(renderer) {
  const loader = new T.TextureLoader(),
    assets = {};
  const hdr = await new HDRLoader().loadAsync(
    "/assets/textures/industrial-sky.hdr",
  );
  hdr.mapping = T.EquirectangularReflectionMapping;
  const pmrem = new T.PMREMGenerator(renderer);
  assets.environment = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  await Promise.all(
    ["asphalt_02", "concrete_layers_02", "concrete_floor_02"].map(
      async (name) => {
        const textures = await Promise.all(
          ["diff", "nor_gl", "rough"].map(async (channel) => {
            const t = await loader.loadAsync(
              `/assets/textures/${name}_${channel}.jpg`,
            );
            t.colorSpace =
              channel === "diff" ? T.SRGBColorSpace : T.NoColorSpace;
            t.wrapS = t.wrapT = T.RepeatWrapping;
            t.anisotropy = Math.min(
              8,
              renderer.capabilities.getMaxAnisotropy(),
            );
            return t;
          }),
        );
        assets[name] = {
          map: textures[0],
          normalMap: textures[1],
          roughnessMap: textures[2],
        };
      },
    ),
  );
  assets.art = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "/assets/cyberpunk.png";
  });
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  [assets.facades, assets.street, assets.district, assets.details] =
    await Promise.all([
      loader.loadAsync("/assets/textures/district-facades.png"),
      loadImage("/assets/street-reference.png"),
      loadImage("/assets/district-reference.png"),
      loadImage("/assets/textures/street-details.webp"),
    ]);
  assets.facades.colorSpace = T.SRGBColorSpace;
  assets.facades.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy(),
  );
  return assets;
}
function windowTexture(index) {
  return canvasTexture(256, 512, (c, w, h) => {
    c.fillStyle = ["#687574", "#7a8279", "#2e464d", "#a4a895"][index % 4];
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#d0d9d15c");
    g.addColorStop(0.5, "#111d2480");
    g.addColorStop(1, "#43586222");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#15232666";
    for (let i = 0; i < 12; i++) {
      const x = (i * 83 + index * 13) % w;
      c.fillRect(x, 0, 1 + (i % 4) * 2, h);
    }
    c.fillStyle = "#ded9b32d";
    c.fillRect(17, 90, 74, 170);
    c.fillRect(151, 87, 65, 175);
    c.fillStyle = "#11222599";
    c.fillRect(0, h - 27, w, 27);
    c.fillRect(0, 0, 5, h);
    c.fillRect(w - 5, 0, 5, h);
    c.fillStyle = "#101d1b30";
    for (let i = 0; i < 80; i++)
      c.fillRect((i * 79) % w, (i * 191) % h, 1, 13 + (i % 30));
  });
}
function poster(name, assets) {
  const art = assets.art;
  const details = name.includes("kiosk")
    ? [384, 0, 256, 384]
    : name.includes("right-poster")
      ? [640, 0, 256, 512]
      : name.includes("masala")
        ? [768, 512, 384, 128]
        : name.includes("nc-mark")
          ? [1536, 0, 256, 384]
          : name === "sign-hero-0"
            ? [0, 0, 384, 512]
            : null;
  if (details)
    return canvasTexture(details[2], details[3], (c, w, h) =>
      c.drawImage(assets.details, ...details, 0, 0, w, h),
    );
  if (name.includes("militech"))
    return canvasTexture(512, 256, (c, w, h) =>
      c.drawImage(assets.street, 212, 132, 36, 19, 0, 0, w, h),
    );
  if (name === "sign-hero-1")
    return canvasTexture(384, 512, (c, w, h) =>
      c.drawImage(assets.district, 136, 69, 72, 86, 0, 0, w, h),
    );
  const vertical = name.includes("vertical") || name.includes("poster");
  return canvasTexture(768, vertical ? 1536 : 512, (c, w, h) => {
    const id = Number(name.match(/\d+/)?.[0] || 0);
    c.fillStyle = "#162e35";
    c.fillRect(0, 0, w, h);
    if (name.includes("hotel")) {
      c.fillStyle = "#162e35";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#8fc0c3";
      c.font = "900 122px Arial";
      c.textAlign = "center";
      c.fillText("HOTEL", w / 2, h * 0.5);
      c.font = "52px Arial";
      c.fillText("ホテル", w / 2, h * 0.73);
    } else if (name.includes("militech")) {
      c.fillStyle = "#202c2e";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#b6b899";
      c.font = "900 114px Arial";
      c.textAlign = "center";
      c.fillText("MILITECH", w / 2, h * 0.52);
      c.font = "24px Arial";
      c.fillText("INTERNATIONAL ARMAMENTS", w / 2, h * 0.67);
    } else if (name.includes("right-poster") || id % 3 === 1) {
      c.drawImage(art, 990, 90, 605, 950, 0, 0, w, h);
      const g = c.createLinearGradient(0, h * 0.5, 0, h);
      g.addColorStop(0, "#0d233000");
      g.addColorStop(1, "#0d2330");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#dbac44";
      c.font = `900 ${w * 0.12}px Arial`;
      c.textAlign = "center";
      c.fillText(id % 2 ? "KIROSHI" : "SAMURAI", w / 2, h * 0.88);
    } else if (vertical) {
      c.fillStyle = "#356775";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#6b8d8e";
      c.lineWidth = 4;
      for (let i = 0; i < 12; i++)
        c.strokeRect(
          60 + i * 8,
          80 + i * 12,
          w - 120 - i * 16,
          h - 160 - i * 24,
        );
      c.save();
      c.translate(w * 0.6, h * 0.5);
      c.rotate(-Math.PI / 2);
      c.textAlign = "center";
      c.fillStyle = "#b0b9a8";
      c.font = "900 145px Arial";
      c.fillText(id % 2 ? "DATA INC" : "SOFTSYS", 0, 0);
      c.restore();
    } else {
      c.drawImage(art, 0, 0, 1900, 1000, 0, 0, w, h);
      c.fillStyle = "#131f2477";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#d8ddd0";
      c.textAlign = "left";
      c.font = "900 95px Arial";
      c.fillText(id % 2 ? "NIGHT CITY" : "KIROSHI", 40, h * 0.63);
      c.font = "22px Arial";
      c.fillText(
        id % 2 ? "YOUR FUTURE. REIMAGINED." : "SEE BEYOND THE ORDINARY",
        45,
        h * 0.76,
      );
    }
    c.globalAlpha = 0.12;
    c.fillStyle = "#091b20";
    for (let i = 0; i < h; i += 4) c.fillRect(0, i, w, 1);
    c.globalAlpha = 1;
    c.strokeStyle = "#72867c";
    c.lineWidth = 9;
    c.strokeRect(7, 7, w - 14, h - 14);
  });
}
export function decorateCity(root, assets) {
  const seen = new Set(),
    windows = Array.from({ length: 4 }, (_, i) => windowTexture(i));
  const detail = (x, y, w, h) =>
    canvasTexture(w, h, (c, tw, th) =>
      c.drawImage(assets.details, x, y, w, h, 0, 0, tw, th),
    );
  const plate = detail(1152, 512, 256, 128);
  const pearlLivery = canvasTexture(1024, 256, (c, w, h) => {
    c.fillStyle = "#f7f7ef";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#b69a50";
    c.fillRect(w * 0.574, 0, w * 0.018, h);
    c.fillStyle = "#e0cd8e";
    c.fillRect(w * 0.574, 0, w * 0.002, h);
  });
  const rearLivery = canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = "#147e8a";
    c.fillRect(0, 0, w, h);
    for (const side of [-1, 1]) {
      c.save();
      if (side > 0) {
        c.translate(w, 0);
        c.scale(-1, 1);
      }
      c.fillStyle = "#b78c23";
      c.beginPath();
      for (const [i, [x, y]] of [
        [0.015, 0.64],
        [0.3, 0.64],
        [0.37, 0.48],
        [0.015, 0.21],
      ].entries())
        i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h);
      c.closePath();
      c.fill();
      c.fillStyle = "#093c48";
      c.beginPath();
      for (const [i, [x, y]] of [
        [0.025, 0.24],
        [0.36, 0.43],
        [0.32, 0.51],
        [0.025, 0.46],
      ].entries())
        i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h);
      c.closePath();
      c.fill();
      c.restore();
    }
  });
  const engineDeck = canvasTexture(512, 1024, (c, w, h) => {
    c.fillStyle = "#0b171b";
    c.fillRect(0, 0, w, h);
    for (const side of [-1, 1]) {
      c.save();
      c.translate(w * 0.5, h * 0.55);
      c.scale(side, 1);
      const g = c.createLinearGradient(0, 0, w * 0.3, 0);
      g.addColorStop(0, "#271d15");
      g.addColorStop(0.6, "#885a32");
      g.addColorStop(1, "#49301d");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(w * 0.08, -h * 0.18);
      c.lineTo(w * 0.32, -h * 0.27);
      c.lineTo(w * 0.27, h * 0.2);
      c.lineTo(w * 0.08, h * 0.25);
      c.closePath();
      c.fill();
      c.strokeStyle = "#171c1c";
      c.lineWidth = 5;
      for (let y = -h * 0.16; y < h * 0.17; y += h * 0.07) {
        c.beginPath();
        c.moveTo(w * 0.08, y);
        c.lineTo(w * 0.3, y - h * 0.04);
        c.stroke();
      }
      c.restore();
    }
    c.fillStyle = "#b7c5c2";
    c.fillRect(w * 0.49, h * 0.08, w * 0.014, h * 0.78);
    c.fillStyle = "#d23933";
    c.fillRect(w * 0.505, h * 0.08, w * 0.009, h * 0.78);
  });
  const tailLeds = canvasTexture(1024, 128, (c, w, h) => {
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    for (const side of [-1, 1]) {
      c.save();
      if (side > 0) {
        c.translate(w, 0);
        c.scale(-1, 1);
      }
      c.strokeStyle = "#ff2436";
      c.lineWidth = 9;
      c.lineJoin = "round";
      c.shadowColor = "#ff1430";
      c.shadowBlur = 11;
      c.beginPath();
      c.moveTo(w * 0.045, h * 0.22);
      c.lineTo(w * 0.105, h * 0.12);
      c.lineTo(w * 0.31, h * 0.4);
      c.lineTo(w * 0.35, h * 0.6);
      c.lineTo(w * 0.18, h * 0.57);
      c.closePath();
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = "#ff9b9c";
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = "#ff3151";
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(w * 0.12, h * 0.39);
      c.lineTo(w * 0.3, h * 0.51);
      c.stroke();
      c.restore();
    }
  });
  const metalWear = canvasTexture(256, 256, (c, w, h) => {
    let seed = 8713;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    c.fillStyle = "#d5d8d0";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#52615a14";
    for (let i = 0; i < 2000; i++)
      c.fillRect(random() * w, random() * h, 1, 1 + random() * 5);
    const grime = c.createLinearGradient(0, 0, 0, h);
    grime.addColorStop(0, "#17272600");
    grime.addColorStop(0.8, "#17272600");
    grime.addColorStop(1, "#443e2e3a");
    c.fillStyle = grime;
    c.fillRect(0, 0, w, h);
  });
  metalWear.wrapS = metalWear.wrapT = T.RepeatWrapping;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (!seen.has(m)) {
      seen.add(m);
      if (m.name === "asphalt" || m.name === "asphalt-patch") {
        Object.assign(m, assets.asphalt_02);
        m.color.set(m.name === "asphalt" ? 0xa19e90 : 0x888b80);
        m.roughness = 0.84;
        m.normalScale = new T.Vector2(0.19, 0.19);
        for (const texture of [m.map, m.normalMap, m.roughnessMap])
          texture.repeat.set(2, 2);
      } else if (m.name.startsWith("concrete-")) {
        Object.assign(m, assets.concrete_layers_02);
        m.normalScale = new T.Vector2(0.38, 0.38);
        m.roughness = 0.93;
        m.color.lerp(new T.Color(0xdfdfd2), 0.45);
      } else if (m.name === "pavement") {
        Object.assign(m, assets.concrete_floor_02);
        const source = assets.concrete_floor_02.map.image;
        m.map = canvasTexture(1024, 1024, (c, w, h) => {
          c.fillStyle = "#e3dfd0";
          c.fillRect(0, 0, w, h);
          c.globalAlpha = 0.7;
          c.drawImage(source, 0, 0, w, h);
        });
        m.map.wrapS = m.map.wrapT = T.RepeatWrapping;
        m.color.set(0xc9c8bb);
        m.roughness = 0.86;
        m.normalScale = new T.Vector2(0.07, 0.07);
      } else if (m.name.startsWith("reference-facade-")) {
        const index = Number(m.name.slice(-1));
        const source = assets.facades.image;
        const half = source.width / 2;
        m.map = canvasTexture(1024, 1024, (c, w, h) =>
          c.drawImage(
            source,
            (index % 2) * half,
            index < 2 ? 0 : half,
            half,
            half,
            0,
            0,
            w,
            h,
          ),
        );
        m.map.anisotropy = assets.facades.anisotropy;
        m.map.wrapS = m.map.wrapT = T.RepeatWrapping;
        if (index === 2) m.map.repeat.set(4, 4);
        else if (index === 1 || index === 3) m.map.repeat.set(1, 2);
        m.color.set(index === 0 ? 0xa9b8b1 : 0xffffff);
        m.roughness = 0.78;
        m.metalness = 0.12;
      } else if (m.name.startsWith("cladding") || m.name === "painted-steel") {
        m.map = metalWear;
        m.roughness = 0.65;
      } else if (m.name.startsWith("city-window")) {
        m.map = windows[Number(m.name.slice(-1)) || 0];
        m.color.set(0xb7c4bf);
        m.roughness = 0.27;
        m.metalness = 0.5;
        m.envMapIntensity = 0.55;
      } else if (m.name === "city-glass") {
        m.map = windows[1];
        m.color.set(0x4f777c);
        m.roughness = 0.22;
      } else if (m.name === "reference-window-bay") {
        m.map = detail(896, 0, 384, 384);
        m.color.set(0xc4c8b8);
        m.roughness = 0.37;
        m.metalness = 0.26;
      } else if (m.name === "reference-tower-louvres") {
        m.map = detail(1280, 0, 256, 512);
        m.color.set(0xa1ada6);
        m.roughness = 0.65;
        m.metalness = 0.3;
      } else if (m.name === "reference-barrier-panel") {
        m.map = detail(1408, 512, 512, 256);
        m.color.set(0xe5dfcb);
        m.roughness = 0.86;
      } else if (m.name === "car-numberplate") {
        m.map = plate;
        m.color.set(0xffffff);
      } else if (m.name === "car-pearl") {
        m.map = pearlLivery;
      } else if (m.name === "car-rear-livery") {
        m.map = rearLivery;
      } else if (m.name === "car-engine-deck") {
        m.map = engineDeck;
      } else if (m.name === "car-taillight") {
        m.color.set(0x182025);
        m.emissive = new T.Color(0xffffff);
        m.emissiveMap = tailLeds;
        m.emissiveIntensity = 2.5;
        m.metalness = 0.15;
        m.roughness = 0.17;
      } else if (m.name === "tail-light") {
        m.emissive = new T.Color(0xdf1731);
        m.emissiveIntensity = 1.4;
      } else if (m.name === "road-paint") {
        const map = canvasTexture(512, 512, (c, w, h) => {
          c.fillStyle = "#d9d6c5";
          c.fillRect(0, 0, w, h);
          c.globalCompositeOperation = "destination-out";
          let seed = 476;
          const rnd = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          for (let i = 0; i < 6500; i++)
            c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 7, 1 + rnd() * 4);
          for (let i = 0; i < 12; i++)
            c.fillRect(rnd() * w, 0, 3 + rnd() * 8, h);
        });
        m.map = map;
        m.transparent = true;
        m.opacity = 0.6;
        m.alphaTest = 0.1;
      } else if (m.name === "car-headlight") {
        m.emissive = new T.Color(0xcce8ee);
        m.emissiveIntensity = 0.7;
      } else if (m.name.startsWith("checkpoint-")) {
        m.emissive = new T.Color(0xb7d94a);
        m.emissiveIntensity = 0.7;
      } else if (m.name === "car-glass") {
        m.color.set(0x15292c);
        m.metalness = 0.5;
        m.roughness = 0.15;
        m.envMapIntensity = 1.2;
      } else if (m.name === "car-carbon") {
        const weave = canvasTexture(128, 128, (c, w, h) => {
          c.fillStyle = "#68716f";
          c.fillRect(0, 0, w, h);
          for (let y = 0; y < h; y += 4)
            for (let x = 0; x < w; x += 4) {
              c.fillStyle = (x + y) % 8 ? "#a7adaa" : "#414a4b";
              c.fillRect(x, y, 3, 3);
            }
        });
        weave.wrapS = weave.wrapT = T.RepeatWrapping;
        weave.repeat.set(7, 7);
        m.map = weave;
      } else if (m.name.startsWith("traffic-paint")) {
        m.map = metalWear;
        m.roughness = 0.49;
        m.metalness = 0.3;
      }
    }
    if (o.name.startsWith("sign-")) {
      const map = poster(o.name, assets);
      o.material = new T.MeshStandardMaterial({
        map,
        emissiveMap: map,
        emissive: 0xffffff,
        emissiveIntensity: 0.12,
        roughness: 0.55,
      });
      o.castShadow = false;
    }
  });
}
