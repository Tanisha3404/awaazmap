(function () {
  const { esc, api, fmtDate, plural, badge, pinIcon, tiles } = U;
  const id = new URLSearchParams(location.search).get("id");
  const isNew = new URLSearchParams(location.search).get("new") === "1";
  const root = document.getElementById("issue");
  if (!id) return fail("No report selected.");

  function fail(text) {
    root.innerHTML = `<div class="empty"><h2>This report is not available</h2><p>${esc(text)}</p><a class="btn btn-green" href="index.html">Back to the map</a></div>`;
  }
  Auth.ready.then(() => api("/api/issues/" + encodeURIComponent(id))).then(render).catch((e) => fail(e.status === 404 ? "It may have been removed, or the link is wrong." : e.message));

  function render(i) {
    document.title = i.title + " – Awaaz Map";
    const st = STATUS[i.status], cat = CATS[i.category];
    const resolved = i.status === "resolved";
    root.innerHTML = `
    <div class="issue-grid">
      <div>
        <div class="issue-head">
          <div class="meta">${badge(i.status)}<span class="cat">${cat.icon} ${esc(cat.label)}</span>${i.demo ? '<span class="cat">Sample report</span>' : ""}</div>
          <h1>${esc(i.title)}</h1>
          <div class="stamp-row"><span class="stamp" id="stamp" style="--c:${st.color}">${st.label}</span></div>
        </div>
        <div id="media"></div>
        <h2 style="margin-top:28px">What is wrong</h2>
        <p style="white-space:pre-line;max-width:70ch">${esc(i.description)}</p>
        <h2 style="margin-top:28px">What has happened since</h2>
        <ol class="timeline">${i.statusHistory.map((h) => `<li style="--c:${STATUS[h.status].color}"><b>${STATUS[h.status].label}</b> <span class="when">${fmtDate(h.at)}</span>${h.note ? `<div>${esc(h.note)}</div>` : ""}</li>`).join("")}</ol>
      </div>
      <aside class="side-stack">
        <div class="sign-panel" aria-live="polite">
          <div class="clock-label">${resolved ? "Fixed after" : "Open for"}</div>
          <div class="odometer" id="odo" aria-label="${plural(i.daysOpen, "day")}"></div>
        </div>
        <div class="side-card">
          <button class="btn btn-ghost upvote" id="upvote" aria-pressed="${i.hasUpvoted}"></button>
          <p class="hint" id="upvote-hint" style="margin:8px 0 0"></p>
        </div>
        <div class="side-card">
          <div class="mini-map" id="mini"></div>
          <dl class="facts">
            ${i.address ? `<div><dt>Where</dt><dd>${esc(i.address)}</dd></div>` : ""}
            <div><dt>Reported</dt><dd>${fmtDate(i.createdAt)} by ${esc(i.reporterName)}</dd></div>
          </dl>
        </div>
        <div class="side-card"><div class="share">
          <a class="btn btn-green btn-small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(i.title + " – " + location.href.split("&new=1")[0])}">Share on WhatsApp</a>
          <button class="btn btn-ghost btn-small" id="copy">Copy link</button>
        </div></div>
      </aside>
    </div>`;

    media(i); odometer(i.daysOpen); upvote(i); miniMap(i); stamp(i);
    document.getElementById("copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(location.href.split("&new=1")[0]); U.toast("Link copied."); } catch (e) { U.toast("Copy the address from your browser bar.", "error"); }
    });
    if (isNew) { U.toast("Your report is on the map. Share the link so neighbours can back it up."); history.replaceState(null, "", "issue.html?id=" + encodeURIComponent(i.id)); }
  }
y
  // before/after slider
  function media(i) {
    const el = document.getElementById("media");
    if (i.afterPhoto && i.photos[0]) {
      el.innerHTML = `<div class="ba" id="ba"><img src="${esc(i.photos[0])}" alt="Before the fix"><img class="after" src="${esc(i.afterPhoto)}" alt="After the fix"><span class="ba-tag l">Before</span><span class="ba-tag r">After</span><div class="ba-line"></div><div class="ba-knob" aria-hidden="true">↔</div><input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after"></div>`;
      const ba = document.getElementById("ba"), r = ba.querySelector("input");
      r.addEventListener("input", () => ba.style.setProperty("--pos", r.value + "%"));
      if (window.gsap && !U.reduced()) { // a short sweep to show the slider moves
        const o = { v: 92 }; ba.style.setProperty("--pos", "92%"); r.value = 92;
        gsap.to(o, { v: 50, duration: 1.1, delay: 0.3, ease: "power2.inOut", onUpdate: () => { ba.style.setProperty("--pos", o.v + "%"); r.value = o.v; } });
      }
    } else if (i.photos.length) {
      el.innerHTML = `<div class="gallery-main"><img id="big" src="${esc(i.photos[0])}" alt="Photo of the problem"></div>` +
        (i.photos.length > 1 ? `<div class="gallery-thumbs">${i.photos.map((p, k) => `<button data-k="${k}" aria-pressed="${k === 0}" aria-label="Show photo ${k + 1}"><img src="${esc(p)}" alt=""></button>`).join("")}</div>` : "");
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-k]"); if (!b) return;
        document.getElementById("big").src = i.photos[+b.dataset.k];
        el.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      });
    } else {
      el.innerHTML = `<div class="no-photo">No photo was added to this report</div>`;
    }
  }

  // days-open odometer
  function odometer(days) {
    const el = document.getElementById("odo");
    const digits = String(days).split("");
    el.innerHTML = digits.map(() => '<span class="digit">0</span>').join("") + `<span class="unit">${days === 1 ? "day" : "days"}</span>`;
    const boxes = [...el.querySelectorAll(".digit")];
    const set = (n) => { const s = String(Math.round(n)).padStart(digits.length, "0"); boxes.forEach((b, k) => (b.textContent = s[k])); };
    if (window.gsap && !U.reduced() && days > 0) { const o = { v: 0 }; gsap.to(o, { v: days, duration: Math.min(1.6, 0.5 + days / 60), ease: "power3.out", onUpdate: () => set(o.v), onComplete: () => set(days) }); }
    else set(days);
  }

  // status stamp: slams down once
  function stamp(i) {
    const el = document.getElementById("stamp");
    if (!window.gsap || U.reduced()) return;
    gsap.fromTo(el, { scale: 2.6, opacity: 0, rotation: -16 }, { scale: 1, opacity: 1, rotation: -6, duration: 0.32, delay: 0.25, ease: "power4.in",
      onComplete: () => gsap.fromTo(el, { y: -4 }, { y: 0, duration: 0.35, ease: "elastic.out(1.4,0.35)" }) });
  }

  // upvote
  function upvote(i) {
    const b = document.getElementById("upvote"), hint = document.getElementById("upvote-hint");
    let up = i.hasUpvoted, n = i.upvoteCount;
    const paint = () => { b.setAttribute("aria-pressed", up); b.textContent = up ? `You agree · ${n}` : `This affects me too · ${n}`; };
    paint();
    if (i.isMine) { b.disabled = true; b.textContent = n === 1 ? "1 person agrees" : `${n} people agree`; hint.textContent = "This is your report."; return; }
    hint.textContent = "More agreement moves a report up the list.";
    b.addEventListener("click", async () => {
      if (!Auth.user) { location.href = "login.html?next=" + encodeURIComponent("issue.html?id=" + i.id); return; }
      b.disabled = true;
      try { const r = await api("/api/issues/" + encodeURIComponent(i.id) + "/upvote", { method: "POST", auth: true }); up = r.upvoted; n = r.upvoteCount; paint(); }
      catch (e) { U.toast(e.message, "error"); }
      b.disabled = false;
    });
  }

  function miniMap(i) {
    const m = L.map("mini", { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false }).setView([i.location.lat, i.location.lng], 16);
    tiles().addTo(m);
    L.marker([i.location.lat, i.location.lng], { icon: pinIcon(i), interactive: false }).addTo(m);
    document.getElementById("mini").addEventListener("click", () => window.open(`https://www.openstreetmap.org/?mlat=${i.location.lat}&mlon=${i.location.lng}#map=18/${i.location.lat}/${i.location.lng}`, "_blank", "noopener"));
    document.getElementById("mini").style.cursor = "pointer";
  }
})();
