// The room's light follows the real time in Singapore: cool mornings, sun pouring through the west-facing
// glass in the afternoon, a golden hour, a blue hour, then a lamp-lit room above a glowing city at night.
// Some afternoons a storm rolls in, the way it does in Singapore around 3 to 5pm.
// Preview any time with ?hour=18.4 and force the weather with ?rain or ?rain=0.
import * as THREE from "three";

// key moments of the day; everything in between is blended
const KEYS = [
  { h: 0,    sky: ["#0B1420", "#1E2E40"], fog: "#142030", sun: ["#9FB6D6", 0.0, 8, 3],   hemi: 0.22, win: ["#5C7896", 0.35], lamp: ["#FFE2BC", 8], panel: "#FFE4C0", exposure: 0.95, glow: 1.4,    clouds: 0.12, env: 0.12 },
  { h: 5.6,  sky: ["#0B1420", "#1E2E40"], fog: "#142030", sun: ["#9FB6D6", 0.0, 8, 3],   hemi: 0.22, win: ["#5C7896", 0.35], lamp: ["#FFE2BC", 8], panel: "#FFE4C0", exposure: 0.95, glow: 1.4,    clouds: 0.12, env: 0.12 },
  { h: 6.7,  sky: ["#5B7DA6", "#F2C9A8"], fog: "#D9C2B4", sun: ["#FFC89A", 0.7, 4, 5],   hemi: 0.3,  win: ["#F0D8C8", 1.0],  lamp: ["#FFF0DA", 2.8], panel: "#FFF4E6", exposure: 0.86, glow: 0.8,    clouds: 0.55, env: 0.3 },
  { h: 8.8,  sky: ["#7FA9CC", "#E6EFF4"], fog: "#DCE8EF", sun: ["#FFF6EC", 1.3, 40, 4],  hemi: 0.5,  win: ["#E6F1F8", 1.8],  lamp: ["#F2F6F8", 2.3], panel: "#FFFFFF", exposure: 0.82, glow: 0.3,    clouds: 0.7,  env: 0.4 },
  { h: 12.5, sky: ["#7FA9CC", "#E6EFF4"], fog: "#DCE8EF", sun: ["#FFF4E6", 4, 33, 2],  hemi: 0.42, win: ["#E6F1F8", 1.35],  lamp: ["#F2F6F8", 2.5], panel: "#FFFFFF", exposure: 0.82, glow: 0.35, clouds: 0.7,  env: 0.4 },
  { h: 16,   sky: ["#76A0C6", "#EAEFEF"], fog: "#E0E6E6", sun: ["#FFEBD2", 8, 21, 0],  hemi: 0.35, win: ["#EEF0EC", 1.0],  lamp: ["#F4F4F0", 2.4], panel: "#FFFFFF", exposure: 0.82, glow: 0.35, clouds: 0.7, env: 0.4 },
  { h: 18.3, sky: ["#6F93BC", "#F6D2A6"], fog: "#EBD3BC", sun: ["#FFC37E", 8.5, 9, -1.5], hemi: 0.32, win: ["#FFE0BE", 0.95], lamp: ["#FFF0DE", 2.6], panel: "#FFF6EA", exposure: 0.85, glow: 0.55,   clouds: 0.6,  env: 0.34 },
  { h: 19.2, sky: ["#2C4468", "#E0957A"], fog: "#6A6378", sun: ["#FF9A6A", 0.5, 1.5, -2.5], hemi: 0.24, win: ["#9DB0D0", 0.7], lamp: ["#FFE6C8", 5.5], panel: "#FFEAD0", exposure: 0.9, glow: 1.2, clouds: 0.35, env: 0.22 },
  { h: 20.1, sky: ["#0E1825", "#22344A"], fog: "#16222F", sun: ["#9FB6D6", 0.0, 8, 3],   hemi: 0.22, win: ["#5C7896", 0.4],  lamp: ["#FFE2BC", 8], panel: "#FFE4C0", exposure: 0.95, glow: 1.4,    clouds: 0.14, env: 0.12 },
  { h: 24,   sky: ["#0B1420", "#1E2E40"], fog: "#142030", sun: ["#9FB6D6", 0.0, 8, 3],   hemi: 0.22, win: ["#5C7896", 0.35], lamp: ["#FFE2BC", 8], panel: "#FFE4C0", exposure: 0.95, glow: 1.4,    clouds: 0.12, env: 0.12 },
];

const q = new URLSearchParams(location.search);

// hours since midnight in Singapore, e.g. 16.5 for 4:30pm
export function singaporeHour(now = new Date()) {
  if (import.meta.env.DEV && window.__hour != null) return window.__hour;
  const forced = parseFloat(q.get("hour"));
  if (Number.isFinite(forced)) return ((forced % 24) + 24) % 24;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return get("hour") + get("minute") / 60;
}

// 0 to 1: how hard it is raining. Afternoon storms on roughly half the days, 3pm to 5:30pm.
export function rainLevel(hour, now = new Date()) {
  if (import.meta.env.DEV && window.__rain != null) return window.__rain;
  if (q.has("rain")) return q.get("rain") === "0" ? 0 : 1;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);   // 2026-11-26
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) % 100003;
  const stormy = ((seed * 9301 + 49297) % 233280) / 233280 < 0.45;
  if (!stormy) return 0;
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return Math.min(ramp(15, 15.4, hour), 1 - ramp(17.1, 17.5, hour));
}

const c1 = new THREE.Color(), c2 = new THREE.Color();
const mixColor = (a, b, t) => "#" + c1.set(a).lerp(c2.set(b), t).getHexString();
const mix = (a, b, t) => a + (b - a) * t;

// the blended light for an hour, then pulled towards grey storm light by the rain level
export function lightAt(hour, rain = 0) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)));
  const s = t * t * (3 - 2 * t);
  const L = {
    sky: [mixColor(a.sky[0], b.sky[0], s), mixColor(a.sky[1], b.sky[1], s)],
    fog: mixColor(a.fog, b.fog, s),
    sun: { color: mixColor(a.sun[0], b.sun[0], s), intensity: mix(a.sun[1], b.sun[1], s), elevation: mix(a.sun[2], b.sun[2], s), z: mix(a.sun[3], b.sun[3], s) },
    hemi: mix(a.hemi, b.hemi, s),
    win: { color: mixColor(a.win[0], b.win[0], s), intensity: mix(a.win[1], b.win[1], s) },
    lamp: { color: mixColor(a.lamp[0], b.lamp[0], s), intensity: mix(a.lamp[1], b.lamp[1], s) },
    panel: mixColor(a.panel, b.panel, s),
    exposure: mix(a.exposure, b.exposure, s),
    glow: mix(a.glow, b.glow, s),
    clouds: mix(a.clouds, b.clouds, s),
    env: mix(a.env, b.env, s),
    night: 1 - Math.min(1, mix(a.sun[1], b.sun[1], s) / 0.7),   // 1 in the dark, 0 once the sun is up
    rain,
  };
  if (rain > 0) {
    const day = 1 - L.night;
    L.sky = [mixColor(L.sky[0], "#7D8C98", rain * day), mixColor(L.sky[1], "#AEB9C1", rain * day)];
    L.fog = mixColor(L.fog, "#9AA6AF", rain * day);
    L.sun.intensity *= 1 - 0.8 * rain;
    L.win.color = mixColor(L.win.color, "#C9D3DA", rain);
    L.clouds = mix(L.clouds, 0.9, rain);
    L.glow += 0.25 * rain;
  }
  return L;
}
