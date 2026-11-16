// Shared helpers: labels, safe HTML, header/footer, toasts, API calls.
(function () {
  const CATS = {
    road: { label: "Roads and footpaths", icon: "🛣️" },
    garbage: { label: "Garbage", icon: "🗑️" },
    streetlight: { label: "Streetlights", icon: "💡" },
    water: { label: "Water and drains", icon: "💧" },
    public_space: { label: "Parks and public spaces", icon: "🌳" },
    other: { label: "Something else", icon: "📍" },
  };
  const STATUS = {
    reported: { label: "Reported", color: "#d03b3b" },
    acknowledged: { label: "Acknowledged", color: "#e0a000" },
    in_progress: { label: "In progress", color: "#2a78d6" },
    resolved: { label: "Resolved", color: "#0b8a0b" },
    rejected: { label: "Rejected", color: "#6b6f6a" },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  function ago(d) {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    return fmtDate(d);
  }
  const badge = (status) => `<span class="badge" style="--c:${STATUS[status].color}">${STATUS[status].label}</span>`;

  // ---- toasts
  function toast(msg, type) {
    let box = document.querySelector(".toast-box");
    if (!box) { box = document.createElement("div"); box.className = "toast-box"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.innerHTML = ""; // one message at a time
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  // ---- API
  async function api(path, opts) {
    opts = opts || {};
    await Auth.ready;
    const headers = {};
    if (opts.auth || Auth.user) {
      const t = await Auth.token();
      if (t) headers.Authorization = "Bearer " + t;
    }
    let body;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
    let res;
    try {
      res = await fetch((window.AWAAZ.API_BASE || "") + path, { method: opts.method || "GET", headers, body });
    } catch (e) {
      throw Object.assign(new Error("Cannot reach the server. Check your internet connection and try again."), { status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw Object.assign(new Error((data && data.error) || "Something went wrong. Please try again."), { status: res.status, data });
    return data;
  }

  // Who is this? { admin, official }. Fetched once per page; guests are neither.
  let rolePromise = null;
  const state = { role: { admin: false, official: false } };
  function getRole() {
    return Auth.ready.then((u) => {
      if (!u) return state.role;
      if (!rolePromise) rolePromise = api("/api/me", { auth: true }).then((r) => (state.role = r)).catch(() => state.role);
      return rolePromise;
    });
  }

  function requireLogin() {
    return Auth.ready.then(async (u) => {
      if (!u) {
        const next = location.pathname.replace(/^\//, "") + location.search;
        location.replace("login.html?next=" + encodeURIComponent(next));
        return new Promise(() => {}); // stop the page script while redirecting
      }
      const role = await getRole();
      if (role.official && /^(report|my)$/.test(document.body.dataset.page || "")) { // admin-only accounts have no citizen pages
        location.replace("admin.html");
        return new Promise(() => {});
      }
      return u;
    });
  }

  // ---- header / footer
  const PIN = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2C9.9 2 5 6.8 5 12.8 5 20.7 16 30 16 30s11-9.3 11-17.2C27 6.8 22.1 2 16 2z" fill="#f4b400" stroke="#fff" stroke-width="2"/><circle cx="16" cy="12.5" r="4.2" fill="#0e5b3f"/></svg>';
  function buildChrome() {
    const page = document.body.dataset.page || "";
    const link = (href, label, key) => `<a href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`;
    const h = document.getElementById("site-header");
    if (h) {
      h.className = "site-header";
      h.innerHTML = `<div class="bar">
        <a class="brand" href="index.html" aria-label="Awaaz Map home">${PIN}<span>Awaaz Map</span></a>
        <nav class="nav" id="nav" aria-label="Main">
          ${link("index.html", "Map", "home")}${link("analytics.html", "Numbers", "analytics")}${link("my.html", "My reports", "my")}
        </nav>
        <div class="header-right">
          <a class="btn btn-primary btn-small" href="report.html"><span class="long">Report a problem</span><span class="short">Report</span></a>
          <div id="auth-slot"></div>
          <button class="menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav">☰</button>
        </div></div><div class="lane" aria-hidden="true"></div>`;
      const nav = document.getElementById("nav"), mb = document.getElementById("menu-btn");
      mb.addEventListener("click", () => { const o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o); });
      Auth.onChange(renderAuth);
      getRole().then(applyRole);
    }
    const f = document.getElementById("site-footer");
    if (f) {
      f.className = "site-footer";
      f.innerHTML = `<div class="wrap"><span>Awaaz Map is a citizen project. Reports are public so neighbours can back them up.</span><span id="footer-admin" hidden><a href="admin.html">Admin</a></span></div>`;
    }
  }
  // Admins and admin-only accounts get an Admin link; admin-only accounts lose the citizen links
  function applyRole(role) {
    const nav = document.getElementById("nav");
    if (nav && (role.admin || role.official) && !nav.querySelector('[href="admin.html"]')) {
      const page = document.body.dataset.page || "";
      nav.insertAdjacentHTML("beforeend", `<a href="admin.html"${page === "admin" ? ' aria-current="page"' : ""}>Admin</a>`);
    }
    if (role.official) {
      const my = nav && nav.querySelector('[href="my.html"]'); if (my) my.remove();
      const rep = document.querySelector(".header-right .btn-primary"); if (rep) rep.remove();
    }
    const f = document.getElementById("footer-admin"); if (f) f.hidden = !(role.admin || role.official);
    renderAuth(Auth.user);
  }
  function renderAuth(u) {
    const slot = document.getElementById("auth-slot");
    if (!slot) return;
    if (!u) { slot.innerHTML = `<a class="btn btn-light btn-small" href="login.html?next=${encodeURIComponent(location.pathname.replace(/^\//, "") + location.search)}">Log in</a>`; return; }
    const name = u.displayName || (u.email || "").split("@")[0] || "You";
    const av = u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc(name.charAt(0).toUpperCase());
    slot.innerHTML = `<div class="user-menu"><button class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false"><span class="avatar">${av}</span><span class="user-name">${esc(name)}</span></button>
      <div class="dropdown" id="dropdown" hidden>${state.role.official ? "" : '<a href="my.html">My reports</a>'}${state.role.admin || state.role.official ? '<a href="admin.html">Admin page</a>' : ""}<button id="logout">Log out</button></div></div>`;
    const btn = document.getElementById("user-btn"), dd = document.getElementById("dropdown");
    btn.addEventListener("click", (e) => { e.stopPropagation(); dd.hidden = !dd.hidden; btn.setAttribute("aria-expanded", !dd.hidden); });
    document.addEventListener("click", () => { dd.hidden = true; btn.setAttribute("aria-expanded", "false"); });
    document.getElementById("logout").addEventListener("click", async () => { await Auth.logout(); location.href = "index.html"; });
  }

  // a list row used on the home page and My reports
  function rowHTML(i, tag) {
    const c = CATS[i.category];
    return `<${tag || "a"} class="row" ${tag === "div" ? "" : `href="issue.html?id=${esc(i.id)}"`} data-id="${esc(i.id)}" style="--c:${STATUS[i.status].color}">
      <div class="row-top">${badge(i.status)}<span class="votes" title="People who said this affects them too">👍 ${i.upvoteCount}</span></div>
      <div class="row-title">${esc(i.title)}</div>
      <div class="row-meta"><span>${c.icon} ${esc(c.label)}</span><span>${i.status === "resolved" ? "Fixed in " + plural(i.daysOpen, "day") : "Open " + plural(i.daysOpen, "day")}</span>${i.address ? `<span>${esc(i.address)}</span>` : ""}</div>
    </${tag || "a"}>`;
  }

  // Marker icon for Leaflet
  function pinIcon(i) {
    return L.divIcon({ className: "pin-wrap", html: `<div class="pin" style="--c:${STATUS[i.status].color}"><span>${CATS[i.category].icon}</span></div>`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
  }
  function tiles() {
    return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
  }


  // place search (OpenStreetMap Nominatim). Runs only when the user submits
  function placeSearch(root, onPick) {
    const input = root.querySelector("input"), list = root.querySelector(".place-results");
    const country = window.AWAAZ.SEARCH_COUNTRY === undefined ? "in" : window.AWAAZ.SEARCH_COUNTRY;
    const close = () => { list.hidden = true; };
    const go = root.querySelector("button");
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    go.addEventListener("click", run);
    async function run() {
      const q = input.value.trim();
      if (q.length < 3) return;
      list.hidden = false; list.innerHTML = '<li class="place-note">Searching…</li>';
      try {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=" + encodeURIComponent(q) + (country ? "&countrycodes=" + encodeURIComponent(country) : "");
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        const found = await r.json();
        if (!found.length) { list.innerHTML = '<li class="place-note">No place found. Try adding the city name.</li>'; return; }
        list.innerHTML = found.map((f, i) => `<li><button type="button" data-i="${i}">${esc(f.display_name)}</button></li>`).join("");
        list._found = found;
      } catch (err) { list.innerHTML = '<li class="place-note">Search is not working right now. Try again in a moment.</li>'; }
    }
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]"); if (!b) return;
      const f = list._found[+b.dataset.i]; close();
      input.value = f.display_name.split(",").slice(0, 2).join(",");
      const bb = f.boundingbox && f.boundingbox.map(Number); // [south, north, west, east]
      onPick({ lat: +f.lat, lng: +f.lon, bounds: bb ? [[bb[0], bb[2]], [bb[1], bb[3]]] : null });
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.addEventListener("click", (e) => { if (!root.contains(e.target)) close(); });
  }

  window.CATS = CATS; window.STATUS = STATUS;
  window.U = { getRole, esc, fmtDate, ago, plural, badge, toast, api, requireLogin, rowHTML, pinIcon, tiles, reduced, placeSearch };
  document.addEventListener("DOMContentLoaded", buildChrome);
})();
