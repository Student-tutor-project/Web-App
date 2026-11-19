// The live 3D stage: one fixed full-screen WebGL canvas behind the whole page.
// Scroll flies the camera through the story beats, the cursor moves a soft light,
// the Explore section lets visitors drag to spin the lamp.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { makeDust, radialTexture } from "./particles.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const LITE = matchMedia("(max-width: 768px), (hover: none)").matches;      // phones and tablets
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function initStage({ modelUrl, beats, hotspots = [], lightModes, modelYaw = 0, lamp, lenis }) {
  const canvas = document.getElementById("stage");
  const fail = () => document.body.classList.add("stage-failed");       // CSS keeps the poster

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: "high-performance" });
  } catch { fail(); return null; }
  let dpr = Math.min(devicePixelRatio, LITE ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail(); });

  const amber = css("--accent-2");
  const mint = new THREE.Color(css("--accent")).lerp(new THREE.Color("#ffffff"), 0.45);   // a paler mint so brass never turns neon

  // ---- scene, fog, reflections (no HDR file needed) ----
  const bg = new THREE.Color(css("--bg"));
  const scene = new THREE.Scene();
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg, 0.06);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 60);

  // ---- lights: a dim key, mint rims behind the lamp, the lamp's own warm light, a cursor light ----
  const key = new THREE.DirectionalLight(0xdfe9ea, 0.6);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const rimA = new THREE.SpotLight(mint, 18, 20, 0.55, 0.8);
  rimA.position.set(-3.5, 2.4, -3);
  const rimB = new THREE.SpotLight(mint, 9, 20, 0.55, 0.8);
  rimB.position.set(3.8, 1.6, -2.6);
  const cursorLight = new THREE.PointLight(0xfff1de, 0, 6, 1.6);
  scene.add(key, rimA, rimB, cursorLight);

  // ---- desk: catches the shadow and fades into the fog ----
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- the lamp: centered, longest side = 2 units, standing on the desk ----
  const rig = new THREE.Group();          // scroll + drag rotate the rig
  scene.add(rig);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(modelUrl, (e) => {
      const p = e.total ? e.loaded / e.total : 0;
      document.documentElement.style.setProperty("--load", p.toFixed(3));
    });
  } catch { fail(); return null; }
  const model = gltf.scene;
  model.rotation.y = modelYaw;            // from the review page
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 2 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(s);
  model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.add(model);
  key.target = rig;
  rimA.target = rig;
  rimB.target = rig;

  // ---- the lamp's own light: a warm cone from the shade, a glow at the mouth, a pool on the desk ----
  const bulb = new THREE.Vector3(...lamp.at), pool = new THREE.Vector3(...lamp.pool);
  const lampLight = new THREE.SpotLight(amber, lamp.intensity, 8, 0.5, 0.9, 1.4);   // narrow enough to miss the brass base
  lampLight.position.copy(bulb);
  lampLight.castShadow = !LITE;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.002;
  const lampTarget = new THREE.Object3D();
  lampTarget.position.copy(pool);
  lampLight.target = lampTarget;
  const fill = new THREE.PointLight(amber, lamp.intensity * 0.05, 3, 2);   // lights the shade's inside
  fill.position.copy(bulb).lerp(pool, 0.08);
  const glowTex = radialTexture(amber);
  const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulbGlow.position.copy(bulb).lerp(pool, 0.06);
  bulbGlow.scale.setScalar(0.55);
  const deskPool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  deskPool.rotation.x = -Math.PI / 2;
  deskPool.position.set(pool.x, 0.003, pool.z);
  rig.add(lampLight, lampTarget, fill, bulbGlow, deskPool);

  // a soft visible beam from the shade to the desk, where the dust catches the light
  const beamLen = bulb.distanceTo(pool);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(beamLen * 0.55, beamLen, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(amber) }, uOpacity: { value: lamp.beam ?? 0.16 } },
      vertexShader: /* glsl */ `
        varying float vH; varying float vFacing;
        void main() {
          vH = uv.y;                                             // 0 at the desk, 1 at the bulb
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vFacing = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vH; varying float vFacing;
        void main() {
          float a = pow(vH, 1.6) * pow(vFacing, 2.0) * uOpacity;
          gl_FragColor = vec4(uColor, a);
        }`,
    })
  );
  const beamDir = bulb.clone().sub(pool).normalize();
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
  beam.position.copy(pool).add(bulb).multiplyScalar(0.5);
  beam.renderOrder = 2;
  rig.add(beam);

  // the room behind: a deep teal haze, like the hero still's wall
  const wall = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(css("--wall") || "#1E4A50"), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  wall.scale.set(22, 14, 1);
  wall.position.set(0, 1.6, -7);
  wall.renderOrder = -1;
  scene.add(wall);

  // ---- atmosphere: amber dust drifting through the lamplight ----
  const dust = makeDust(LITE ? 400 : 1400, amber, renderer.getPixelRatio(), { center: [pool.x * 0.7 + bulb.x * 0.3, 0, pool.z], spread: [3.0, 2.2, 2.4], size: 16, opacity: 1 });
  if (!REDUCED) rig.add(dust);

  // ---- post: gentle bloom on desktop only ----
  let composer = null;
  if (!LITE) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.5, 0.9));
    composer.addPass(new OutputPass());
  }

  // ---- scroll story: one camera keyframe per beat, scrubbed across #story ----
  const fit = () => (camera.aspect < 1 ? 1.9 : camera.aspect < 1.3 ? 1.25 : 1);   // pull back on tall screens
  const st = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, yaw: 0 };
  const setBeat = (b) => Object.assign(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2], yaw: b.yaw });
  setBeat(beats[0]);
  if (!REDUCED) {
    const tl = gsap.timeline({ defaults: { ease: "power1.inOut", duration: 1 } });
    beats.slice(1).forEach((b) => tl.to(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2], yaw: b.yaw }));
    ScrollTrigger.create({ trigger: "#story", start: "top top", end: "bottom bottom", scrub: 1, animation: tl });
  }

  // ---- after the story the stage dims behind the content sections ----
  gsap.to(".stage-dim", { opacity: 0.86, ease: "none",
    scrollTrigger: { trigger: "#story", start: "bottom 90%", end: "bottom 40%", scrub: true } });

  // ---- Explore: stage undims, drag to spin, hotspots show ----
  let exploring = false, dragYaw = 0, dragVel = 0, dragging = false, lastX = 0;
  ScrollTrigger.create({ trigger: "#explore", start: "top 60%", end: "bottom 40%",
    onToggle: (self) => {
      exploring = self.isActive;
      document.body.classList.toggle("exploring", exploring);   // CSS undims; never tween .stage-dim here
    } });
  const exploreEl = document.getElementById("explore");
  const dragZone = document.querySelector("#explore .explore__drag");
  dragZone?.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; dragZone.setPointerCapture?.(e.pointerId); });
  dragZone?.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragVel = (e.clientX - lastX) * 0.008;
    dragYaw += dragVel;
    lastX = e.clientX;
  });
  const endDrag = () => { dragging = false; };
  dragZone?.addEventListener("pointerup", endDrag);
  dragZone?.addEventListener("pointercancel", endDrag);

  // ---- light modes ----
  function setLightMode(name) {
    const m = lightModes[name];
    if (!m) return;
    gsap.to(renderer, { toneMappingExposure: m.exposure, duration: 0.8 });
    gsap.to(key, { intensity: m.key, duration: 0.8 });
    gsap.to(scene, { environmentIntensity: m.env ?? 0.35, duration: 0.8 });
    gsap.to(rimA, { intensity: m.rim, duration: 0.8 });
    gsap.to(rimB, { intensity: m.rim * 0.5, duration: 0.8 });
    gsap.to(lampLight, { intensity: m.lamp, duration: 0.8 });
    gsap.to(fill, { intensity: m.lamp * 0.05, duration: 0.8 });
    gsap.to(bulbGlow.material, { opacity: m.lamp > 0 ? 0.9 : 0, duration: 0.8 });
    gsap.to(deskPool.material, { opacity: m.lamp > 0 ? 0.32 : 0, duration: 0.8 });
    gsap.to(beam.material.uniforms.uOpacity, { value: m.lamp > 0 ? (lamp.beam ?? 0.16) : 0, duration: 0.8 });
    gsap.to(wall.material, { opacity: m.wall ?? 0.85, duration: 0.8 });
    const kc = new THREE.Color(m.keyColor || "#dfe9ea");
    gsap.to(key.color, { r: kc.r, g: kc.g, b: kc.b, duration: 0.8 });
    const c = new THREE.Color(m.fog);
    gsap.to(scene.fog.color, { r: c.r, g: c.g, b: c.b, duration: 0.8 });
    gsap.to(scene.background, { r: c.r, g: c.g, b: c.b, duration: 0.8 });
    document.querySelectorAll("[data-light]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.light === name)));
  }
  document.querySelectorAll("[data-light]").forEach((b) => b.addEventListener("click", () => setLightMode(b.dataset.light)));

  // ---- hotspots: points on the lamp, projected to HTML labels every frame ----
  const hs = hotspots.map((h) => ({ ...h, el: document.querySelector(`[data-hotspot="${h.id}"]`),
    p: new THREE.Vector3(...h.at), n: new THREE.Vector3(...h.normal).normalize() }));
  const tmp = new THREE.Vector3(), nW = new THREE.Vector3(), toCam = new THREE.Vector3();
  const back = new THREE.Vector3(), side = new THREE.Vector3();

  // ---- cursor ----
  const pointer = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });

  // ---- resize ----
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setSize(innerWidth, innerHeight);
  }
  addEventListener("resize", resize);
  resize();

  // ---- render loop with adaptive quality and pause when hidden or covered ----
  let frames = 0, acc = 0, last = performance.now(), fps = 60;
  const covers = [...document.querySelectorAll(".stage-cover")];   // solid sections: stop drawing while one fills the screen
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  const clock = new THREE.Clock();
  const covered = () => covers.some((c) => { const r = c.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; });

  function tick() {
    const now = performance.now(), dt = now - last;
    last = now;
    if (document.hidden || covered()) return;
    const t = clock.getElapsedTime();

    acc += dt; frames++;
    if (frames === 90) {
      fps = 1000 / (acc / frames);
      if (fps < 42 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      frames = 0; acc = 0;
    }

    // portrait screens: lamp centered and low, copy above it; landscape: the beat's side offset
    const k = fit(), portrait = camera.aspect < 1;
    camera.position.set(st.px * k, st.py * (portrait ? 1.1 : 1), st.pz * k);
    camera.lookAt(portrait ? 0 : st.lx, st.ly + (portrait ? 0.85 : 0), portrait ? 0 : st.lz);

    // the teal haze always sits behind the lamp, opposite the camera
    wall.position.set(-camera.position.x, 0, -camera.position.z).setLength(7);
    wall.position.y = 1.6;
    // rims ride high behind the lamp on either side, so they trace edges and never mirror off the flat base
    back.set(-camera.position.x, 0, -camera.position.z).normalize();
    side.set(-back.z, 0, back.x);
    rimA.position.copy(back).multiplyScalar(3).addScaledVector(side, 3).setY(4.2);
    rimB.position.copy(back).multiplyScalar(3).addScaledVector(side, -3.4).setY(3.6);
    key.position.copy(back).multiplyScalar(-4).addScaledVector(side, 2.5).setY(5);   // the soft key stays in front, up and to one side

    if (!dragging) { dragVel *= 0.94; dragYaw += dragVel; }
    const idle = REDUCED ? 0 : Math.sin(t * 0.25) * 0.05;
    rig.rotation.y = st.yaw + dragYaw + idle;
    rig.rotation.x += ((REDUCED ? 0 : pointer.y * 0.03) - rig.rotation.x) * 0.05;
    rig.updateMatrixWorld();

    if (!LITE) {
      cursorLight.intensity += ((exploring ? 4 : 1.5) - cursorLight.intensity) * 0.05;
      cursorLight.position.set(pointer.x * 2.2, 1.2 + pointer.y * 1.2, 2.4);
    }

    // the bulb breathes very slightly, like a warm filament
    if (!REDUCED) bulbGlow.material.opacity = Math.min(bulbGlow.material.opacity, 0.9) * (0.97 + Math.sin(t * 1.7) * 0.03);

    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uBoost.value = Math.min(2, Math.abs(lenis?.velocity || 0) * 0.02);

    // hotspots only while Explore really fills the view (a jump-scroll can outrun the toggle)
    const er = exploreEl?.getBoundingClientRect();
    const showHotspots = exploring && er && er.top < innerHeight * 0.6 && er.bottom > innerHeight * 0.4;
    for (const h of hs) {
      if (!h.el) continue;
      if (!showHotspots) { h.el.classList.add("is-hidden"); continue; }
      tmp.copy(h.p).applyMatrix4(rig.matrixWorld);
      nW.copy(h.n).transformDirection(rig.matrixWorld);
      toCam.copy(camera.position).sub(tmp).normalize();
      const facing = nW.dot(toCam) > 0.1;
      tmp.project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * innerWidth;
      h.el.style.transform = `translate(${sx}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px)`;
      h.el.classList.toggle("is-left", sx > innerWidth * 0.6);   // labels near the right edge open leftwards
      h.el.classList.toggle("is-hidden", !facing);
    }

    composer ? composer.render() : renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(tick);
  tick();
  document.body.classList.add("stage-ready");
  const api = { renderer, scene, camera, rig, model, setLightMode, setBeat, st, lampLight, get fps() { return fps; }, get dpr() { return dpr; }, get dragYaw() { return dragYaw; } };
  if (import.meta.env.DEV) window.__stage = api;
  return api;
}
