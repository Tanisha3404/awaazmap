(function () {
  const params = new URLSearchParams(location.search);
  let next = params.get("next") || "index.html";
  if (!/^[\w\-./?=&%]+$/.test(next) || next.startsWith("//") || /^[a-z]+:/i.test(next)) next = "index.html";

  let mode = "login";
  const form = document.getElementById("auth-form");
  const msg = document.getElementById("msg");
  const tabs = document.querySelectorAll("[data-mode]");
  const nameField = document.getElementById("name-field");
  const submit = document.getElementById("submit");
  const forgot = document.getElementById("forgot");

  function setMode(m) {
    mode = m;
    tabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.mode === m));
    nameField.hidden = m !== "signup";
    submit.textContent = m === "signup" ? "Create account" : "Log in";
    forgot.hidden = m !== "login";
    document.getElementById("password").autocomplete = m === "signup" ? "new-password" : "current-password";
    show("");
  }
  function show(text, ok) { msg.hidden = !text; msg.className = "alert " + (ok ? "alert-ok" : "alert-error"); msg.textContent = text; }
  function friendly(e) {
    const map = {
      "auth/invalid-credential": "That email and password do not match.",
      "auth/wrong-password": "That email and password do not match.",
      "auth/user-not-found": "That email and password do not match.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
      "auth/weak-password": "Choose a password with at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
      "auth/popup-closed-by-user": "The Google window was closed before finishing.",
      "auth/network-request-failed": "No internet connection. Try again.",
      "auth/unauthorized-domain": "This website address is not allowed in Firebase yet. Add it under Authentication, Settings, Authorized domains.",
    };
    return map[e.code] || "Could not complete that. Please try again.";
  }
  async function run(fn) {
    submit.disabled = true;
    try {
      await fn();
      const me = await U.api("/api/me", { auth: true }).catch(() => null); // admin-only accounts start on the admin page
      location.replace(me && me.official ? "admin.html" : next);
    }
    catch (e) { show(friendly(e)); submit.disabled = false; }
  }
  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), pw = form.password.value, name = form.name.value.trim();
    if (!email || !pw) return show("Enter your email and password.");
    if (mode === "signup") {
      if (name.length < 2) return show("Enter your name so neighbours know who reported.");
      return run(() => Auth.signup(name, email, pw));
    }
    run(() => Auth.login(email, pw));
  });
  document.getElementById("google").addEventListener("click", () => run(() => Auth.google()));
  forgot.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email) return show("Type your email above first, then press this link again.");
    try { await Auth.reset(email); show("Password reset email sent. Check your inbox.", true); } catch (err) { show(friendly(err)); }
  });
  Auth.ready.then((u) => { if (u) location.replace(next); });
  setMode(params.get("mode") === "signup" ? "signup" : "login");
})();
