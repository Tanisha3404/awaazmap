(function () {
  const { esc, api, rowHTML, pinIcon, tiles, plural } = U;
  const A = window.AWAAZ;
  const map = L.map("map", { zoomControl: true }).setView(A.DEFAULT_CENTER, A.DEFAULT_ZOOM);
  tiles().addTo(map);
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  const state = { category: "", status: "", q: "", sort: "newest" };
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  let first = true, seq = 0, timer;

  // ticker
  function countUp(el, to, dec) {
    if (!window.gsap || U.reduced()) { el.textContent = dec ? to.toFixed(1) : to; return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.1, ease: "power2.out", onUpdate: () => (el.textContent = dec ? o.v.toFixed(1) : Math.round(o.v)) });
  }
  api("/api/issues/stats").then((s) => {
    const t = document.getElementById("ticker");
    if (!s.total) { t.textContent = "No problems reported yet. Be the first to put one on the map."; return; }
    const fixed = s.byStatus.resolved || 0;
    t.innerHTML = `<b id="n-total">0</b> problems reported on this map. <b id="n-fixed">0</b> fixed` + (s.avgDaysToResolve != null ? `, taking <b id="n-days">0</b> days on average.` : ".");
    countUp(document.getElementById("n-total"), s.total);
    countUp(document.getElementById("n-fixed"), fixed);
    if (s.avgDaysToResolve != null) countUp(document.getElementById("n-days"), s.avgDaysToResolve, true);
  }).catch(() => { document.getElementById("ticker").textContent = "Reports could not be loaded."; });

  // data
  function query(useBox) {
    const p = new URLSearchParams({ limit: 200, sort: state.sort });
    if (state.category) p.set("category", state.category);
    if (state.status) p.set("status", state.status);
    if (state.q) p.set("q", state.q);
    if (useBox) { const b = map.getBounds(); p.set("bbox", [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(6)).join(",")); }
    return p.toString();
  }
  function popup(i) {
    return `<div>${U.badge(i.status)}<div class="popup-title">${esc(i.title)}</div><div class="popup-meta">${i.status === "resolved" ? "Fixed in " + plural(i.daysOpen, "day") : "Open " + plural(i.daysOpen, "day")} · ${i.upvoteCount} agree</div><a class="btn btn-green btn-small" href="issue.html?id=${esc(i.id)}">See details</a></div>`;
  }
  function draw(items, total) {
    layer.clearLayers(); markers.clear();
    items.forEach((i) => {
      const m = L.marker([i.location.lat, i.location.lng], { icon: pinIcon(i), title: i.title, riseOnHover: true }).bindPopup(popup(i));
      m.on("popupopen", () => highlight(i.id)); m.on("popupclose", () => highlight(null));
      m.addTo(layer); markers.set(i.id, m);
    });
    listEl.innerHTML = items.length ? items.map((i) => rowHTML(i)).join("") : `<div class="empty"><h3>Nothing here yet</h3><p>No reports match these filters in this part of the map.</p><a class="btn btn-primary" href="report.html">Report a problem</a></div>`;
    countEl.textContent = total > items.length ? `Showing ${items.length} of ${total}. Zoom in to see the rest.` : `${plural(items.length, "report")} in view`;
  }
  async function load(useBox) {
    const my = ++seq;
    try {
      const d = await api("/api/issues?" + query(useBox));
      if (my !== seq) return;
      if (first) {
        first = false;
        draw(d.items, d.total);
        const pts = d.items.map((i) => [i.location.lat, i.location.lng]);
        if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15 });
        return;
      }
      draw(d.items, d.total);
    } catch (e) { countEl.textContent = e.message; }
  }
  function highlight(id) {
    document.querySelectorAll(".row.active").forEach((r) => r.classList.remove("active"));
    if (id) { const r = listEl.querySelector(`[data-id="${id}"]`); if (r) { r.classList.add("active"); r.scrollIntoView({ block: "nearest" }); } }
  }
  map.on("moveend", () => { if (first) return; clearTimeout(timer); timer = setTimeout(() => load(true), 350); });

  // list interactions: clicking a row shows it on the map instead of leaving the page
  listEl.addEventListener("click", (e) => {
    const row = e.target.closest(".row"); if (!row) return;
    if (e.target.closest("a") && e.target.closest("a") !== row) return;
    if (matchMedia("(max-width: 900px)").matches) return; // on phones open the full page
    e.preventDefault();
    const m = markers.get(row.dataset.id); if (!m) return;
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 16), { duration: U.reduced() ? 0 : 0.6 });
    m.openPopup();
  });
  listEl.addEventListener("mouseover", (e) => { const r = e.target.closest(".row"); const m = r && markers.get(r.dataset.id); if (m && m._icon) m._icon.firstChild.classList.add("active"); });
  listEl.addEventListener("mouseout", (e) => { const r = e.target.closest(".row"); const m = r && markers.get(r.dataset.id); if (m && m._icon) m._icon.firstChild.classList.remove("active"); });

  // filters
  const chips = document.getElementById("chips");
  chips.innerHTML = `<button class="chip" aria-pressed="true" data-c="">All</button>` + Object.entries(CATS).map(([k, c]) => `<button class="chip" aria-pressed="false" data-c="${k}">${c.icon} ${esc(c.label)}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
    state.category = b.dataset.c; load(true);
  });
  const status = document.getElementById("f-status");
  status.innerHTML = `<option value="">Any status</option>` + Object.entries(STATUS).filter(([k]) => k !== "rejected").map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");
  status.addEventListener("change", () => { state.status = status.value; load(true); });
  document.getElementById("f-sort").addEventListener("change", (e) => { state.sort = e.target.value; load(true); });
  let st; document.getElementById("f-q").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => { state.q = e.target.value.trim(); load(true); }, 300); });

  // jump to a place
  U.placeSearch(document.getElementById("place-search"), (pl) => {
    if (pl.bounds) map.fitBounds(pl.bounds, { maxZoom: 17 }); else map.flyTo([pl.lat, pl.lng], 16);
  });

  // locate me
  function geoError(e) {
    if (e && e.code === 1) return "Location is blocked for this site. Click the lock icon next to the address bar, set Location to Allow, then try again.";
    if (e && e.code === 2) return "Your device could not find its location. Turn on Location in your system settings and try again.";
    return "Finding your location took too long. Try again, or tap the map instead.";
  }
  document.getElementById("locate").addEventListener("click", () => {
    if (!navigator.geolocation) return U.toast("Your browser cannot share its location.", "error");
    const btn = document.getElementById("locate"); btn.disabled = true; btn.textContent = "Finding you…";
    const done = () => { btn.disabled = false; btn.textContent = "Find my location"; };
    navigator.geolocation.getCurrentPosition(
      (p) => { done(); document.querySelector(".toast-box") && (document.querySelector(".toast-box").innerHTML = ""); map.flyTo([p.coords.latitude, p.coords.longitude], 16); },
      (e) => { done(); U.toast(geoError(e), "error"); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });

  // phone: map / list toggle
  const home = document.getElementById("home");
  document.querySelectorAll("[data-view]").forEach((b) => {
    if (b.closest("#home")) return;
    b.addEventListener("click", () => {
      home.dataset.view = b.dataset.view;
      document.querySelectorAll(".mobile-toggle [data-view]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      if (b.dataset.view === "map") setTimeout(() => map.invalidateSize(), 50);
    });
  });
  load(false);
})();
