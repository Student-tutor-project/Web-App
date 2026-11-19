// The three-step booking flow. Plain DOM, no 3D, nothing sent anywhere yet:
// contact details are placeholders, so a finished booking shows a confirmation on the page only.

// Sample profiles for the preview. Replace with real, verified tutors before launch.
const TUTORS = [
  { name: "Wei Ling T.", school: "JC2", note: "A1 for O-Level E-Math and Chemistry", subjects: ["Maths", "Science"], stages: ["Secondary"], rate: 30, modes: ["Online", "In person"] },
  { name: "Arjun S.", school: "University, Year 1", note: "Taught his younger cousins through PSLE Maths", subjects: ["Maths", "Science"], stages: ["Primary", "Secondary"], rate: 28, modes: ["Online"] },
  { name: "Hui Min L.", school: "Secondary 4", note: "AL1 for PSLE Maths and Science", subjects: ["Maths", "Science"], stages: ["Primary"], rate: 20, modes: ["Online", "In person"] },
  { name: "Nur Aisyah R.", school: "JC1", note: "A1 for O-Level English, school debate team", subjects: ["English"], stages: ["Primary", "Secondary"], rate: 25, modes: ["Online", "In person"] },
  { name: "Jun Hao C.", school: "Secondary 4", note: "AL1 for PSLE Chinese and Higher Chinese", subjects: ["Chinese", "Maths"], stages: ["Primary"], rate: 20, modes: ["Online"] },
  { name: "Priya M.", school: "University, Year 2", note: "A1 for O-Level English and Literature", subjects: ["English"], stages: ["Secondary"], rate: 32, modes: ["Online", "In person"] },
  { name: "Ethan K.", school: "JC2", note: "A1 for O-Level Chinese", subjects: ["Chinese"], stages: ["Primary", "Secondary"], rate: 26, modes: ["Online", "In person"] },
];

export function initBooking() {
  const form = document.getElementById("booking");
  if (!form) return;
  const state = { subject: "", level: "", mode: "Online", tutor: null, day: "", time: "" };
  const steps = [...form.querySelectorAll(".step")];
  const dots = [...document.querySelectorAll("[data-step-dot]")];
  const arcs = [...document.querySelectorAll(".steps__arc")];
  let current = 1;

  // ---- radio-style chip groups (arrow keys move, Enter/Space pick) ----
  function wireChips(group) {
    const name = group.dataset.name;
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      pick(group, chip);
    });
    group.addEventListener("keydown", (e) => {
      const chips = [...group.querySelectorAll(".chip")];
      const i = chips.indexOf(document.activeElement);
      if (i < 0) return;
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = chips[(i + dir + chips.length) % chips.length];
      next.focus();
      pick(group, next);
    });
    function pick(g, chip) {
      g.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", String(c === chip)));
      state[name] = chip.dataset.value;
      clearError();
    }
  }
  form.querySelectorAll(".chips").forEach(wireChips);
  form.querySelector("#level").addEventListener("change", (e) => { state.level = e.target.value; clearError(); });

  // ---- days: the next seven, starting tomorrow ----
  const dayGroup = form.querySelector(".chips--days");
  const fmt = new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short" });
  for (let d = 1; d <= 7; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const label = fmt.format(date);
    const b = document.createElement("button");
    Object.assign(b, { type: "button", className: "chip", textContent: label });
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.dataset.value = label;
    dayGroup.appendChild(b);
  }

  // ---- tutors for the chosen subject, level and place ----
  const tutorList = form.querySelector(".tutors");
  function renderTutors() {
    const stage = state.level.startsWith("Primary") ? "Primary" : "Secondary";
    const modeKey = state.mode === "Online" ? "Online" : "In person";
    const list = TUTORS.filter((t) => t.subjects.includes(state.subject) && t.stages.includes(stage) && t.modes.includes(modeKey));
    tutorList.innerHTML = "";
    if (!list.length) {
      tutorList.innerHTML = `<p class="tutors__empty">No tutors for ${state.subject} at ${state.level} ${state.mode === "Online" ? "online" : "in person"} yet. Go back and try ${state.mode === "Online" ? "in person" : "online"}, or another subject.</p>`;
      return;
    }
    list.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tutor";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(state.tutor?.name === t.name));
      b.innerHTML = `<span class="tutor__name">${t.name}</span><span class="tutor__school">${t.school}</span><span class="tutor__note">${t.note}</span><span class="tutor__rate">S$${t.rate} an hour</span><span class="tutor__check">Grades checked</span>`;
      b.addEventListener("click", () => {
        state.tutor = t;
        tutorList.querySelectorAll(".tutor").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        clearError();
      });
      tutorList.appendChild(b);
    });
  }

  // ---- errors say what is missing and how to fix it ----
  const errorEl = () => steps[current - 1]?.querySelector(".error");
  function showError(msg) { const el = errorEl(); if (el) { el.textContent = msg; el.hidden = false; } }
  function clearError() { const el = errorEl(); if (el) el.hidden = true; }

  function validate(step) {
    if (step === 1) {
      if (!state.subject) return "Choose a subject to see tutors.";
      if (!state.level) return "Choose your child's level to see tutors.";
    }
    if (step === 2 && !state.tutor) return "Choose one of the tutors to continue.";
    if (step === 3) {
      if (!state.day) return "Choose a day for the first lesson.";
      if (!state.time) return "Choose a time for the first lesson.";
      const name = form.querySelector("#pname").value.trim();
      const phone = form.querySelector("#phone").value.replace(/\s+/g, "");
      if (!name) return "Add your name so the tutor knows who to expect.";
      if (!/^(\+65)?[3689]\d{7}$/.test(phone)) return "Enter an 8-digit Singapore number, like 8123 4567.";
    }
    return "";
  }

  function go(step) {
    current = step;
    steps.forEach((s) => s.classList.toggle("is-active", s.dataset.step === String(step)));
    dots.forEach((d) => {
      const n = Number(d.dataset.stepDot);
      d.classList.toggle("is-current", n === step);
      d.classList.toggle("is-done", step === "done" || n < step);
    });
    arcs.forEach((a, i) => a.classList.toggle("is-done", step === "done" || i + 1 < step));
    if (step === 2) renderTutors();
    if (step === 3) renderSummary();
    const active = steps.find((s) => s.classList.contains("is-active"));
    const focusEl = step === "done" ? active : active?.querySelector("legend, h3");
    if (focusEl) { focusEl.setAttribute("tabindex", "-1"); focusEl.focus({ preventScroll: true }); }
  }

  function renderSummary() {
    const t = state.tutor;
    form.querySelector(".summary").innerHTML = t
      ? `<p>${state.subject}, ${state.level}, ${state.mode.toLowerCase()} with <strong>${t.name}</strong> at S$${t.rate} an hour.</p>`
      : "";
  }

  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) {
      const err = validate(current);
      if (err) return showError(err);
      go(current + 1);
    }
    if (e.target.closest("[data-back]")) go(current - 1);
    if (e.target.closest("[data-restart]")) {
      Object.assign(state, { subject: "", level: "", mode: "Online", tutor: null, day: "", time: "" });
      form.reset();
      form.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.value === "Online")));
      go(1);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validate(3);
    if (err) return showError(err);
    const first = state.tutor.name.split(" ")[0];
    form.querySelector(".done__text").textContent =
      `${state.subject} with ${state.tutor.name}, ${state.day} at ${state.time}. ${first} will message you on WhatsApp to confirm the details.`;
    go("done");
  });
}
