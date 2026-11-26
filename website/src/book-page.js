// The booking page. Parents find a tutor and book one of their open hours; student tutors keep a
// profile and open or close hours on a week timetable. Everything is stored in Supabase
// (tables: tutor_profiles, tutor_private, slots, bookings; functions: book_slot, cancel_booking).
// All lessons are online: one hour on the tutor's own reusable Google Meet or Zoom link.
import "./style.css";
import { supabase } from "./supabase.js";
import { initAccount } from "./account.js";

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);   // lessons can start 8am to 8pm
const WEEKS_AHEAD = 4;
const LEVELS = { Primary: [1, 2, 3, 4, 5, 6], Secondary: [1, 2, 3, 4, 5] };
const fDay = new Intl.DateTimeFormat("en-SG", { weekday: "short" });
const fDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" });
const fLong = new Intl.DateTimeFormat("en-SG", { weekday: "long", day: "numeric", month: "long" });
const hourLabel = (h) => (h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);
const timeRange = (d, mins = 60) => {
  const end = new Date(d.getTime() + mins * 60000);
  const t = (x) => x.toLocaleTimeString("en-SG", { hour: "numeric", minute: x.getMinutes() ? "2-digit" : undefined }).replace(/\s/g, "").toLowerCase();
  return `${t(d)} to ${t(end)}`;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stageOf = (level) => (level.startsWith("Primary") ? "Primary" : "Secondary");
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const keyOf = (d) => d.toISOString();

const ERRORS = [
  [/just been taken/i, "Someone booked that hour a moment ago. Choose another lit hour."],
  [/overlaps/i, "That hour overlaps another of your open hours. Close the other one first."],
  [/duplicate key|unique/i, "That hour is already open."],
  [/row-level security|permission/i, "Your account can't do that. Log out and log in again, then try once more."],
  [/fetch|network/i, "We couldn't reach the server. Check your connection and try again."],
];
// one reusable Google Meet or Zoom link per tutor
const MEET_LINK = /^https:\/\/(meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?\S*)?|([a-z0-9-]+\.)?zoom\.us\/(j|my)\/\S+)$/i;
const LINK_HELP = "Paste a Google Meet or Zoom link, like https://meet.google.com/abc-defg-hij or https://zoom.us/j/1234567890.";
const explain = (e) => (ERRORS.find(([re]) => re.test(e?.message || "")) || [null, `Something went wrong: ${e?.message || "unknown error"}. Try again.`])[1];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

initAccount();
fillLevels();

let user = null, role = null, week = 0;
const views = $$("[data-view]");
const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });

if (!supabase) {
  show("out");
  $('[data-view="out"] p').textContent = "Accounts aren't set up on this copy of the site yet, so booking is switched off.";
} else {
  supabase.auth.getSession().then(({ data }) => route(data.session?.user || null));
  supabase.auth.onAuthStateChange((_e, session) => {
    const next = session?.user || null;
    if ((next?.id || null) !== (user?.id || null)) route(next);
  });
}

function route(u) {
  user = u;
  const who = $(".bar__who");
  if (!u) { role = null; who.hidden = true; show("out"); return; }
  role = u.user_metadata?.role === "tutor" ? "tutor" : "parent";   // older "student" accounts book like parents
  const first = (u.user_metadata?.full_name || "").split(" ")[0];
  who.hidden = !first;
  who.textContent = first ? `${first}, ${role === "tutor" ? "student tutor" : "parent"}` : "";
  week = 0;
  show(role);
  (role === "tutor" ? Tutor : Parent).load();
}

function fillLevels() {
  $$("[data-level-select]").forEach((sel) => {
    sel.innerHTML = '<option value="">Choose a level</option>' + Object.entries(LEVELS).map(([stage, ns]) =>
      `<optgroup label="${stage}">${ns.map((n) => `<option>${stage} ${n}</option>`).join("")}</optgroup>`).join("");
  });
}

// ---- the week timetable, shared by both views ----
function weekDays() {
  const start = startOfToday();
  start.setDate(start.getDate() + week * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
function renderWeekNav(root) {
  $$("[data-week]", root).forEach((b) => {
    const dir = Number(b.dataset.week);
    b.disabled = dir < 0 ? week === 0 : week >= WEEKS_AHEAD - 1;
  });
}
// cellFor(date) returns { state: "open" | "booked" | "picked" | "", label, disabled }
function renderTimetable(el, cellFor) {
  const days = weekDays();
  const todayKey = startOfToday().getTime();
  let html = '<span aria-hidden="true"></span>';
  for (const d of days) {
    html += `<div class="tt__day${d.getTime() === todayKey ? " is-today" : ""}" aria-hidden="true">${fDay.format(d)}<strong>${d.getDate()}</strong></div>`;
  }
  const now = Date.now();
  for (const h of HOURS) {
    html += `<div class="tt__hour" aria-hidden="true">${hourLabel(h)}</div>`;
    for (const d of days) {
      const at = new Date(d); at.setHours(h, 0, 0, 0);
      const past = at.getTime() <= now;
      const c = cellFor(at, past);
      const name = `${fLong.format(at)}, ${hourLabel(h)}${c.label ? `, ${c.label}` : ""}`;
      html += `<button type="button" class="tt__cell${past ? " is-past" : ""}${c.state ? ` is-${c.state}` : ""}" data-at="${keyOf(at)}"
        aria-label="${esc(name)}"${c.pressed !== undefined ? ` aria-pressed="${c.pressed}"` : ""}${c.disabled || past ? " disabled" : ""}>${c.text || ""}</button>`;
    }
  }
  el.innerHTML = html;
}
const weekEnd = () => { const d = startOfToday(); d.setDate(d.getDate() + WEEKS_AHEAD * 7); return d; };

// ---- lessons list, shared ----
function renderLessons(el, rows, side) {
  const upcoming = rows.filter((b) => new Date(b.starts_at).getTime() + b.minutes * 60000 > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!upcoming.length) {
    el.innerHTML = `<li class="lessons__empty">${side === "parent"
      ? "No lessons booked yet. Choose a tutor above and tap a lit hour to book one."
      : "No lessons booked yet. Open some hours on your week, and parents can book them."}</li>`;
    return;
  }
  el.innerHTML = upcoming.map((b) => {
    const at = new Date(b.starts_at);
    const who = side === "parent"
      ? `<strong>${esc(b.subject)} with ${esc(b.tutor_profiles?.full_name || "your tutor")}</strong><span>For ${esc(b.child_name)}, ${esc(b.level)}</span>`
      : `<strong>${esc(b.subject)} for ${esc(b.child_name)}, ${esc(b.level)}</strong><span>Booked by ${esc(b.parent_name || "a parent")}</span>`;
    const note = b.note ? `<span class="lesson__note">"${esc(b.note)}"</span>` : "";
    const link = b.meeting_link
      ? `<a class="btn btn--primary btn--small" href="${esc(b.meeting_link)}" target="_blank" rel="noopener">Join video call</a>`
      : side === "parent"
        ? '<span class="lesson__opens">The tutor will add the call link before the lesson.</span>'
        : '<span class="lesson__opens">Add your video call link to your profile.</span>';
    return `<li class="lesson">
      <p class="lesson__when">${fLong.format(at)}<span>${timeRange(at, b.minutes)}, online</span></p>
      <p class="lesson__what">${who}${note}</p>
      <div class="lesson__acts">${link}<button type="button" class="btn btn--quiet btn--small" data-cancel="${b.id}">Cancel lesson</button></div>
    </li>`;
  }).join("");
}
async function cancelLesson(id, after) {
  if (!confirm("Cancel this lesson? The hour opens up for booking again.")) return;
  const { error } = await supabase.rpc("cancel_booking", { p_booking: id });
  if (error) return alert(explain(error));
  after();
}

// =====================================================================
// Parent: filter, pick a tutor, pick a lit hour, book it
// =====================================================================
const Parent = (() => {
  const root = $('[data-view="parent"]');
  const picks = $(".picks", root);
  const tt = $('[data-tt="parent"]', root);
  const ttH = $("#p-tt-h");
  const form = $(".confirm", root);
  const err = $(".error", form);
  const filter = { subject: "", level: "" };
  let tutors = [], slots = [], bookings = [], tutor = null, picked = null, wired = false;

  async function load() {
    if (!wired) wire();
    const [t, s, b] = await Promise.all([
      supabase.from("tutor_profiles").select("*"),
      supabase.from("slots").select("*").eq("booked", false).gt("starts_at", new Date().toISOString()).lt("starts_at", weekEnd().toISOString()).order("starts_at"),
      supabase.from("bookings").select("*, tutor_profiles(full_name)").eq("parent_id", user.id),
    ]);
    const fail = t.error || s.error || b.error;
    if (fail) { picks.innerHTML = `<p class="picks__empty">${esc(explain(fail))}</p>`; return; }
    tutors = t.data; slots = s.data; bookings = b.data;
    if (tutor) tutor = tutors.find((x) => x.id === tutor.id) || null;
    renderList();
    renderTimes();
    renderLessons($('[data-lessons="parent"]'), bookings, "parent");
  }

  function matching() {
    return tutors.filter((t) => (!filter.subject || t.subjects.includes(filter.subject)) && (!filter.level || t.stages.includes(stageOf(filter.level))))
      .map((t) => ({ t, next: slots.find((s) => s.tutor_id === t.id) }))
      .sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1) || (a.next?.starts_at || "").localeCompare(b.next?.starts_at || "") || a.t.full_name.localeCompare(b.t.full_name));
  }

  function renderList() {
    const list = matching();
    if (!list.length) {
      picks.innerHTML = `<p class="picks__empty">${tutors.length
        ? "No tutors teach this yet. Choose another subject or level."
        : "No tutors have joined yet. Check back soon."}</p>`;
      return;
    }
    picks.innerHTML = list.map(({ t, next }) => {
      const meta = [t.school, t.subjects.join(", "), t.stages.join(" and ")].filter(Boolean).join(", ");
      const when = next ? `Next open: ${fLong.format(new Date(next.starts_at))}, ${hourLabel(new Date(next.starts_at).getHours())}` : "No open hours in the next four weeks";
      return `<button type="button" class="pick" role="radio" aria-checked="${tutor?.id === t.id}" data-tutor="${t.id}">
        <span class="pick__name">${esc(t.full_name)}</span><span class="pick__rate">S$${t.rate} an hour</span>
        <span class="pick__meta">${esc(meta)}</span>
        ${t.about ? `<span class="pick__about">${esc(t.about)}</span>` : ""}
        <span class="pick__next${next ? "" : " is-none"}">${when}</span>
      </button>`;
    }).join("");
  }

  function renderTimes() {
    renderWeekNav(root);
    tt.classList.toggle("is-off", !tutor);
    ttH.textContent = tutor ? `${tutor.full_name}'s open hours` : "Choose a tutor to see their hours";
    const open = new Map(slots.filter((s) => tutor && s.tutor_id === tutor.id).map((s) => [new Date(s.starts_at).toISOString(), s]));
    renderTimetable(tt, (at) => {
      const s = open.get(keyOf(at));
      if (!s) return { disabled: true };
      if (picked?.id === s.id) return { state: "picked", label: "chosen", text: "Chosen" };
      return { state: "open", label: "open, tap to book" };
    });
  }

  function pickTutor(id) {
    tutor = tutors.find((t) => t.id === id) || null;
    picked = null;
    form.hidden = true;
    // jump to the week with this tutor's next open hour
    const next = slots.find((s) => s.tutor_id === id);
    if (next) week = Math.min(WEEKS_AHEAD - 1, Math.floor((new Date(next.starts_at) - startOfToday()) / (7 * 864e5)));
    renderList();
    renderTimes();
    if (matchMedia("(max-width: 900px)").matches) $(".find__times", root).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickHour(at) {
    const s = slots.find((x) => x.tutor_id === tutor?.id && new Date(x.starts_at).toISOString() === at);
    if (!s) return;
    picked = s;
    const d = new Date(s.starts_at);
    $(".confirm__h", form).textContent = `${fLong.format(d)}, ${timeRange(d, s.minutes)}, with ${tutor.full_name}`;
    const subjects = filter.subject && tutor.subjects.includes(filter.subject) ? [filter.subject, ...tutor.subjects.filter((x) => x !== filter.subject)] : tutor.subjects;
    form.subject.innerHTML = subjects.map((x) => `<option>${esc(x)}</option>`).join("");
    if (filter.level) form.level.value = filter.level;
    err.hidden = true;
    form.hidden = false;
    renderTimes();
    form.child.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function wire() {
    wired = true;
    $('[data-filter="subject"]', root).addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (!c) return;
      $$(".chip", c.parentElement).forEach((x) => x.setAttribute("aria-checked", String(x === c)));
      filter.subject = c.dataset.value;
      renderList();
    });
    $("#f-level").addEventListener("change", (e) => { filter.level = e.target.value; renderList(); });
    picks.addEventListener("click", (e) => { const p = e.target.closest("[data-tutor]"); if (p) pickTutor(p.dataset.tutor); });
    tt.addEventListener("click", (e) => { const c = e.target.closest(".tt__cell.is-open"); if (c) pickHour(c.dataset.at); });
    $$("[data-week]", root).forEach((b) => b.addEventListener("click", () => { week += Number(b.dataset.week); renderTimes(); }));
    $("[data-cancel-pick]", form).addEventListener("click", () => { picked = null; form.hidden = true; renderTimes(); });
    $('[data-lessons="parent"]').addEventListener("click", (e) => { const b = e.target.closest("[data-cancel]"); if (b) cancelLesson(b.dataset.cancel, load); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const child = form.child.value.trim(), level = form.level.value;
      let msg = "";
      if (!picked) msg = "Choose a lit hour on the timetable first.";
      else if (!child) msg = "Add your child's name so the tutor knows who to expect.";
      else if (!level) msg = "Choose your child's level.";
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const btn = $('[type="submit"]', form), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Booking…";
      const { error } = await supabase.rpc("book_slot", {
        p_slot: picked.id, p_child: child, p_subject: form.subject.value, p_level: level, p_note: form.note.value.trim(),
      });
      btn.disabled = false; btn.textContent = label;
      if (error) { err.textContent = explain(error); err.hidden = false; if (/taken/i.test(error.message)) { picked = null; load(); } return; }
      const d = new Date(picked.starts_at), name = tutor.full_name;
      picked = null;
      form.reset();
      form.hidden = true;
      await load();
      const note = document.createElement("p");
      note.className = "done-note";
      note.setAttribute("role", "status");
      note.innerHTML = `<strong>Booked: ${esc(fLong.format(d))}, ${esc(timeRange(d))}, with ${esc(name)}.</strong>The video call link is in Your lessons below.`;
      $(".done-note", root)?.remove();
      form.after(note);
    });
  }

  return { load };
})();

// =====================================================================
// Student tutor: profile, then open and close hours
// =====================================================================
const Tutor = (() => {
  const root = $('[data-view="tutor"]');
  const form = $(".profile", root);
  const err = $(".error", form), saved = $(".saved", form);
  const tt = $('[data-tt="tutor"]', root);
  const ttErr = $(".tt-error", root), gate = $(".tt-gate", root);
  let profile = null, mine = [], bookings = [], busy = new Set(), wired = false;

  async function load() {
    if (!wired) wire();
    const [p, l, s, b] = await Promise.all([
      supabase.from("tutor_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("tutor_private").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("slots").select("*").eq("tutor_id", user.id).gt("starts_at", startOfToday().toISOString()).order("starts_at"),
      supabase.from("bookings").select("*").eq("tutor_id", user.id),
    ]);
    const fail = p.error || l.error || s.error || b.error;
    if (fail) { ttErr.textContent = explain(fail); ttErr.hidden = false; return; }
    profile = p.data; mine = s.data; bookings = b.data;
    fillForm(profile, l.data);
    renderTimes();
    renderLessons($('[data-lessons="tutor"]'), bookings, "tutor");
  }

  function fillForm(p, priv) {
    form.full_name.value = p?.full_name || user.user_metadata?.full_name || "";
    form.school.value = p?.school || "";
    form.rate.value = p?.rate ?? 25;
    form.about.value = p?.about || "";
    form.meeting_link.value = priv?.meeting_link || "";
    for (const [key, vals] of [["subjects", p?.subjects || []], ["stages", p?.stages || []]]) {
      $$(`[data-multi="${key}"] .chip`, form).forEach((c) => c.setAttribute("aria-checked", String(vals.includes(c.dataset.value))));
    }
  }
  const picked = (key) => $$(`[data-multi="${key}"] .chip[aria-checked="true"]`, form).map((c) => c.dataset.value);

  function renderTimes() {
    renderWeekNav(root);
    gate.hidden = !!profile;
    $(".desk", root).classList.toggle("has-profile", !!profile);
    tt.classList.toggle("is-off", !profile);
    const byTime = new Map(mine.map((s) => [new Date(s.starts_at).toISOString(), s]));
    renderTimetable(tt, (at) => {
      const k = keyOf(at), s = byTime.get(k);
      const b = s?.booked && bookings.find((x) => x.slot_id === s.id);
      if (s?.booked) return { state: "booked", label: `booked${b ? ` by ${b.parent_name || "a parent"}` : ""}`, text: "Booked", disabled: true };
      if (busy.has(k)) return { state: s ? "open is-busy" : "busy", label: "saving", disabled: true, pressed: !!s };
      return s ? { state: "open", label: "open, tap to close", pressed: true } : { label: "closed, tap to open", pressed: false };
    });
  }

  async function toggle(at) {
    if (!profile || busy.has(at)) return;
    ttErr.hidden = true;
    const s = mine.find((x) => new Date(x.starts_at).toISOString() === at);
    busy.add(at); renderTimes();
    const { data, error } = s
      ? await supabase.from("slots").delete().eq("id", s.id).select()
      : await supabase.from("slots").insert({ tutor_id: user.id, starts_at: at, minutes: 60 }).select().single();
    busy.delete(at);
    if (error) { ttErr.textContent = explain(error); ttErr.hidden = false; }
    else if (s) {
      if (!data?.length) { ttErr.textContent = "A parent booked that hour a moment ago, so it stays open. It's in Booked lessons below."; ttErr.hidden = false; return load(); }
      mine = mine.filter((x) => x.id !== s.id);
    } else mine.push(data);
    renderTimes();
  }

  function wire() {
    wired = true;
    $$("[data-multi] .chip", form).forEach((c) => c.addEventListener("click", () => {
      c.setAttribute("aria-checked", String(c.getAttribute("aria-checked") !== "true"));
      err.hidden = true; saved.hidden = true;
    }));
    tt.addEventListener("click", (e) => { const c = e.target.closest(".tt__cell:not(:disabled)"); if (c) toggle(c.dataset.at); });
    $$("[data-week]", root).forEach((b) => b.addEventListener("click", () => { week += Number(b.dataset.week); renderTimes(); }));
    $('[data-lessons="tutor"]').addEventListener("click", (e) => { const b = e.target.closest("[data-cancel]"); if (b) cancelLesson(b.dataset.cancel, load); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      saved.hidden = true;
      const row = {
        id: user.id, full_name: form.full_name.value.trim(), school: form.school.value.trim(), about: form.about.value.trim(),
        subjects: picked("subjects"), stages: picked("stages"), rate: Number(form.rate.value), updated_at: new Date().toISOString(),
      };
      const link = form.meeting_link.value.trim();
      let msg = "";
      if (!row.full_name) msg = "Add the name parents will see.";
      else if (!row.subjects.length) msg = "Choose at least one subject you teach.";
      else if (!row.stages.length) msg = "Choose Primary, Secondary, or both.";
      else if (!(row.rate >= 10 && row.rate <= 200)) msg = "Set a rate between S$10 and S$200 an hour.";
      else if (link && !MEET_LINK.test(link)) msg = LINK_HELP;
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      err.hidden = true;
      const btn = $('[type="submit"]', form), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Saving…";
      const a = await supabase.from("tutor_profiles").upsert(row).select().single();
      const b = a.error ? a : await supabase.from("tutor_private").upsert({ id: user.id, meeting_link: link });
      btn.disabled = false; btn.textContent = label;
      if (a.error || b.error) { err.textContent = explain(a.error || b.error); err.hidden = false; return; }
      const first = !profile;
      profile = a.data;
      saved.textContent = !link ? "Profile saved. Add your video call link too, so parents can join your lessons."
        : first ? "Profile saved. Now tap the hours you can teach." : "Profile saved.";
      saved.hidden = false;
      renderTimes();
    });
  }

  return { load };
})();
