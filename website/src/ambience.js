// Weather: rain running down the glass wall, and rain falling over the city outside.
// daylight.js decides when it rains (some afternoons in Singapore, 3 to 5:30pm).
import * as THREE from "three";

const GLASS = { x: -4.5, z0: -6, z1: 6, y0: 0.12, y1: 2.9, panes: 8 };

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
