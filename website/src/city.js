// The city outside the glass: a futuristic daylight skyline built in code (no real landmarks).
// Pale glass towers, a few twisted and tapered ones, halo rings and sky bridges.
// Everything sits in haze so it reads as far away.
import * as THREE from "three";

// a seeded random, so the skyline is the same on every visit
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// glass facade: horizontal floor bands and a few lit mullion lines
function facadeTextures() {
  const W = 512, H = 2048;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#9DB4C4";
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {                // each floor: glass panes with a little variation in tint
    for (let x = 0; x < W; x += 32) {
      const v = Math.random();
      g.fillStyle = v < 0.08 ? "rgba(240,248,252,.55)" : v < 0.2 ? "rgba(70,95,112,.25)" : "rgba(180,205,220,.12)";
      g.fillRect(x + 2, y + 6, 28, 24);
    }
    g.fillStyle = "rgba(230,240,246,.6)";          // floor slab
    g.fillRect(0, y, W, 5);
  }
  for (let x = 0; x < W; x += 32) {                // vertical fins
    g.fillStyle = "rgba(110,130,145,.45)";
    g.fillRect(x, 0, 3, H);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const e = document.createElement("canvas");      // emissive: thin light lines up the corners and a few bands
  e.width = W; e.height = H;
  const ge = e.getContext("2d");
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, W, H);
  ge.fillStyle = "#fff";
  ge.fillRect(0, 0, 8, H);
  ge.fillRect(W - 8, 0, 8, H);
  for (let y = 160; y < H; y += 384) ge.fillRect(0, y, W, 5);
  for (let y = 0; y < H; y += 32) {                // offices with the lights on: faint by day, they carry the night
    for (let x = 0; x < W; x += 32) {
      const v = Math.random();
      if (v < 0.3) { ge.fillStyle = `rgba(255,255,255,${(0.12 + Math.random() * 0.28).toFixed(2)})`; ge.fillRect(x + 3, y + 7, 26, 22); }
    }
  }
  const emissive = new THREE.CanvasTexture(e);
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  emissive.anisotropy = 8;
  return { map, emissive };
}

// a box that twists as it rises
function twistedBox(w, h, d, turns) {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 24, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = ((v.y + h / 2) / h) * turns;
    const taper = 1 - ((v.y + h / 2) / h) * 0.25;
    p.setXYZ(i, (v.x * Math.cos(a) - v.z * Math.sin(a)) * taper, v.y, (v.x * Math.sin(a) + v.z * Math.cos(a)) * taper);
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeCity({ lite = false, accent = "#A8D5F2" } = {}) {
  const city = new THREE.Group();
  const rand = rng(7);
  const { map, emissive } = facadeTextures();
  const glow = new THREE.Color(accent);

  // sky dome: blue overhead, hazy white at the horizon
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color("#7FA9CC") }, uHorizon: { value: new THREE.Color("#E6EFF4") } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop, uHorizon; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 2.2 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.7)), 1.0); }`,
    })
  );
  sky.renderOrder = -10;
  city.add(sky);

  // soft clouds: a few large faint sprites drifting slowly
  const cloudTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176, y = 100 + Math.random() * 56, r = 30 + Math.random() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    s.scale.set(160, 60, 1);
    s.position.set(-260 - rand() * 60, 60 + rand() * 70, -200 + i * 80);
    s.userData.speed = 0.6 + rand() * 0.6;
    clouds.push(s);
    city.add(s);
  }

  // towers
  const towerMats = [0.85, 1, 1.12].map((tint) => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#C9D8E2").multiplyScalar(tint), map, roughness: 0.25, metalness: 0.55,
      emissive: glow, emissiveMap: emissive, emissiveIntensity: 0.35,
    });
    return m;
  });
  const coreMat = new THREE.MeshStandardMaterial({ color: "#B7C6CF", roughness: 0.4, metalness: 0.4 });
  const ringMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.65 });

  const count = lite ? 34 : 70;
  const towers = [];
  for (let i = 0; i < count; i++) {
    // keep a clear avenue near the glass, then fill outwards
    const x = -55 - rand() * 270;
    const z = -320 + rand() * 520;
    const hero = rand() < 0.12;
    const h = 90 + rand() * 120 + (hero ? 110 : 0);
    const w = 12 + rand() * 18;
    const kind = rand();
    let geo;
    if (kind < 0.18) geo = twistedBox(w, h, w, 0.9 + rand() * 0.8);
    else if (kind < 0.42) geo = new THREE.CylinderGeometry(w * 0.38, w * 0.6, h, 24, 1);
    else if (kind < 0.55) geo = new THREE.CylinderGeometry(w * 0.15, w * 0.55, h, 6, 1);
    else geo = new THREE.BoxGeometry(w, h, w * (0.7 + rand() * 0.6));
    const m = towerMats[i % 3].clone();
    m.map = map.clone();
    m.map.repeat.set(Math.max(1, w / 16), h / 52);
    m.map.needsUpdate = true;
    m.emissiveMap = emissive.clone();
    m.emissiveMap.repeat.copy(m.map.repeat);
    m.emissiveMap.needsUpdate = true;
    const t = new THREE.Mesh(geo, m);
    const base = -170;                                  // the room is high up; most roofs sit below eye level
    t.position.set(x, base + h / 2, z);
    t.rotation.y = rand() * Math.PI;
    city.add(t);
    towers.push(t);

    // a spire or crown on some
    if (rand() < 0.35) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 14 + rand() * 18, 6), coreMat);
      sp.position.set(x, base + h + 8, z);
      city.add(sp);
    }
    // a glowing halo ring on a few of the tall ones
    if (h > 190 && rand() < 0.6) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(w * 0.85, 0.6, 8, 64), ringMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(x, base + h * (0.55 + rand() * 0.3), z);
      city.add(r);
    }
  }

  // sky bridges between neighbours of similar height
  const bridgeMat = new THREE.MeshStandardMaterial({ color: "#DCE7EE", roughness: 0.3, metalness: 0.5, emissive: glow, emissiveIntensity: 0.2 });
  for (let i = 0; i < towers.length; i += 3) {
    const a = towers[i], b = towers[(i + 5) % towers.length];
    const d = a.position.distanceTo(b.position);
    if (d > 45 || d < 12) continue;
    const y = -170 + Math.min(a.geometry.parameters?.height || 60, b.geometry.parameters?.height || 60) * 0.6;
    const br = new THREE.Mesh(new THREE.BoxGeometry(d, 2.2, 3), bridgeMat);
    br.position.set((a.position.x + b.position.x) / 2, y, (a.position.z + b.position.z) / 2);
    br.rotation.y = -Math.atan2(b.position.z - a.position.z, b.position.x - a.position.x);
    city.add(br);
  }

  function update(t) {
    for (const c of clouds) {
      c.position.z += c.userData.speed * 0.02;
      if (c.position.z > 260) c.position.z = -260;
    }
    ringMat.opacity = 0.5 + Math.sin(t * 0.8) * 0.15;
  }

  // time of day (see daylight.js): sky, clouds, and how brightly the towers glow
  const warm = new THREE.Color("#FFD9A6"), cloudDay = new THREE.Color("#FFFFFF"), cloudNight = new THREE.Color("#5E6E80");
  function setLight(L) {
    sky.material.uniforms.uTop.value.set(L.sky[0]);
    sky.material.uniforms.uHorizon.value.set(L.sky[1]);
    for (const c of clouds) { c.material.opacity = L.clouds; c.material.color.copy(cloudDay).lerp(cloudNight, L.night); }
    for (const t of towers) {
      t.material.emissive.copy(glow).lerp(warm, L.night * 0.7);
      t.material.emissiveIntensity = L.glow;
      t.material.roughness = 0.25 + 0.2 * L.rain;
    }
    bridgeMat.emissiveIntensity = 0.2 + L.night * 0.8;
  }

  return { city, update, setLight };
}
