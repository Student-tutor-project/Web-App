import "./style.css";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initBooking } from "./booking.js";
import { initAccount } from "./account.js";
gsap.registerPlugin(ScrollTrigger);
if ("scrollRestoration" in history) history.scrollRestoration = "manual";   // the story always starts at beat one

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lenis = new Lenis({ lerp: REDUCED ? 1 : 0.1, smoothWheel: !REDUCED });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// in-page links go through Lenis so they glide instead of jumping
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href");
  const el = id.length > 1 && document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  lenis.scrollTo(el, { offset: -64, duration: REDUCED ? 0 : 1.2 });
  if (id === "#book") setTimeout(() => document.querySelector("#book .chip")?.focus({ preventScroll: true }), REDUCED ? 0 : 1250);
}));

initBooking();
initAccount({ lenis });

// three.js loads after the page text, so the poster and copy paint first
const modelUrl = new URLSearchParams(location.search).get("model") || "/model/product.glb";   // ?model= is for the fallback test
import("./stage.js").then(({ initStage }) => initStage({
  modelUrl: modelUrl.startsWith("/") ? `.${modelUrl}` : modelUrl,
  lenis,
  modelYaw: -1.57,
  // The lamp's own light, in model space: the bulb inside the shade and the pool it throws on the desk
  lamp: { at: [-0.42, 1.36, 0], pool: [-1.25, 0, 0.05], intensity: 32 },
  beats: [
    { pos: [-1.7, 1.4, 6.0], look: [-1.2, 1.0, -0.34], yaw: 0 },       // 1 hero three-quarter, lamp right
    { pos: [2.0, 1.55, 2.1], look: [1.05, 1.15, -0.1], yaw: 0 },       // 2 brass hinge macro, lamp left
    { pos: [1.8, 0.7, 5.6], look: [-1.14, 1.05, 0.36], yaw: 0.3 },     // 3 low side profile, lamp right
    { pos: [1.5, 4.2, 8.5], look: [1.67, 0.8, -0.29], yaw: 0.5 },      // 4 wide desk view from above, lamp left and small
    { pos: [-4.6, 1.3, 3.6], look: [-0.56, 0.95, -0.71], yaw: 0 },     // 5 resting front view, lamp right
  ],
  hotspots: [
    { id: "shade", at: [-0.62, 1.5, 0.2], normal: [-0.8, 0.3, 0.6] },
    { id: "hinge", at: [0.62, 1.16, 0.1], normal: [0, 0, 1] },
    { id: "base", at: [-0.08, 0.15, 0.4], normal: [-0.3, 0.5, 1] },
  ],
  lightModes: {
    desk:    { exposure: 1.0,  key: 0.6,  rim: 18, lamp: 32, fog: "#0B1519", wall: 0.85 },
    late:    { exposure: 0.85, key: 0.12, rim: 30, lamp: 42, fog: "#071014", wall: 0.4 },
    morning: { exposure: 0.95, key: 0.9,  rim: 8,  lamp: 0,  fog: "#1B2C33", keyColor: "#fff1dc", wall: 1, env: 0.6 },
  },
}));

if (import.meta.env.DEV) { window.__lenis = lenis; window.__ST = ScrollTrigger; }
