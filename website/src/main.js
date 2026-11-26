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

// three.js loads after the page text, so the poster and copy paint first.
// ?nostage shows the poster fallback (the same view a phone gets if WebGL fails).
let room = null;
if (new URLSearchParams(location.search).has("nostage")) document.body.classList.add("stage-failed");
else import("./room.js").then(({ initRoom }) => initRoom({ lenis })).then((r) => { room = r; });

// going to the booking page from the top of the story: fly into the laptop screen, fade to the page colour,
// then load book.html (which fades in on its own)
let leaving = false;
async function goTo(url) {
  if (leaving) return;
  const nearTop = scrollY < innerHeight * 1.2;
  if (!room || REDUCED || !nearTop || !document.body.classList.contains("stage-ready")) { location.href = url; return; }
  leaving = true;
  document.querySelector("#account")?.open && document.querySelector("#account").close();
  document.body.classList.add("is-flying");          // the page's copy steps aside while the camera moves
  await room.flyInto();
  document.body.classList.add("is-leaving");
  setTimeout(() => { location.href = url; }, 280);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href$="book.html"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank") return;
  e.preventDefault();
  goTo(a.href);
});
document.addEventListener("st:navigate", (e) => { e.preventDefault(); goTo(e.detail.url); });
addEventListener("pageshow", (e) => { if (e.persisted) { leaving = false; document.body.classList.remove("is-leaving", "is-flying"); room?.release(true); } });

if (import.meta.env.DEV) { window.__lenis = lenis; window.__ST = ScrollTrigger; }
