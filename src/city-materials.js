import * as T from "three";

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
  [assets.facades, assets.street, assets.district] = await Promise.all([
    loader.loadAsync("/assets/textures/district-facades.png"),
    loadImage("/assets/street-reference.png"),
    loadImage("/assets/district-reference.png"),
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
  // Only billboard artwork is sampled from the reference. The street, people
  // and vehicles remain independently rendered geometry.
  if (name.includes("kiosk"))
    return canvasTexture(256, 400, (c, w, h) =>
      c.drawImage(assets.street, 619, 226, 47, 63, 0, 0, w, h),
    );
  if (name.includes("right-poster"))
    return canvasTexture(384, 640, (c, w, h) =>
      c.drawImage(assets.street, 606, 1, 47, 78, 0, 0, w, h),
    );
  if (name.includes("militech"))
    return canvasTexture(512, 256, (c, w, h) =>
      c.drawImage(assets.street, 212, 132, 36, 19, 0, 0, w, h),
    );
  if (name === "sign-hero-0")
    return canvasTexture(384, 512, (c, w, h) =>
      c.drawImage(assets.street, 251, 116, 44, 65, 0, 0, w, h),
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
    if (name.includes("kiosk")) {
      c.fillStyle = "#d49c27";
      c.fillRect(0, 0, w, h);
      c.drawImage(art, 1020, 190, 475, 840, 70, 110, w - 140, h - 150);
      c.fillStyle = "#242518";
      c.font = "900 70px Arial";
      c.textAlign = "center";
      c.fillText("ALL FOODS", w / 2, 83);
    } else if (name.includes("hotel")) {
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
        m.color.set(m.name === "asphalt" ? 0xb8b3a2 : 0x888b80);
        m.roughness = 0.84;
        m.normalScale = new T.Vector2(0.19, 0.19);
      } else if (m.name.startsWith("concrete-")) {
        Object.assign(m, assets.concrete_layers_02);
        m.normalScale = new T.Vector2(0.38, 0.38);
        m.roughness = 0.93;
        m.color.lerp(new T.Color(0xdfdfd2), 0.45);
      } else if (m.name === "pavement") {
        Object.assign(m, assets.concrete_floor_02);
        m.color.set(0xd1cdc0);
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
        m.color.set(0xffffff);
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
        m.color.set(0x18383b);
        m.metalness = 0.68;
        m.roughness = 0.15;
        m.envMapIntensity = 1.2;
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
