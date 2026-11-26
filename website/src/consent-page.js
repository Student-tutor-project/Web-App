// A parent or guardian agrees to their under-18 child tutoring. No login: the private link's token
// is the key, and the database functions only reveal the student's first name and the guardian's name.
import "./style.css";
import { supabase } from "./supabase.js";

const $ = (s, r = document) => r.querySelector(s);
const show = (name) => document.querySelectorAll("[data-view]").forEach((v) => { v.hidden = v.dataset.view !== name; });
const token = new URLSearchParams(location.search).get("t") || "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fDate = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", year: "numeric" });
let tutor = "";

const doneText = (name, at) => `You agreed${at ? ` on ${fDate.format(new Date(at))}` : ""}. ${name} can now send the profile to our team for checking.`;

async function start() {
  if (!supabase || !UUID.test(token)) return show("gone");
  const { data, error } = await supabase.rpc("guardian_request_info", { p_token: token });
  const row = data?.[0];
  if (error || !row) return show("gone");
  tutor = row.tutor_first_name || "The student";
  document.querySelectorAll("[data-tutor]").forEach((el) => { el.textContent = tutor; });
  document.querySelectorAll("[data-is]").forEach((el) => { el.textContent = "is"; });
  if (row.agreed_at) { $("[data-done-text]").textContent = doneText(tutor, row.agreed_at); return show("done"); }
  $("#c-name").value = row.guardian_name || "";
  show("ask");
}

$(".agree").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $(".agree .error"), name = $("#c-name").value.trim();
  let msg = "";
  if (!name) msg = "Type your full name.";
  else if (!$("#c-ok").checked) msg = "Tick the box to show you agree.";
  if (msg) { err.textContent = msg; err.hidden = false; return; }
  err.hidden = true;
  const btn = $(".agree .btn");
  btn.disabled = true; btn.textContent = "Saving…";
  const { error } = await supabase.rpc("give_guardian_consent", { p_token: token, p_name: name });
  btn.disabled = false; btn.textContent = "I agree";
  if (error) {
    if (/expired|replaced/i.test(error.message)) return show("gone");
    err.textContent = `That didn't save: ${error.message}. Try again.`; err.hidden = false; return;
  }
  $("[data-done-text]").textContent = doneText(tutor, new Date());
  show("done");
});

start();
