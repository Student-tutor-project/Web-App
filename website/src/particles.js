// Shared 3D helpers: slow dust motes drifting in the sunlight, and a soft radial glow texture.
import * as THREE from "three";

export function radialTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dust: round soft points that sink slowly and sway sideways, brightest near `center`.
export function makeDust(count, color, pixelRatio, { center = [0, 0.8, 0], spread = [3, 2.4, 2.4], size = 9, opacity = 0.75 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), speed = new Float32Array(count), phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = Math.random() * spread[1];
    pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * spread[2];
    speed[i] = 0.4 + Math.random();
    phase[i] = Math.random() * 6.283;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uSize: { value: size * pixelRatio }, uOpacity: { value: opacity },
      uCenter: { value: new THREE.Vector3(...center) }, uHeight: { value: spread[1] },
    },
    vertexShader: /* glsl */ `
      attribute float aSpeed, aPhase;
      uniform float uTime, uBoost, uSize, uHeight;
      uniform vec3 uCenter;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed * (0.05 + uBoost * 0.2), uHeight);        // sink slowly, wrap
        p.x += sin(uTime * 0.3 * aSpeed + aPhase) * 0.12;                           // sway
        p.z += cos(uTime * 0.25 * aSpeed + aPhase) * 0.10;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * aSpeed / -mv.z;
        float near = 1.0 - smoothstep(0.4, 1.8, distance(p.xz, uCenter.xz));     // brightest in the beam
        float twinkle = 0.6 + 0.4 * sin(uTime * 1.3 * aSpeed + aPhase * 3.0);
        vAlpha = smoothstep(12.0, 1.0, -mv.z) * (0.25 + 0.75 * near) * twinkle;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float dot_ = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, dot_ * dot_ * vAlpha * uOpacity);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
