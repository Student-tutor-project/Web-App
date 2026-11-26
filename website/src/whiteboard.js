// The whiteboard on the slate wall. The board itself is a lit 3D object; the working-out on it is live
// SVG pinned in 3D with CSS3DRenderer (never baked into a texture), drawn stroke by stroke as the
// visitor scrolls into the "explained the way kids get it" beat.
import * as THREE from "three";
import { CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";

// on the right-hand wall (x = 5.5), facing into the room
export const BOARD = { x: 5.5, y: 1.6, z: -1.3, ry: -Math.PI / 2, w: 2.1, h: 1.02 };
const VW = 1150, VH = 560;                 // the SVG's own units: 500 per metre

// single-stroke marker glyphs in a 40 x 60 box (absolute M, L and Q only, so they can be scaled by hand)
const GLYPH = {
  "1": ["M10 14 L22 4 L22 56"],
  "3": ["M6 12 Q18 0 30 8 Q38 18 22 28 Q38 32 34 46 Q26 60 6 50"],
  "4": ["M27 56 L27 4 L4 40 L37 40"],
  "6": ["M31 8 Q14 2 9 28 Q6 56 22 56 Q36 55 34 40 Q31 28 19 30 Q10 32 9 40"],
  "7": ["M4 7 L35 6 Q22 28 15 56"],
  "8": ["M20 30 Q5 23 10 11 Q20 1 30 10 Q36 22 20 30 Q3 38 8 50 Q20 62 32 50 Q38 38 20 30"],
  "?": ["M8 15 Q11 3 22 4 Q34 7 31 19 Q28 27 20 32 L20 42", "M20 53 L20.6 55"],
  "+": ["M5 31 L36 31", "M20 15 L20 47"],
  "=": ["M5 24 L36 24", "M5 38 L36 38"],
};

// scale and move a glyph path
function place(d, x, y, s, wob) {
  let k = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n), isX = k++ % 2 === 0;
    return (isX ? x + v * s + wob * (isX ? 1 : 0) : y + v * s).toFixed(1);
  });
}

// lay out the working-out; returns stroke paths in drawing order
function workingOut() {
  const strokes = [];
  let jitter = 0;
  const glyph = (ch, x, y, s = 1) => { jitter = (jitter * 7 + 3) % 5; for (const d of GLYPH[ch]) strokes.push({ d: place(d, x, y, s, (jitter - 2) * 0.6) }); };
  const bar = (x, y, w) => strokes.push({ d: `M${x} ${y} Q${x + w / 2} ${y - 2} ${x + w} ${y + 1}` });
  const frac = (n, d, x, y) => { glyph(n, x + 4, y, 0.62); bar(x - 2, y + 44, 40); glyph(d, x + 4, y + 52, 0.62); };

  // line 1:   3/4 + 1/8 = ?
  frac("3", "4", 60, 46); glyph("+", 130, 70, 0.8); frac("1", "8", 190, 46); glyph("=", 262, 70, 0.8); glyph("?", 330, 62, 0.95);
  // line 2:   = 6/8 + 1/8
  glyph("=", 60, 262, 0.8); frac("6", "8", 128, 238); glyph("+", 196, 262, 0.8); frac("1", "8", 256, 238);
  // line 3:   = 7/8, circled, with a tick
  glyph("=", 60, 438, 0.8); frac("7", "8", 128, 414);
  strokes.push({ d: "M118 398 Q96 470 150 506 Q206 520 214 460 Q216 404 170 392 Q140 386 120 404", accent: true });
  strokes.push({ d: "M262 470 L284 494 L332 430", accent: true });
  return strokes;
}

// the pie: eight slices, seven shaded one after another
function pie(cx, cy, r) {
  const out = { ring: `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx + r - 0.1} ${cy - 2}`, spokes: [], slices: [] };
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4, b = a + Math.PI / 4;
    out.spokes.push(`M${cx} ${cy} L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
    if (i < 7) out.slices.push(`M${cx} ${cy} L${(cx + Math.cos(a) * r * 0.96).toFixed(1)} ${(cy + Math.sin(a) * r * 0.96).toFixed(1)} A${r * 0.96} ${r * 0.96} 0 0 1 ${(cx + Math.cos(b) * r * 0.96).toFixed(1)} ${(cy + Math.sin(b) * r * 0.96).toFixed(1)} Z`);
  }
  return out;
}

export function makeWhiteboard() {
  const group = new THREE.Group();          // built facing +z at the origin, then hung on the wall
  group.position.set(BOARD.x, BOARD.y, BOARD.z);
  group.rotation.y = BOARD.ry;
  // the board: a pale, slightly glossy surface in a thin aluminium frame, on the slate wall
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h),
    new THREE.MeshStandardMaterial({ color: "#EEF1F2", roughness: 0.28, metalness: 0, envMapIntensity: 0.5 }));
  surface.position.set(0, 0, 0.012);
  surface.receiveShadow = true;
  const frameMat = new THREE.MeshStandardMaterial({ color: "#B9C3C8", roughness: 0.35, metalness: 0.8 });
  const t = 0.025, d = 0.022;
  for (const [w, h, x, y] of [[BOARD.w + t * 2, t, 0, BOARD.h / 2 + t / 2], [BOARD.w + t * 2, t, 0, -BOARD.h / 2 - t / 2], [t, BOARD.h, BOARD.w / 2 + t / 2, 0], [t, BOARD.h, -BOARD.w / 2 - t / 2, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    bar.position.set(x, y, d / 2);
    bar.castShadow = true;
    group.add(bar);
  }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w * 0.6, 0.02, 0.07), frameMat);
  tray.position.set(0.2, 0 - BOARD.h / 2 - 0.04, 0.04);
  tray.castShadow = true;
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 12), new THREE.MeshStandardMaterial({ color: "#2B5C86", roughness: 0.5 }));
  marker.rotation.z = Math.PI / 2 - 0.08;
  marker.position.set(0.35, 0 - BOARD.h / 2 - 0.02, 0.045);
  group.add(surface, tray, marker);

  // the working-out, as SVG in the page
  const strokes = workingOut();
  const p = pie(880, 250, 150);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        ${strokes.map((s) => `<path class="wb-ink${s.accent ? " wb-ink--accent" : ""}" d="${s.d}" pathLength="1" />`).join("")}
        ${p.slices.map((d) => `<path class="wb-fill" d="${d}" />`).join("")}
        <path class="wb-ink wb-ink--thin" d="${p.ring}" pathLength="1" />
        ${p.spokes.map((d) => `<path class="wb-ink wb-ink--thin" d="${d}" pathLength="1" />`).join("")}
      </g>
    </svg>`;
  const el = document.createElement("div");
  el.className = "wb";
  el.setAttribute("aria-hidden", "true");
  el.style.width = `${VW}px`;
  el.style.height = `${VH}px`;
  el.innerHTML = svg;
  const ink = new CSS3DObject(el);
  ink.position.set(BOARD.x + Math.sin(BOARD.ry) * 0.014, BOARD.y, BOARD.z + Math.cos(BOARD.ry) * 0.014);
  ink.rotation.y = BOARD.ry;
  ink.scale.setScalar(BOARD.w / VW);

  // drawing order: the sum, the pie and its shading, then the working and the answer
  const lines = [...el.querySelectorAll(".wb-ink")];
  const fills = [...el.querySelectorAll(".wb-fill")];
  const sumCount = 12, pieInk = lines.slice(strokes.length);
  const order = [...lines.slice(0, sumCount), ...pieInk, "fills", ...lines.slice(sumCount, strokes.length)];

  // progress 0..1 draws everything up to that point
  function draw(progress) {
    const steps = order.length;
    order.forEach((item, i) => {
      const local = Math.min(1, Math.max(0, progress * steps - i));
      if (item === "fills") fills.forEach((f, k) => { f.style.opacity = (Math.min(1, Math.max(0, local * fills.length - k)) * 0.32).toFixed(3); });
      else item.style.strokeDashoffset = (1 - local).toFixed(3);
    });
  }
  draw(0);
  return { group, ink, draw, el };
}
