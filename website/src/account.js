// Log in / Sign up panel. No backend yet: it checks the fields and says plainly that accounts open at launch.
// To make it real, replace the submit handler with Supabase Auth (signInWithPassword / signUp).

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
  let mode = "login", role = "parent", opener = null;

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

  document.querySelectorAll("[data-account]").forEach((b) => b.addEventListener("click", () => open(b.dataset.account, b)));
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return close();                       // click on the backdrop
    if (e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-goto-book]")) {                  // hand the parent on to the booking flow
      opener = null;
      close();
      setTimeout(() => {
        const book = document.getElementById("book");
        lenis ? lenis.scrollTo(book, { offset: -64 }) : book.scrollIntoView();
        setTimeout(() => document.querySelector("#book .chip")?.focus({ preventScroll: true }), lenis ? 1250 : 0);
      }, 50);
      return;
    }
    const m = e.target.closest("[data-mode]");
    if (m) { setMode(m.dataset.mode); dlg.querySelector("#acc-email").focus(); }
    const chip = e.target.closest(".chip");
    if (chip) setRole(chip.dataset.value);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), pw = form.password.value, name = form.name.value.trim();
    let msg = "";
    if (mode === "signup" && !name) msg = "Add your name.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = "Enter your email address, like name@example.com.";
    else if (!pw) msg = "Enter your password.";
    else if (mode === "signup" && pw.length < 8) msg = "Use a password with at least 8 characters.";
    if (msg) { err.textContent = msg; err.hidden = false; return; }

    form.reset();
    form.hidden = true;
    done.hidden = false;
    done.querySelector(".account__done-h").textContent = "Accounts open at launch";
    const tutor = mode === "signup" && role === "tutor";
    done.querySelector(".account__done-text").textContent = tutor
      ? "Tutor sign-up isn't open yet. To apply now, email hello@studenttutor.example with your subjects and results."
      : "You don't need an account to book a first lesson. Book one now and the tutor will message you on WhatsApp.";
    done.querySelector("[data-goto-book]").hidden = tutor;
    done.focus();
  });
}
