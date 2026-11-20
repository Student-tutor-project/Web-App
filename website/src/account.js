// Log in / Sign up panel, backed by Supabase Auth (email and password).
// Sign-up stores the name and role (parent or tutor) in the user's metadata.
import { supabase } from "./supabase.js";

const ERRORS = [
  [/invalid login credentials/i, "That email and password don't match. Check them, or create an account."],
  [/email not confirmed/i, "Confirm your email first: open the link we sent you, then log in."],
  [/already registered|already been registered|already exists/i, "There's already an account with this email. Log in instead."],
  [/rate limit|too many/i, "Too many tries in a short time. Wait a minute, then try again."],
  [/not authorized|address .* invalid|invalid email/i, "We can't send email to that address. Check it, or use another one."],
  [/password/i, "Use a stronger password: at least 8 characters, mixing letters and numbers."],
  [/fetch|network/i, "We couldn't reach the server. Check your connection and try again."],
];
const explain = (e) => (ERRORS.find(([re]) => re.test(e?.message || "")) || [null, `Something went wrong: ${e?.message || "unknown error"}. Try again.`])[1];

export function initAccount({ lenis } = {}) {
  const dlg = document.getElementById("account");
  if (!dlg || typeof dlg.showModal !== "function") return;
  const form = dlg.querySelector(".account__form");
  const done = dlg.querySelector(".account__done");
  const title = dlg.querySelector("#account-h");
  const submit = dlg.querySelector(".account__submit");
  const sw = dlg.querySelector(".account__switch");
  const err = dlg.querySelector(".error");
  const pass = dlg.querySelector("#acc-pass");
  const loginBtn = document.querySelector(".bar__login");
  let mode = "login", role = "parent", opener = null, user = null;

  // ---- signed-in state: the bar offers Log out, and the bar buttons skip sign-up ----
  function setUser(u) {
    user = u;
    loginBtn.textContent = u ? "Log out" : "Log in";
    loginBtn.dataset.account = u ? "logout" : "login";
    document.body.classList.toggle("signed-in", !!u);
  }
  supabase?.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
  supabase?.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));

  function setMode(m) {
    mode = m;
    const signup = m === "signup";
    title.textContent = signup ? "Create an account" : "Log in";
    submit.textContent = signup ? "Create account" : "Log in";
    pass.autocomplete = signup ? "new-password" : "current-password";
    dlg.querySelectorAll("[data-only=signup]").forEach((el) => { el.hidden = !signup; });
    dlg.querySelectorAll("[role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === m)));
    sw.innerHTML = signup
      ? 'Already have an account? <button type="button" data-mode="login">Log in</button>'
      : 'New to Student Tutor? <button type="button" data-mode="signup">Create an account</button>';
    err.hidden = true;
  }
  function setRole(r) {
    role = r;
    dlg.querySelectorAll("[data-name=role] .chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.value === r)));
  }

  function scrollToId(id, focusSel) {
    const el = document.getElementById(id);
    lenis ? lenis.scrollTo(el, { offset: -64 }) : el.scrollIntoView();
    if (focusSel) setTimeout(() => document.querySelector(focusSel)?.focus({ preventScroll: true }), lenis ? 1250 : 0);
  }

  function open(m, from) {
    opener = from || document.activeElement;
    form.hidden = false;
    done.hidden = true;
    setMode(m);
    setRole(from?.dataset.role || "parent");   // Book a tutor starts as Parent, Teach with us as Student tutor
    lenis?.stop();
    dlg.showModal();
    dlg.querySelector(mode === "signup" ? "#acc-name" : "#acc-email").focus();
  }
  function close() { dlg.close(); }
  dlg.addEventListener("close", () => { lenis?.start(); opener?.focus?.(); });

  function showDone(heading, text, offerBooking) {
    form.hidden = true;
    done.hidden = false;
    done.querySelector(".account__done-h").textContent = heading;
    done.querySelector(".account__done-text").textContent = text;
    done.querySelector("[data-goto-book]").hidden = !offerBooking;
    done.focus();
  }

  document.querySelectorAll("[data-account]").forEach((b) => b.addEventListener("click", async () => {
    const what = b.dataset.account;
    if (what === "logout") { await supabase?.auth.signOut(); return; }
    if (user && what === "signup") {                            // already signed in: go straight there
      return b.dataset.role === "tutor" ? scrollToId("tutors") : scrollToId("book", "#book .chip");
    }
    open(what, b);
  }));

  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return close();                       // click on the backdrop
    if (e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-goto-book]")) {                  // hand the parent on to the booking flow
      opener = null;
      close();
      setTimeout(() => scrollToId("book", "#book .chip"), 50);
      return;
    }
    const m = e.target.closest("[data-mode]");
    if (m) { setMode(m.dataset.mode); dlg.querySelector("#acc-email").focus(); }
    const chip = e.target.closest(".chip");
    if (chip) setRole(chip.dataset.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), pw = form.password.value, name = form.name.value.trim();
    let msg = "";
    if (mode === "signup" && !name) msg = "Add your name.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = "Enter your email address, like name@example.com.";
    else if (!pw) msg = "Enter your password.";
    else if (mode === "signup" && pw.length < 8) msg = "Use a password with at least 8 characters.";
    else if (!supabase) msg = "Accounts aren't set up on this copy of the site yet.";
    if (msg) { err.textContent = msg; err.hidden = false; return; }

    err.hidden = true;
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = mode === "signup" ? "Creating account…" : "Logging in…";
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password: pw,
          options: { data: { full_name: name, role }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        // Supabase answers an existing, confirmed email with an empty identities list instead of an error
        if (data.user && data.user.identities?.length === 0) throw new Error("already registered");
        form.reset();
        if (data.session) {
          showDone(`Welcome, ${name}`, role === "tutor"
            ? "Your account is ready. Next, send us your subjects and results so we can check them."
            : "Your account is ready. Book a first lesson whenever you like.", role === "parent");
        } else {
          showDone("Check your email", `We sent a link to ${email}. Open it to confirm your account, then log in.`, role === "parent");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        form.reset();
        const meta = data.user?.user_metadata || {};
        const first = (meta.full_name || "").split(" ")[0];
        showDone(first ? `Welcome back, ${first}` : "You're logged in", meta.role === "tutor"
          ? "You're logged in to your tutor account."
          : "You're logged in. Book a first lesson whenever you like.", meta.role !== "tutor");
      }
    } catch (ex) {
      err.textContent = explain(ex);
      err.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
