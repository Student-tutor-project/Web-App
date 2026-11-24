// The hero: a daylit conference room high above a futuristic city, behind the whole page.
// Two chairs and the laptop are choices: the tutor's chair, the student's chair, and the laptop for
// logging in. Each has a floating sign (an HTML button projected onto the scene every frame), and
// clicking the object or its sign glides the camera towards it and opens the account panel.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { makeCity } from "./city.js";
import { makeDust } from "./particles.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const LITE = matchMedia("(max-width: 768px), (hover: none)").matches;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- room layout (metres; the glass wall is at x = -4.5, the slate wall at z = -6) ----
const ROOM = { x0: -4.5, x1: 5.5, z0: -6, z1: 7, h: 3 };
const TABLE = { pos: [-0.4, 0, -1.7], yaw: 0.62 };
// chair seats in table space: near side (+z) faces the table, far side faces back
const SEATS = [
  { at: [-2.15, 1.02], role: "tutor" },          // the end chair in front of the laptop
  { at: [-0.95, 1.08], role: "student" },        // the next chair along, to its right
  { at: [0.15, 1.08] }, { at: [1.2, 1.08] }, { at: [2.2, 1.02] },
  { at: [-1.95, -1.08], back: true }, { at: [-0.9, -1.08], back: true }, { at: [0.15, -1.08], back: true },
  { at: [1.2, -1.08], back: true }, { at: [2.2, -1.02], back: true },
];

function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 16;
  return t;
}

// dark slate floorboards with a soft grain
function floorTexture() {
  return canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = "#2B343B";
    g.fillRect(0, 0, w, h);
    const rows = 14, bh = h / rows;                        // boards about 24 cm wide at this repeat
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 900;
      while (x < w) {
        const len = 700 + Math.random() * 900;
        const l = 33 + Math.random() * 11;
        g.fillStyle = `hsl(205, 8%, ${l * 0.62}%)`;
        g.fillRect(x, r * bh, len, bh);
        for (let i = 0; i < 70; i++) {                      // fine grain streaks
          g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${0.02 + Math.random() * 0.04})`;
          g.fillRect(x + Math.random() * 60, r * bh + Math.random() * bh, len * (0.4 + Math.random() * 0.6), 1 + Math.random() * 1.5);
        }
        g.fillStyle = "rgba(10,14,17,.65)";                 // board ends
        g.fillRect(x, r * bh, 2, bh);
        x += len;
      }
      g.fillStyle = "rgba(10,14,17,.75)";                   // long seams
      g.fillRect(0, r * bh, w, 2);
    }
  }, [3, 3]);
}

// white ceiling tiles on a grey grid
function ceilingTexture() {
  return canvasTex(1024, 1024, (g, w) => {
    g.fillStyle = "#E9EDEF";
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 6000; i++) {                       // the fine pitting of mineral tiles
      g.fillStyle = `rgba(120,130,135,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * w, 2, 2);
    }
    g.fillStyle = "#B9C1C5";
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, 0, 10, w);
  }, [8, 11]);
}

// the laptop display: a calm sign-in screen in the brand colours (no words baked in)
function screenTexture(accent) {
  return canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#1C2A33");
    gr.addColorStop(1, "#2F4452");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const s = w / 512;                                     // drawn at 512 wide, scaled up for sharpness
    g.fillStyle = "rgba(238,242,243,.9)";
    g.beginPath(); g.arc(w / 2, h * 0.3, 22 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(238,242,243,.22)";
    g.fillRect(w / 2 - 110 * s, h * 0.48, 220 * s, 26 * s);
    g.fillRect(w / 2 - 110 * s, h * 0.6, 220 * s, 26 * s);
    g.fillStyle = accent;
    g.fillRect(w / 2 - 110 * s, h * 0.74, 220 * s, 30 * s);
  });
}

export async function initRoom({ lenis, account } = {}) {
  const canvas = document.getElementById("stage");
  const fail = () => document.body.classList.add("stage-failed");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: "high-performance", preserveDrawingBuffer: false });
  } catch { fail(); return null; }
  // render a little above the screen's own resolution on desktop so edges and textures stay crisp;
  // the adaptive loop below steps it down if the frame rate drops
  let dpr = LITE ? Math.min(devicePixelRatio, 1.5) : Math.min(Math.max(devicePixelRatio, 1.25), 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail(); });

  const accent = css("--accent") || "#A8D5F2";
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#DCE8EF", 0.0013);    // only the far city really hazes
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 900);

  // ---- the room shell ----
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.62, metalness: 0.05, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.9 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, ROOM.h, cz);
  const wallMat = new THREE.MeshStandardMaterial({ color: css("--wall") || "#3E4D58", roughness: 0.92 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, ROOM.h), wallMat);
  back.position.set(cx, ROOM.h / 2, ROOM.z0);
  back.receiveShadow = true;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(D, ROOM.h), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM.x1, ROOM.h / 2, cz);
  right.receiveShadow = true;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, ROOM.h), wallMat);
  front.rotation.y = Math.PI;
  front.position.set(cx, ROOM.h / 2, ROOM.z1);
  const skirtMat = new THREE.MeshStandardMaterial({ color: "#E4E8EA", roughness: 0.5 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 0.09, 0.02), skirtMat);
  skirt.position.set(cx, 0.045, ROOM.z0 + 0.01);
  const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, D), skirtMat);
  skirtR.position.set(ROOM.x1 - 0.01, 0.045, cz);
  scene.add(floor, ceiling, back, right, front, skirt, skirtR);

  // ceiling light panels
  const panelMat = new THREE.MeshBasicMaterial({ color: "#FFFFFF" });
  for (const [x, z] of [[-1.6, -3.6], [1.6, -3.6], [-1.6, 0.2], [1.6, 0.2], [-1.6, 3.8], [1.6, 3.8]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), panelMat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, ROOM.h - 0.005, z);
    scene.add(p);
  }

  // ---- light: daylight through the glass, soft window fill, a cool sky bounce ----
  const sun = new THREE.DirectionalLight("#FFF4E6", 2.1);
  sun.position.set(-14, 9, 2);
  sun.target.position.set(0, 0, -1);
  sun.castShadow = !LITE;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight("#D6E7F2", "#2A333A", 0.45);
  scene.add(hemi);
  RectAreaLightUniformsLib.init();
  const windowLight = new THREE.RectAreaLight("#E6F1F8", 1.6, D, ROOM.h);
  windowLight.position.set(ROOM.x0 + 0.05, ROOM.h / 2, cz);
  windowLight.lookAt(ROOM.x1, ROOM.h / 2, cz);
  scene.add(windowLight);
  const ceilingFill = new THREE.PointLight("#F2F6F8", 2.5, 9, 1.6);
  ceilingFill.position.set(0.5, 2.7, -1);
  scene.add(ceilingFill);

  // ---- the city outside ----
  const { city, update: updateCity } = makeCity({ lite: LITE, accent });
  scene.add(city);

  // ---- table, laptop, window frames (Blender) and the chairs (Tripo) ----
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let roomGltf, chairGltf;
  const progress = { a: 0, b: 0 };
  const setLoad = () => document.documentElement.style.setProperty("--load", ((progress.a + progress.b) / 2).toFixed(3));
  try {
    [roomGltf, chairGltf] = await Promise.all([
      loader.loadAsync("./model/room.glb", (e) => { progress.a = e.total ? e.loaded / e.total : 0; setLoad(); }),
      loader.loadAsync("./model/chair.glb", (e) => { progress.b = e.total ? e.loaded / e.total : 0; setLoad(); }),
    ]);
  } catch { fail(); return null; }

  const pieces = roomGltf.scene;
  pieces.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const table = pieces.getObjectByName("Table");
  const frames = pieces.getObjectByName("WindowFrames");
  const laptop = pieces.getObjectByName("Laptop");
  const display = pieces.getObjectByName("LaptopScreen");
  table.position.set(...TABLE.pos);
  table.rotation.y = TABLE.yaw;
  scene.add(table, frames);
  // the display glows softly; it brightens when the laptop is chosen
  const displayMat = new THREE.MeshBasicMaterial({ map: screenTexture(accent), toneMapped: false });
  displayMat.color.setScalar(0.85);
  display.material = displayMat;
  // the bevelled top looks a touch glossier in daylight
  table.traverse((o) => { if (o.isMesh && o.material?.name === "TableTop") { o.material.envMapIntensity = 0.4; o.material.color.multiplyScalar(0.8); } });

  const chairSrc = chairGltf.scene;
  chairSrc.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.material.envMapIntensity = 1.1;
    }
  });
  const chairBox = new THREE.Box3().setFromObject(chairSrc);
  const chairs = [];
  const seatObjects = {};
  for (const s of SEATS) {
    const c = chairSrc.clone(true);
    c.position.set(s.at[0], -chairBox.min.y, s.at[1]);
    c.rotation.y = (s.back ? Math.PI : 0) + (Math.random() - 0.5) * 0.25;   // a little out of line, like a real room
    table.add(c);
    chairs.push(c);
    if (s.role) seatObjects[s.role] = c;
  }
  table.updateMatrixWorld(true);

  // ---- the three choices ----
  const choices = {
    tutor: { obj: seatObjects.tutor, lift: 1.42 },
    student: { obj: seatObjects.student, lift: 1.42 },
    laptop: { obj: laptop, lift: 0.62 },
  };
  for (const [id, c] of Object.entries(choices)) {
    c.id = id;
    c.el = document.querySelector(`[data-choice="${id}"]`);
    c.box = new THREE.Box3().setFromObject(c.obj);
    c.anchor = c.box.getCenter(new THREE.Vector3());
    c.anchor.y = c.box.max.y + (id === "laptop" ? 0.04 : 0.6);
    c.focus = c.box.getCenter(new THREE.Vector3());
    // a soft glow ring on the floor under the chairs, a glow over the laptop screen
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.focus.x, 0.006, c.focus.z);
    if (id === "laptop") { ring.scale.setScalar(0.62); ring.position.y = c.box.min.y + 0.004; }
    scene.add(ring);
    c.ring = ring;
    c.hover = 0;
    // an invisible hit box for pointer picking
    const size = c.box.getSize(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(c.box.getCenter(new THREE.Vector3()));
    hit.userData.choice = id;
    scene.add(hit);
    c.hit = hit;
  }

  // ---- dust in the sunlight ----
  const dust = makeDust(LITE ? 300 : 900, "#FFF6EA", renderer.getPixelRatio(), { center: [-2.2, 0, -1.2], spread: [4.5, 2.8, 7], size: 7, opacity: 0.35 });
  if (!REDUCED) scene.add(dust);

  // ---- post: a whisper of bloom on the sky and the lit screen, desktop only ----
  let composer = null;
  if (!LITE) {
    // the composer draws into its own target, which skips the canvas's antialiasing: give it 4x MSAA
    const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.6, 0.92));
    composer.addPass(new OutputPass());
  }

  // ---- camera: five story beats, scrubbed across #story ----
  const beats = [
    { pos: [3.2, 1.62, 4.6], look: [-1.6, 0.78, -2.4] },     // 1 the room, as in the photo
    { pos: [1.4, 1.62, 3.4], look: [-5.6, 1.7, -5.4] },      // 2 towards the corner: the city on the left, slate wall for the copy
    { pos: [-0.2, 1.55, 1.9], look: [-2.6, 1.0, -1.6] },     // 3 closer in: the laptop at the tutor's end of the table
    { pos: [4.4, 1.45, -0.6], look: [-2.8, 1.2, -3.4] },       // 4 down the length of the table
    { pos: [3.6, 1.75, 5.2], look: [-1.2, 0.85, -2.2] },     // 5 back to the room, wider
  ];
  const st = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, hero: 1 };
  const set = (b) => Object.assign(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2] });
  set(beats[0]);
  if (!REDUCED) {
    const tl = gsap.timeline({ defaults: { ease: "power1.inOut", duration: 1 } });
    beats.slice(1).forEach((b, i) => tl.to(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2], hero: 0 }, i));
    ScrollTrigger.create({ trigger: "#story", start: "top top", end: "bottom bottom", scrub: 1, animation: tl });
  }
  st.signs = 1;

  gsap.to(".stage-dim", { opacity: 0.88, ease: "none",
    scrollTrigger: { trigger: "#story", start: "bottom 90%", end: "bottom 40%", scrub: true } });

  // ---- choosing: glide towards the object, then open the panel ----
  const view = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, t: 0 };   // t = how far we are "sitting down"
  let chosen = null;
  function choose(id) {
    const c = choices[id];
    if (!c) return;
    chosen = c;
    const dir = new THREE.Vector3(st.px, st.py, st.pz).sub(c.focus).setY(0).normalize();
    const to = c.focus.clone().addScaledVector(dir, id === "laptop" ? 1.25 : 2.1);
    to.y = id === "laptop" ? 1.25 : 1.45;
    Object.assign(view, { px: to.x, py: to.y, pz: to.z, lx: c.focus.x, ly: c.focus.y + (id === "laptop" ? 0 : 0.1), lz: c.focus.z });
    gsap.to(view, { t: 1, duration: REDUCED ? 0 : 1.1, ease: "power2.inOut" });
    gsap.to(displayMat.color, { r: id === "laptop" ? 1.25 : 0.85, g: id === "laptop" ? 1.25 : 0.85, b: id === "laptop" ? 1.25 : 0.85, duration: 0.6 });
  }
  function release() {
    if (!chosen) return;
    chosen = null;
    gsap.to(view, { t: 0, duration: REDUCED ? 0 : 1.0, ease: "power2.inOut" });
    gsap.to(displayMat.color, { r: 0.85, g: 0.85, b: 0.85, duration: 0.6 });
  }
  // the signs are the account buttons; the room only adds the camera move
  for (const c of Object.values(choices)) c.el?.addEventListener("click", () => choose(c.id));
  document.getElementById("account")?.addEventListener("close", release);

  // pointer: hovering an object lights its sign; clicking it presses the sign
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hits = Object.values(choices).map((c) => c.hit);
  let hovered = null;
  const pointer = { x: 0, y: 0 };
  const pick = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    return h ? choices[h.object.userData.choice] : null;
  };
  const inHero = () => st.signs > 0.5 && !chosen;
  const onPage = (t) => !t.closest("a, button, input, select, textarea, dialog, .beat__copy");
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    const next = inHero() && onPage(e.target) ? pick(e) : null;
    if (next !== hovered) {
      hovered = next;
      document.body.classList.toggle("is-picking", !!hovered);
      for (const c of Object.values(choices)) c.el?.classList.toggle("is-hot", c === hovered);
    }
  }, { passive: true });
  addEventListener("click", (e) => {
    if (!inHero() || !onPage(e.target)) return;
    const c = pick(e);
    if (c) c.el?.click();
  });

  // ---- resize ----
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 58 : camera.aspect < 1.3 ? 46 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setSize(innerWidth, innerHeight);
  }
  addEventListener("resize", resize);
  resize();

  // ---- render loop ----
  let frames_ = 0, acc = 0, last = performance.now(), fps = 60;
  const covers = [...document.querySelectorAll(".stage-cover")];
  const covered = () => covers.some((c) => { const r = c.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; });
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
  const drift = { x: 0, y: 0 };

  function tick() {
    const now = performance.now(), dt = now - last;
    last = now;
    if (document.hidden || covered()) return;
    const t = clock.getElapsedTime();

    acc += dt; frames_++;
    if (frames_ === 90) {
      fps = 1000 / (acc / frames_);
      if (fps < 42 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      frames_ = 0; acc = 0;
    }

    // camera: the scroll beat, eased towards the chosen object, plus a slow breath and cursor parallax
    const portrait = camera.aspect < 1;
    camPos.set(st.px, st.py, st.pz);
    camLook.set(st.lx, st.ly, st.lz);
    if (portrait) { camPos.x += 0.4; camPos.z += 1.4; camPos.y += 0.5; camLook.x -= 0.7; camLook.y += 1.25; }   // copy on top, the seats in the lower half
    if (view.t > 0) {
      camPos.lerp(tmp.set(view.px, view.py, view.pz), view.t);
      camLook.lerp(tmp.set(view.lx, view.ly, view.lz), view.t);
    }
    if (!REDUCED) {
      drift.x += (pointer.x - drift.x) * 0.04;
      drift.y += (pointer.y - drift.y) * 0.04;
      camPos.x += Math.sin(t * 0.18) * 0.06 + drift.x * 0.12;
      camPos.y += Math.sin(t * 0.23) * 0.025 + drift.y * 0.05;
      camLook.x += drift.x * 0.25;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    st.signs = Math.max(0, Math.min(1, 1 - scrollY / (innerHeight * 0.45)));
    // choices: glow rings and the floating signs
    for (const c of Object.values(choices)) {
      const want = c === hovered || c === chosen ? 1 : 0;
      c.hover += (want - c.hover) * 0.12;
      c.ring.material.opacity = (0.22 + 0.5 * c.hover) * st.signs * (REDUCED ? 1 : 0.85 + 0.15 * Math.sin(t * 2));
      if (!c.el) continue;
      tmp.copy(c.anchor);
      if (!REDUCED) tmp.y += Math.sin(t * 1.1 + c.anchor.x) * 0.035;      // a gentle float
      tmp.project(camera);
      const visible = tmp.z < 1 && st.signs > 0.02 && view.t < 0.5;
      c.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
      c.el.style.opacity = visible ? Math.min(1, st.signs * 1.4).toFixed(3) : "0";
      c.el.classList.toggle("is-off", !visible || st.signs < 0.3);
    }

    updateCity(REDUCED ? 0 : t);
    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uBoost.value = Math.min(2, Math.abs(lenis?.velocity || 0) * 0.02);

    composer ? composer.render() : renderer.render(scene, camera);
  }

  // warm up before the first frame so the page never freezes: compile the shaders in the
  // background (parallel compile where the browser has it), then upload the textures a few at a time between frames
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // (with bloom on, the scene draws into the composer's buffer, so compile for that target)
  try {
    if (composer) renderer.setRenderTarget(composer.readBuffer);
    await renderer.compileAsync(scene, camera);
  } catch { /* the first frame compiles instead */ }
  renderer.setRenderTarget(null);
  const textures = new Set();
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
  });
  let budget = performance.now();
  for (const tex of textures) {
    renderer.initTexture(tex);
    if (performance.now() - budget > 8) { await nextFrame(); budget = performance.now(); }
  }
  renderer.setAnimationLoop(tick);
  tick();
  document.body.classList.add("stage-ready");
  const api = { renderer, scene, camera, st, choices, choose, release, beats, get fps() { return fps; }, get dpr() { return dpr; } };
  if (import.meta.env.DEV) { window.__room = api; window.__THREE = THREE; }
  return api;
}
