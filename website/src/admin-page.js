// Tutor checks: the Student Tutor team reviews each tutor's report card and approves or rejects them.
// Only accounts listed in the admins table get past is_admin(); the database enforces it too.
import "./style.css";
import { supabase } from "./supabase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const show = (name) => $$("[data-view]").forEach((v) => { v.hidden = v.dataset.view !== name; });
const list = $(".admin-list");
let tutors = [], filter = "pending";
const AGE = { "13-17": "13 to 17", "18+": "18 or older" };
const EMPTY = {
  pending: "No tutors are waiting for a check.",
  approved: "No tutors approved yet.",
  rejected: "No tutors have been turned down.",
  draft: "Every tutor who signed up has sent their profile.",
};

async function start() {
  if (!supabase) return show("out");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return show("out");
  const { data: ok } = await supabase.rpc("is_admin");
  if (!ok) return show("denied");
  show("admin");
  await load();
}

async function load() {
  const { data, error } = await supabase.rpc("admin_tutor_profiles");   // full rows; parents only get public columns
  if (error) { list.innerHTML = `<li class="admin-empty">${esc(error.message)}</li>`; return; }
  tutors = data;
  updateCounts();
  await render();
}

function updateCounts() {
  $$("[data-filter-status] .chip").forEach((c) => {
    const n = tutors.filter((t) => t.status === c.dataset.value).length;
    c.textContent = `${c.textContent.replace(/\s\(\d+\)$/, "")} (${n})`;
  });
}

async function filesFor(id) {
  const { data } = await supabase.storage.from("report-cards").list(id, { sortBy: { column: "created_at", order: "asc" } });
  return (data || []).filter((f) => f.name && !f.name.startsWith("."));
}

async function render() {
  const rows = tutors.filter((t) => t.status === filter);
  if (!rows.length) { list.innerHTML = `<li class="admin-empty">${EMPTY[filter]}</li>`; return; }
  const withFiles = await Promise.all(rows.map(async (t) => ({ t, files: await filesFor(t.id) })));
  list.innerHTML = withFiles.map(({ t, files }) => {
    const facts = [
      ["Subjects", t.subjects.join(", ") || "None chosen"],
      ["Levels", t.stages.join(" and ") || "None chosen"],
      ["Rate", `S$${t.rate} an hour`],
      ["Sent for checking", t.submitted_at ? fDate.format(new Date(t.submitted_at)) : "Not yet"],
      ["Age", AGE[t.age_band] || "Not given"],
    ];
    if (t.under_18) {
      facts.push(["Parents see", t.display_name]);
      facts.push(["Guardian", `${t.guardian_name || "Not given"}, ${t.guardian_contact || "no contact"}`]);
      facts.push(["Guardian agrees", t.guardian_consent
        ? `Yes: ${t.guardian_consent_name} agreed through the link on ${fDate.format(new Date(t.guardian_consent_at))}`
        : "No, not yet"]);
    }
    if (t.reviewed_at) facts.push(["Last decision", `${fDate.format(new Date(t.reviewed_at))}${t.review_note ? `: ${t.review_note}` : ""}`]);
    const fileHtml = files.length
      ? files.map((f) => `<li class="file"><button type="button" class="file__open" data-open="${esc(t.id)}/${esc(f.name)}">${esc(f.name.replace(/^\d+-/, ""))}</button></li>`).join("")
      : t.status === "approved"
        ? '<li class="files__empty">Deleted after approval.</li>'
        : '<li class="files__empty review__flag">No report card uploaded.</li>';
    const decide = t.status === "draft"
      ? '<p class="review__meta">This tutor hasn\'t sent their profile for checking yet.</p>'
      : `<label class="field__label" for="note-${t.id}">Note to the tutor${t.status === "pending" ? " (needed if you don't approve)" : ""}</label>
         <textarea id="note-${t.id}" rows="3" maxlength="500" placeholder="For example: the Maths result on the slip doesn't match the A1 in your profile"></textarea>
         <p class="error" role="alert" hidden></p>
         <div class="review__acts">
           ${t.status !== "approved" ? `<button type="button" class="btn btn--primary btn--small" data-decide="approved" data-id="${t.id}">Approve</button>` : ""}
           ${t.status !== "rejected" ? `<button type="button" class="btn btn--quiet btn--small" data-decide="rejected" data-id="${t.id}">${t.status === "approved" ? "Remove approval" : "Don't approve"}</button>` : ""}
         </div>`;
    return `<li class="review" data-row="${t.id}">
      <div class="review__who">
        <p class="review__name">${esc(t.full_name)}</p>
        <p class="review__meta">${esc(t.school || "School not given")}</p>
        ${t.about ? `<p class="review__about">${esc(t.about)}</p>` : ""}
        <dl class="review__facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd${(k === "Guardian agrees" && !t.guardian_consent) ? ' class="review__flag"' : ""}>${esc(v)}</dd></div>`).join("")}</dl>
      </div>
      <div class="review__decide">
        <span class="field__label">Report card</span>
        <ul class="files">${fileHtml}</ul>
        ${decide}
      </div>
    </li>`;
  }).join("");
}

$("[data-filter-status]").addEventListener("click", (e) => {
  const c = e.target.closest(".chip"); if (!c) return;
  $$("[data-filter-status] .chip").forEach((x) => x.setAttribute("aria-checked", String(x === c)));
  filter = c.dataset.value;
  render();
});

list.addEventListener("click", async (e) => {
  const open = e.target.closest("[data-open]");
  if (open) {
    const win = window.open("", "_blank");
    const { data } = await supabase.storage.from("report-cards").createSignedUrl(open.dataset.open, 300);
    if (data?.signedUrl && win) win.location = data.signedUrl; else win?.close();
    return;
  }
  const btn = e.target.closest("[data-decide]");
  if (!btn) return;
  const row = btn.closest(".review"), err = $(".error", row);
  const note = $("textarea", row).value.trim();
  if (btn.dataset.decide === "rejected" && !note) {
    err.textContent = "Add a note so the tutor knows what to fix."; err.hidden = false; return;
  }
  err.hidden = true;
  btn.disabled = true;
  const { error } = await supabase.rpc("review_tutor", { p_tutor: btn.dataset.id, p_status: btn.dataset.decide, p_note: note });
  btn.disabled = false;
  if (error) { err.textContent = `That didn't save: ${error.message}. Try again.`; err.hidden = false; return; }
  const t = tutors.find((x) => x.id === btn.dataset.id);
  // report cards may carry NRIC numbers: keep them only until the tutor is approved
  let cleanup = "";
  if (btn.dataset.decide === "approved") {
    const files = await filesFor(btn.dataset.id);
    if (files.length) {
      const { error: delErr } = await supabase.storage.from("report-cards").remove(files.map((f) => `${btn.dataset.id}/${f.name}`));
      cleanup = delErr ? ` The report card wasn't deleted (${delErr.message}); delete it from Supabase Storage.` : " Their report card is deleted.";
    }
  }
  row.innerHTML = `<p class="review__done" role="status">${esc(t?.full_name || "Tutor")} ${btn.dataset.decide === "approved" ? "is approved. Parents can see them now." : "was not approved. They'll see your note."}${esc(cleanup)}</p>`;
  await new Promise((r) => setTimeout(r, 1600));
  await load();
});

start();
