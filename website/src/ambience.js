// Weather and light inside the room: shafts of sun through each pane of the glass wall, dust that only
// shows where the sun catches it, rain running down the glass, and rain falling over the city outside.
import * as THREE from "three";

const GLASS = { x: -4.5, z0: -6, z1: 6, y0: 0.12, y1: 2.9, panes: 8 };

// ---- light shafts: two crossed soft sheets per pane, cast along the sun's direction ----
export function makeBeams() {
  const geo = new THREE.BufferGeometry();
  const quads = GLASS.panes * 2;
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(quads * 4 * 3), 3));
  const cross = new Float32Array(quads * 4), along = new Float32Array(quads * 4), seed = new Float32Array(quads * 4);
  const index = [];
  for (let q = 0; q < quads; q++) {
    const o = q * 4;
    cross.set([0, 1, 1, 0], o);
    along.set([0, 0, 1, 1], o);
    seed.fill(Math.floor(q / 2) + 0.37 * (q % 2), o, o + 4);
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  geo.setAttribute("aCross", new THREE.BufferAttribute(cross, 1));
  geo.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setIndex(index);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color("#FFE9C8") }, uStrength: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aCross, aAlong, aSeed;
      varying float vCross, vAlong, vSeed, vY;
      void main() {
        vCross = aCross; vAlong = aAlong; vSeed = aSeed;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vY = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength, uTime;
      varying float vCross, vAlong, vSeed, vY;
      void main() {
        float edge = pow(sin(3.14159 * vCross), 1.6);
        float along = smoothstep(0.0, 0.06, vAlong) * (1.0 - smoothstep(0.25, 1.0, vAlong));
        float floorFade = smoothstep(0.0, 0.5, vY);
        // clouds drifting past the sun: each pane brightens and dims on its own slow rhythm
        float drift = 0.55 + 0.45 * sin(uTime * 0.11 + vSeed * 1.9) * sin(uTime * 0.07 + vSeed * 3.1);
        float a = edge * along * floorFade * drift * uStrength * 0.45;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  // rebuild the sheets for a sun direction (dir points from the sun into the room)
  function aim(dir) {
    const len = Math.min(14, GLASS.y1 / Math.max(0.08, -dir.y) + 0.6);
    const p = geo.attributes.position.array;
    const w = (GLASS.z1 - GLASS.z0) / GLASS.panes, ym = (GLASS.y0 + GLASS.y1) / 2;
    const put = (o, x, y, z) => { p[o] = x; p[o + 1] = y; p[o + 2] = z; };
    for (let i = 0; i < GLASS.panes; i++) {
      const za = GLASS.z0 + i * w + 0.06, zb = za + w - 0.12, zc = (za + zb) / 2;
      const ends = [[GLASS.x, GLASS.y0, zc], [GLASS.x, GLASS.y1, zc]];                 // vertical sheet
      const ends2 = [[GLASS.x, ym, za], [GLASS.x, ym, zb]];                              // sheet across the pane
      [ends, ends2].forEach((e, k) => {
        const o = (i * 2 + k) * 12;
        put(o, ...e[0]); put(o + 3, ...e[1]);
        put(o + 6, e[1][0] + dir.x * len, e[1][1] + dir.y * len, e[1][2] + dir.z * len);
        put(o + 9, e[0][0] + dir.x * len, e[0][1] + dir.y * len, e[0][2] + dir.z * len);
      });
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { mesh, aim };
}

// ---- dust: everywhere along the glass side of the room, but only bright inside a sun shaft ----
export function makeBeamDust(count, pixelRatio) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), speed = new Float32Array(count), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = GLASS.x + 0.2 + Math.random() * 7.5;
    pos[i * 3 + 1] = Math.random() * 2.9;
    pos[i * 3 + 2] = -6 + Math.random() * 12.5;
    speed[i] = 0.4 + Math.random();
    phase[i] = Math.random() * 6.283;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color("#FFF2DE") },
      uSize: { value: 8 * pixelRatio }, uDir: { value: new THREE.Vector3(1, -0.5, 0).normalize() },
      uBeams: { value: 0 }, uAmbient: { value: 0.1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSpeed, aPhase;
      uniform float uTime, uBoost, uSize, uBeams, uAmbient;
      uniform vec3 uDir;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed * (0.04 + uBoost * 0.2), 2.9);
        p.x += sin(uTime * 0.3 * aSpeed + aPhase) * 0.12;
        p.z += cos(uTime * 0.25 * aSpeed + aPhase) * 0.10;
        // trace back along the sun to the glass: is this mote inside a lit pane?
        float s = (p.x - (${GLASS.x.toFixed(2)})) / max(uDir.x, 0.05);
        vec3 q = p - uDir * s;
        float f = fract((q.z - (${GLASS.z0.toFixed(1)})) / 1.5);
        float lit = step(0.0, s) * smoothstep(0.1, 0.3, q.y) * smoothstep(2.95, 2.7, q.y)
                  * step(${GLASS.z0.toFixed(1)}, q.z) * step(q.z, ${GLASS.z1.toFixed(1)})
                  * smoothstep(0.03, 0.1, f) * smoothstep(0.97, 0.9, f);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * aSpeed * (0.8 + lit * uBeams * 0.6) / -mv.z;
        float twinkle = 0.6 + 0.4 * sin(uTime * 1.3 * aSpeed + aPhase * 3.0);
        vAlpha = smoothstep(12.0, 1.0, -mv.z) * mix(uAmbient, 1.0, lit * uBeams) * twinkle;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uColor, d * d * vAlpha * 0.55);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

// ---- rain running down the inside view of the glass ----
export function makeGlassRain() {
  const W = GLASS.z1 - GLASS.z0, H = 3;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uLight: { value: new THREE.Color("#FFFFFF") } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = uv * vec2(${W.toFixed(1)}, ${H.toFixed(1)}); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uRain;
      uniform vec3 uLight;
      varying vec2 vP;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      // beads that land, sit and slowly dry
      vec2 beads(vec2 p, float t) {
        vec2 cell = p / 0.09, id = floor(cell), st = fract(cell) - 0.5;
        float n = hash(id);
        if (n < 0.6) return vec2(0.0);
        vec2 off = (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.6;
        float r = 0.12 + 0.2 * hash(id + 3.7);
        float life = fract(t * 0.05 + n * 7.0);
        float fade = smoothstep(0.0, 0.04, life) * smoothstep(1.0, 0.5, life);
        vec2 d = st - off;
        float body = smoothstep(r, r * 0.55, length(d * vec2(1.0, 0.9))) * fade;
        float spec = smoothstep(r * 0.4, r * 0.05, length(d - vec2(-0.3, 0.35) * r)) * fade;
        return vec2(body, spec);
      }
      // drops that run down a column, wiggling, leaving a dotted trail
      vec3 runs(vec2 p, float t) {
        float cw = 0.16;
        float col = floor(p.x / cw);
        float n = hash(vec2(col, 1.7));
        if (n < 0.55) return vec3(0.0);
        float speed = 0.18 + 0.35 * hash(vec2(col, 9.1));
        float yd = 3.2 - fract(t * speed * 0.33 + n * 5.0) * 3.6;                     // the drop's height on the glass
        float x0 = (col + 0.5 + (hash(vec2(col, 4.2)) - 0.5) * 0.5) * cw + sin(p.y * 9.0 + n * 6.0) * 0.012;
        vec2 d = (p - vec2(x0, yd)) * vec2(1.0, 0.75);
        float body = smoothstep(0.028, 0.016, length(d));
        float spec = smoothstep(0.012, 0.002, length(d - vec2(-0.008, 0.01)));
        float above = step(yd, p.y) * smoothstep(yd + 0.6, yd + 0.05, p.y);
        float trail = smoothstep(0.006, 0.0015, abs(p.x - x0)) * above * smoothstep(0.35, 0.9, sin(p.y * 70.0 + n * 20.0));
        return vec3(body, spec, trail);
      }
      void main() {
        if (uRain <= 0.001) discard;
        vec2 b1 = beads(vP, uTime), b2 = beads(vP * 1.7 + 3.1, uTime * 1.3);
        vec3 r = runs(vP, uTime);
        float body = max(max(b1.x, b2.x * 0.7), max(r.x, r.z * 0.8));
        float spec = max(max(b1.y, b2.y * 0.7), r.y);
        // a wet sheen over the glass, darker drop bodies, bright pin highlights
        vec3 col = mix(vec3(0.62, 0.68, 0.72) * uLight, vec3(0.13, 0.17, 0.2), body);
        col = mix(col, uLight, spec);
        float a = (0.05 + body * 0.42 + spec * 0.75) * uRain;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  glass.rotation.y = Math.PI / 2;                       // faces into the room
  glass.position.set(GLASS.x + 0.03, H / 2, (GLASS.z0 + GLASS.z1) / 2);
  glass.renderOrder = 6;
  return glass;
}

// ---- rain over the city: fast thin streaks just outside the glass ----
export function makeCityRain(count, pixelRatio) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = -6 - Math.random() * 30;
    pos[i * 3 + 1] = Math.random() * 24 - 12;
    pos[i * 3 + 2] = -24 + Math.random() * 44;
    speed[i] = 0.7 + Math.random() * 0.6;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uSize: { value: 90 * pixelRatio }, uColor: { value: new THREE.Color("#D5DEE4") } },
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      uniform float uTime, uSize;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * 11.0 * aSpeed, 24.0) - 12.0;
        p.z += p.y * 0.08;                                     // a little wind
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize / -mv.z;
        vAlpha = smoothstep(40.0, 6.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uRain;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float streak = smoothstep(0.5, 0.0, length(c * vec2(14.0, 1.0)));
        gl_FragColor = vec4(uColor, streak * vAlpha * uRain * 0.35);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
