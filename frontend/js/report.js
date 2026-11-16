(function () {
  const { esc, api, pinIcon, tiles } = U;
  const A = window.AWAAZ;
  U.requireLogin().then(init);

  function init() {
    const form = document.getElementById("report-form");
    const stepEls = [...document.querySelectorAll("[data-step]")];
    const stepNav = [...document.querySelectorAll(".steps li")];
    const S = { lat: null, lng: null, files: [], step: 0 };

    // category tiles
    document.getElementById("cats").innerHTML = Object.entries(CATS).map(([k, c]) =>
      `<label class="cat-tile"><input type="radio" name="category" value="${k}"><span><b>${c.icon}</b>${esc(c.label)}</span></label>`).join("");

    // map
    const map = L.map("pick-map").setView(A.DEFAULT_CENTER, A.DEFAULT_ZOOM);
    tiles().addTo(map);
    let pin = null;
    const icon = L.divIcon({ className: "pin-wrap", html: '<div class="pin" style="--c:#d03b3b"><span>📍</span></div>', iconSize: [32, 32], iconAnchor: [16, 32] });
    function place(lat, lng, pan) {
      S.lat = lat; S.lng = lng;
      if (!pin) {
        pin = L.marker([lat, lng], { icon, draggable: true, keyboard: true, title: "Drag to the exact spot" }).addTo(map);
        pin.on("dragend", () => { const p = pin.getLatLng(); place(p.lat, p.lng); });
      } else pin.setLatLng([lat, lng]);
      if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 17));
      document.getElementById("loc-hint").textContent = `Pin placed (${lat.toFixed(5)}, ${lng.toFixed(5)}). Drag it to adjust.`;
      document.getElementById("e-loc").textContent = "";
      lookupAddress(lat, lng); nearby(lat, lng);
    }
    function geoError(e) {
    if (e && e.code === 1) return "Location is blocked for this site. Click the lock icon next to the address bar, set Location to Allow, then try again.";
    if (e && e.code === 2) return "Your device could not find its location. Turn on Location in your system settings and try again.";
    return "Finding your location took too long. Try again, or tap the map instead.";
  }
    U.placeSearch(document.getElementById("place-search"), (pl) => { if (pl.bounds) map.fitBounds(pl.bounds, { maxZoom: 18 }); else map.setView([pl.lat, pl.lng], 17); });
    map.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
    document.getElementById("here").addEventListener("click", () => {
      if (!navigator.geolocation) return U.toast("Your browser cannot share its location. Tap the map instead.", "error");
      navigator.geolocation.getCurrentPosition((p) => place(p.coords.latitude, p.coords.longitude, true), (e) => U.toast(geoError(e) + " You can also tap the map.", "error"), { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    });
    api("/api/issues?limit=200").then((d) => { // start near existing reports when there are some
      if (!S.lat && d.items.length) map.fitBounds(L.latLngBounds(d.items.map((i) => [i.location.lat, i.location.lng])).pad(0.2), { maxZoom: 15 });
    }).catch(() => {});

    let addrTimer;
    const addr = form.address;
    let addrTouched = false;
    addr.addEventListener("input", () => (addrTouched = true));
    function lookupAddress(lat, lng) {
      clearTimeout(addrTimer);
      addrTimer = setTimeout(async () => {
        if (addrTouched && addr.value) return;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } });
          const j = await r.json();
          const a = j.address || {};
          const text = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.city_district, a.city || a.town || a.village].filter(Boolean).join(", ");
          if (text && !(addrTouched && addr.value)) addr.value = text.slice(0, 200);
        } catch (e) { /* the address box can be typed by hand */ }
      }, 600);
    }
    async function nearby(lat, lng) {
      const d = 0.0012, box = document.getElementById("nearby");
      try {
        const r = await api(`/api/issues?limit=5&bbox=${[lng - d, lat - d, lng + d, lat + d].join(",")}`);
        const open = r.items.filter((i) => i.status !== "resolved");
        if (!open.length) { box.hidden = true; return; }
        box.hidden = false;
        box.innerHTML = `<b>Is it one of these?</b> Reports already within about 130 metres. Backing an existing report helps more than a duplicate.<ul>${open.map((i) => `<li><a href="issue.html?id=${esc(i.id)}" target="_blank" rel="noopener">${esc(i.title)}</a> (${STATUS[i.status].label})</li>`).join("")}</ul>`;
      } catch (e) { box.hidden = true; }
    }

    // photos
    const fileInput = document.getElementById("photos");
    function shrink(file) {
      return new Promise((resolve) => {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
          const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
          if (k === 1 && file.size < 1.5 * 1024 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
          const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });
    }
    function renderThumbs() {
      document.getElementById("thumbs").innerHTML = S.files.map((f, i) => `<div class="thumb"><img src="${f.url}" alt="Photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join("");
      document.getElementById("e-photos").textContent = "";
    }
    fileInput.addEventListener("change", async () => {
      const chosen = [...fileInput.files]; fileInput.value = "";
      for (const f of chosen) {
        if (S.files.length >= 3) { document.getElementById("e-photos").textContent = "You can add up to 3 photos."; break; }
        const out = await shrink(f);
        if (out.size > 5 * 1024 * 1024) { document.getElementById("e-photos").textContent = "That photo is larger than 5 MB even after shrinking. Try another."; continue; }
        S.files.push({ file: out, url: URL.createObjectURL(out) });
      }
      renderThumbs();
    });
    document.getElementById("thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      const [x] = S.files.splice(+b.dataset.rm, 1); URL.revokeObjectURL(x.url); renderThumbs();
    });

    // counters
    const count = (el, out, max) => el.addEventListener("input", () => (out.textContent = `${el.value.length}/${max}`));
    count(form.title, document.getElementById("c-title"), 120);
    count(form.description, document.getElementById("c-desc"), 1500);

    // step navigation + validation
    const err = (id, text, field) => { document.getElementById(id).textContent = text; if (field) field.classList.toggle("invalid", !!text); return !text; };
    function valid(n) {
      if (n === 0) return err("e-loc", S.lat == null ? "Tap the map or use your location to place the pin." : "");
      if (n === 1) {
        const ok = [
          err("e-cat", form.category.value ? "" : "Choose what kind of problem this is."),
          err("e-title", form.title.value.trim().length >= 5 ? "" : "Give it a short title of at least 5 characters.", form.title),
          err("e-desc", form.description.value.trim().length >= 10 ? "" : "Describe the problem in at least 10 characters.", form.description),
        ];
        return ok.every(Boolean);
      }
      return true;
    }
    function show(n) {
      S.step = n;
      stepEls.forEach((el, i) => (el.hidden = i !== n));
      stepNav.forEach((li, i) => { li.classList.toggle("done", i < n); if (i === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
      if (n === 0) setTimeout(() => map.invalidateSize(), 30);
      if (n === 2) review();
      if (S.moved) window.scrollTo({ top: 0, behavior: U.reduced() ? "auto" : "smooth" });
      if (S.moved) { const h = stepEls[n].querySelector("h2"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
      S.moved = true;
    }
    function review() {
      const c = CATS[form.category.value];
      document.getElementById("review").innerHTML = `<dl><dt>Problem</dt><dd>${esc(form.title.value.trim())}</dd><dt>Kind</dt><dd>${c.icon} ${esc(c.label)}</dd><dt>Place</dt><dd>${esc(form.address.value || "Pin at " + S.lat.toFixed(5) + ", " + S.lng.toFixed(5))}</dd></dl>`;
    }
    document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => { if (valid(S.step)) show(S.step + 1); }));
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => show(S.step - 1)));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (S.step !== 2) return;
      if (!valid(0)) return show(0);
      if (!valid(1)) return show(1);
      const btn = document.getElementById("send"), msg = document.getElementById("e-send");
      btn.disabled = true; btn.textContent = "Sending…"; msg.hidden = true;
      const fd = new FormData();
      fd.append("title", form.title.value.trim()); fd.append("description", form.description.value.trim());
      fd.append("category", form.category.value); fd.append("lat", S.lat); fd.append("lng", S.lng);
      fd.append("address", form.address.value.trim());
      S.files.forEach((f) => fd.append("photos", f.file, f.file.name || "photo.jpg"));
      try {
        const issue = await api("/api/issues", { method: "POST", form: fd, auth: true });
        location.href = "issue.html?id=" + encodeURIComponent(issue.id) + "&new=1";
      } catch (er) {
        msg.hidden = false; msg.textContent = er.message;
        btn.disabled = false; btn.textContent = "Submit report";
      }
    });
    show(0);
  }
})();
