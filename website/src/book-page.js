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
  if (!u) { role = null; who.hidden = true; $(".bar__admin").hidden = true; show("out"); return; }
  role = u.user_metadata?.role === "tutor" ? "tutor" : "parent";   // older "student" accounts book like parents
  const first = (u.user_metadata?.full_name || "").split(" ")[0];
  who.hidden = !first;
  who.textContent = first ? `${first}, ${role === "tutor" ? "student tutor" : "parent"}` : "";
  week = 0;
  show(role);
  supabase.rpc("is_admin").then(({ data }) => { $(".bar__admin").hidden = !data; });
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
      ? `<strong>${esc(b.subject)} with ${esc(b.tutor_profiles?.display_name || "your tutor")}</strong><span>For ${esc(b.child_name)}, ${esc(b.level)}</span>`
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
      <div class="lesson__acts">${link}<button type="button" class="btn btn--quiet btn--small" data-cancel="${b.id}">Cancel lesson</button>
        <a class="lesson__report" href="${reportHref(b, at)}">Report a problem</a></div>
    </li>`;
  }).join("");
}
// a prefilled email to the team about one lesson
const REPORT_TO = "hello@studenttutor.example";
function reportHref(b, at) {
  const subject = `Report a problem: lesson on ${fLong.format(at)}`;
  const body = `Lesson: ${b.subject} for ${b.child_name}, ${fLong.format(at)}, ${timeRange(at, b.minutes)}\nLesson reference: ${b.id}\n\nWhat happened:\n`;
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
      supabase.from("tutor_profiles").select("id, display_name, school, about, subjects, stages, rate, status").eq("status", "approved"),   // only checked tutors are listed
      supabase.from("slots").select("*").eq("booked", false).gt("starts_at", new Date().toISOString()).lt("starts_at", weekEnd().toISOString()).order("starts_at"),
      supabase.from("bookings").select("*, tutor_profiles(display_name)").eq("parent_id", user.id),
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
      .sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1) || (a.next?.starts_at || "").localeCompare(b.next?.starts_at || "") || a.t.display_name.localeCompare(b.t.display_name));
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
        <span class="pick__name">${esc(t.display_name)}</span><span class="pick__rate">S$${t.rate} an hour</span>
        <span class="pick__check">Grades checked</span>
        <span class="pick__meta">${esc(meta)}</span>
        ${t.about ? `<span class="pick__about">${esc(t.about)}</span>` : ""}
        <span class="pick__next${next ? "" : " is-none"}">${when}</span>
      </button>`;
    }).join("");
  }

  function renderTimes() {
    renderWeekNav(root);
    tt.classList.toggle("is-off", !tutor);
    ttH.textContent = tutor ? `${tutor.display_name}'s open hours` : "Choose a tutor to see their hours";
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
    $(".confirm__h", form).textContent = `${fLong.format(d)}, ${timeRange(d, s.minutes)}, with ${tutor.display_name}`;
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
      const d = new Date(picked.starts_at), name = tutor.display_name;
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

  // the full profile row comes through a function: parents can only read the public columns
  const readProfile = async () => {
    const { data, error } = await supabase.rpc("my_tutor_profile");
    return { data: data?.[0] || null, error };
  };

  async function load() {
    if (!wired) wire();
    const [p, l, s, b, g] = await Promise.all([
      readProfile(),
      supabase.from("tutor_private").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("slots").select("*").eq("tutor_id", user.id).gt("starts_at", startOfToday().toISOString()).order("starts_at"),
      supabase.from("bookings").select("*").eq("tutor_id", user.id),
      supabase.from("guardian_requests").select("token, guardian_name, guardian_contact, agreed_at").eq("tutor_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);
    const fail = p.error || l.error || s.error || b.error;
    if (fail) { ttErr.textContent = explain(fail); ttErr.hidden = false; return; }
    profile = p.data; mine = s.data; bookings = b.data; myLink = l.data?.meeting_link || "";
    request = g.data?.[0] || null;
    fillForm(profile, l.data);
    renderTimes();
    await loadFiles();
    renderCheck();
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
    wireCheck();
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
        full_name: form.full_name.value.trim(), school: form.school.value.trim(), about: form.about.value.trim(),
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
      const a = profile
        ? await supabase.from("tutor_profiles").update(row).eq("id", user.id)
        : await supabase.from("tutor_profiles").insert({ id: user.id, ...row });
      const b = a.error ? a : await supabase.from("tutor_private").upsert({ id: user.id, meeting_link: link });
      const c = a.error || b.error ? {} : await readProfile();
      btn.disabled = false; btn.textContent = label;
      if (a.error || b.error || c.error) { err.textContent = explain(a.error || b.error || c.error); err.hidden = false; return; }
      const first = !profile;
      profile = c.data;
      myLink = link;
      renderCheck();
      saved.textContent = !link ? "Profile saved. Add your video call link too, so parents can join your lessons."
        : first ? "Profile saved. Now tap the hours you can teach." : "Profile saved.";
      saved.hidden = false;
      renderTimes();
    });
  }

  // ---- Get checked: report card, age, guardian consent, send for checking ----
  const check = $(".check", root);
  const checkErr = $(".error", check);
  const fileInput = $(".file-btn__input", check);
  const guardian = $(".guardian", check);
  let files = [], myLink = "", age = null, request = null;
  const STATUS = {
    none: ["Get checked before parents can see you", "Save your profile first. Then upload your latest results and send them for checking."],
    draft: ["Get checked before parents can see you", "A person on the Student Tutor team checks your results against your report card. Until then, parents can't see your profile or your hours."],
    pending: ["Waiting for a check", "The team is checking your results. You can keep opening hours; parents see them once you're approved."],
    approved: ["Grades checked", "Parents can see your profile and book your open hours."],
    rejected: ["Not approved yet", "Fix what the note below says, then send it again."],
  };
  const editable = () => !!profile && (profile.status === "draft" || profile.status === "rejected");
  const shown = (name) => name.replace(/^\d+-/, "");
  const linkFor = (token) => new URL(`./consent.html?t=${token}`, location.href).href;
  const fDay2 = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long" });

  async function loadFiles() {
    const { data, error } = await supabase.storage.from("report-cards").list(user.id, { sortBy: { column: "created_at", order: "asc" } });
    files = error ? [] : (data || []).filter((f) => f.name && !f.name.startsWith("."));
  }

  function renderGuardian() {
    const minor = age === "13-17";
    guardian.hidden = !profile || !minor || (!editable() && !profile.guardian_name);
    if (guardian.hidden) return;
    $("#g-name").value ||= profile.guardian_name || "";
    $("#g-contact").value ||= profile.guardian_contact || "";
    const agreed = profile.guardian_consent && profile.age_band === "13-17";
    const state = $(".guardian__state", guardian);
    guardian.classList.toggle("is-agreed", agreed);
    state.textContent = agreed
      ? `${profile.guardian_consent_name} agreed on ${fDay2.format(new Date(profile.guardian_consent_at))}.`
      : request && !request.agreed_at ? `Waiting for ${request.guardian_name} to open the link and agree.` : "";
    state.hidden = !state.textContent;
    const waiting = !agreed && request && !request.agreed_at;
    $("[data-guardian-link]", guardian).textContent = waiting ? "Make a new link" : "Make the link for your parent";
    $("[data-guardian-link]", guardian).hidden = agreed;
    $("[data-guardian-refresh]", guardian).hidden = !waiting;
    const share = $(".guardian__share", guardian);
    share.hidden = !waiting || !editable();
    if (waiting) {
      const url = linkFor(request.token);
      const msg = `Hi, I'd like to tutor younger students online on Student Tutor. Please read this and agree if you're happy for me to: ${url}`;
      $("#g-link").value = url;
      $("[data-wa]", guardian).href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      const mail = $("[data-mail]", guardian), email = request.guardian_contact.includes("@") ? request.guardian_contact : "";
      mail.hidden = !email;
      if (email) mail.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Please agree to my tutoring on Student Tutor")}&body=${encodeURIComponent(msg)}`;
    }
  }

  function renderCheck() {
    const status = profile ? profile.status : "none";
    check.dataset.status = status;
    const [h, text] = STATUS[status];
    $(".check__h", check).textContent = h;
    $(".check__text", check).textContent = text;
    const note = $(".check__note", check);
    note.hidden = !(status === "rejected" && profile.review_note);
    note.textContent = profile?.review_note ? `Note from the team: ${profile.review_note}` : "";
    $(".check__body", check).hidden = status === "none" || status === "approved";
    $$("[data-editable]", check).forEach((el) => { el.hidden = !editable(); });
    if (age === null && profile?.age_band) age = profile.age_band;
    $$("[data-age] .chip", check).forEach((c) => c.setAttribute("aria-checked", String(c.dataset.value === age)));
    $(".age-stop", check).hidden = age !== "u13" || !editable();
    $("[data-submit-check]", check).hidden = !editable() || age === "u13";
    renderGuardian();
    const list = $(".files", check);
    list.innerHTML = files.length
      ? files.map((f) => `<li class="file"><button type="button" class="file__open" data-open="${esc(f.name)}">${esc(shown(f.name))}</button>${editable() ? `<button type="button" class="file__drop" data-drop="${esc(f.name)}" aria-label="Take off ${esc(shown(f.name))}">Take off</button>` : ""}</li>`).join("")
      : `<li class="files__empty">${editable() ? "No file yet. Upload your latest report card or results slip." : "No file uploaded."}</li>`;
  }

  async function upload(file) {
    checkErr.hidden = true;
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { checkErr.textContent = "That file is over 10 MB. Use a smaller PDF or a photo."; checkErr.hidden = false; return; }
    const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
    const label = $(".file-btn", check);
    label.classList.add("is-busy");
    const { error } = await supabase.storage.from("report-cards").upload(`${user.id}/${Date.now()}-${safe}`, file, { contentType: file.type });
    label.classList.remove("is-busy");
    fileInput.value = "";
    if (error) { checkErr.textContent = /mime|type/i.test(error.message) ? "Upload a PDF or a photo (JPG, PNG, WEBP or HEIC)." : explain(error); checkErr.hidden = false; return; }
    await loadFiles(); renderCheck();
  }

  // saving the age band; a change of band clears any guardian consent (the database does this too)
  async function saveAge(value) {
    age = value; checkErr.hidden = true;
    if (value !== "u13" && profile && profile.age_band !== value) {
      const { error } = await supabase.from("tutor_profiles").update({ age_band: value }).eq("id", user.id);
      if (error) { checkErr.textContent = explain(error); checkErr.hidden = false; return; }
      const r = await readProfile(); if (r.data) profile = r.data;
      request = null;
    }
    renderCheck();
  }

  async function makeLink() {
    checkErr.hidden = true;
    const name = $("#g-name").value.trim(), contact = $("#g-contact").value.trim();
    if (!name || !contact) { checkErr.textContent = "Add your parent or guardian's name and their phone or email."; checkErr.hidden = false; return; }
    const btn = $("[data-guardian-link]", guardian);
    btn.disabled = true;
    const { data: token, error } = await supabase.rpc("request_guardian_consent", { p_name: name, p_contact: contact });
    btn.disabled = false;
    if (error) { checkErr.textContent = explain(error); checkErr.hidden = false; return; }
    request = { token, guardian_name: name, guardian_contact: contact, agreed_at: null };
    const r = await readProfile(); if (r.data) profile = r.data;
    renderCheck();
    $("#g-link").select();
  }

  async function refreshConsent() {
    const r = await readProfile(); if (r.data) profile = r.data;
    if (profile.guardian_consent) request = { ...request, agreed_at: profile.guardian_consent_at };
    renderCheck();
    if (!profile.guardian_consent) { checkErr.textContent = "They haven't agreed yet. Check that they got the link."; checkErr.hidden = false; }
  }

  async function submitCheck() {
    checkErr.hidden = true;
    let msg = "";
    if (!profile) msg = "Save your profile first.";
    else if (!myLink) msg = "Add your video call link to your profile and save it first.";
    else if (!files.length) msg = "Upload your latest report card or results slip first.";
    else if (!age) msg = "Tell us how old you are.";
    else if (age === "13-17" && !profile.guardian_consent) msg = "Your parent or guardian has to open the link and agree first.";
    if (msg) { checkErr.textContent = msg; checkErr.hidden = false; return; }
    const btn = $("[data-submit-check]", check);
    btn.disabled = true; btn.textContent = "Sending…";
    const { error } = await supabase.from("tutor_profiles").update({ status: "pending" }).eq("id", user.id);
    const r = error ? {} : await readProfile();
    btn.disabled = false; btn.textContent = "Send for checking";
    if (error || r.error) { checkErr.textContent = explain(error || r.error); checkErr.hidden = false; return; }
    profile = r.data;
    renderCheck();
    check.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function wireCheck() {
    fileInput.addEventListener("change", () => upload(fileInput.files?.[0]));
    $("[data-age]", check).addEventListener("click", (e) => {
      const c = e.target.closest(".chip"); if (c && editable()) saveAge(c.dataset.value);
    });
    $("[data-guardian-link]", guardian).addEventListener("click", makeLink);
    $("[data-guardian-refresh]", guardian).addEventListener("click", refreshConsent);
    $("[data-copy-link]", guardian).addEventListener("click", async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText($("#g-link").value); b.textContent = "Copied"; }
      catch { $("#g-link").select(); b.textContent = "Press Ctrl+C to copy"; }
      setTimeout(() => { b.textContent = "Copy link"; }, 2000);
    });
    $("[data-submit-check]", check).addEventListener("click", submitCheck);
    $(".files", check).addEventListener("click", async (e) => {
      const open = e.target.closest("[data-open]"), drop = e.target.closest("[data-drop]");
      if (open) {
        const win = window.open("", "_blank");
        const { data } = await supabase.storage.from("report-cards").createSignedUrl(`${user.id}/${open.dataset.open}`, 120);
        if (data?.signedUrl && win) win.location = data.signedUrl; else win?.close();
      }
      if (drop) {
        const { error } = await supabase.storage.from("report-cards").remove([`${user.id}/${drop.dataset.drop}`]);
        if (error) { checkErr.textContent = explain(error); checkErr.hidden = false; return; }
        await loadFiles(); renderCheck();
      }
    });
  }

  return { load };
})();
