(function () {
  const { esc, api, badge, fmtDate } = U;
  const root = document.getElementById("admin");
  const state = { status: "", category: "", q: "", page: 1 };
  let current = null;

  U.requireLogin().then(() => api("/api/admin/me", { auth: true })).then(start).catch((e) => {
    if (e.status === 403) {
      root.innerHTML = `<div class="alert alert-info"><b>This account is not an admin yet.</b><p style="margin:8px 0 0">To make it one, copy this ID into the backend settings (the <code>.env</code> file, or Environment on Render), then restart the server. Use <code>ADMIN_UIDS</code> for a full admin who can also report, or <code>OFFICIAL_UIDS</code> for an admin-only account:</p>
      <p style="margin:10px 0"><code id="uid" style="font-size:1.1rem;background:#fff;padding:6px 10px;border-radius:6px;display:inline-block;word-break:break-all">${esc(e.data && e.data.uid)}</code> <button class="btn btn-ghost btn-small" id="copy-uid">Copy</button></p></div>`;
      document.getElementById("copy-uid").addEventListener("click", () => navigator.clipboard.writeText(e.data.uid).then(() => U.toast("Copied.")));
    } else root.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  });

  function start() {
    root.innerHTML = `
      <div class="tiles" id="tiles"></div>
      <div class="toolbar">
        <input type="search" id="a-q" placeholder="Search reports" aria-label="Search reports">
        <select id="a-status" aria-label="Status"><option value="">Every status</option>${Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("")}</select>
        <select id="a-cat" aria-label="Category"><option value="">Every category</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join("")}</select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Report</th><th>Category</th><th>Status</th><th>Open</th><th>Agree</th><th></th></tr></thead><tbody id="rows"><tr><td colspan="6" class="loading">Loading…</td></tr></tbody></table></div>
      <div class="pager"><button class="btn btn-ghost btn-small" id="prev">Previous</button><span id="pg" class="muted"></span><button class="btn btn-ghost btn-small" id="nextp">Next</button></div>
      <dialog id="dlg" aria-labelledby="dlg-title">
        <h2 id="dlg-title" style="font-size:1.5rem"></h2>
        <div id="dlg-msg" class="alert alert-error" hidden></div>
        <div class="field"><label for="d-status">Status</label><select id="d-status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("")}</select></div>
        <div class="field"><label for="d-note">Note shown on the public timeline</label><textarea id="d-note" maxlength="500" style="min-height:80px"></textarea><div class="hint">Required when rejecting a report.</div></div>
        <button class="btn btn-green" id="d-save">Save status</button>
        <section><label for="d-photo">After photo (shown as the before/after slider)</label><input type="file" id="d-photo" accept="image/jpeg,image/png,image/webp"><button class="btn btn-ghost btn-small" id="d-up" style="margin-top:10px">Upload photo</button></section>
        <section><button class="btn btn-danger btn-small" id="d-del">Delete this report</button></section>
        <section><button class="btn btn-ghost" id="d-close">Close</button></section>
      </dialog>`;
    const rows = document.getElementById("rows"), dlg = document.getElementById("dlg"), dmsg = document.getElementById("dlg-msg");

    async function stats() {
      const s = await api("/api/admin/stats", { auth: true });
      const t = (n, label, c) => `<div class="tile" style="--c:${c}"><b>${n}</b><span>${label}</span></div>`;
      document.getElementById("tiles").innerHTML = t(s.total, "All reports", "var(--sign)") + ["reported", "acknowledged", "in_progress", "resolved", "rejected"].map((k) => t(s.byStatus[k] || 0, STATUS[k].label, STATUS[k].color)).join("");
    }
    async function load() {
      const p = new URLSearchParams({ page: state.page, limit: 15, sort: "newest" });
      ["status", "category", "q"].forEach((k) => state[k] && p.set(k, state[k]));
      try {
        const d = await api("/api/admin/issues?" + p, { auth: true });
        rows.innerHTML = d.items.length ? d.items.map((i) => `<tr>
          <td><a href="issue.html?id=${esc(i.id)}">${esc(i.title)}</a><div class="muted" style="font-size:.9rem">${fmtDate(i.createdAt)} by ${esc(i.reporterName)}${i.demo ? " (sample)" : ""}</div></td>
          <td>${CATS[i.category].icon} ${esc(CATS[i.category].label)}</td><td>${badge(i.status)}</td><td>${i.daysOpen} d</td><td>${i.upvoteCount}</td>
          <td><button class="btn btn-ghost btn-small" data-edit="${esc(i.id)}">Manage</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">No reports match.</td></tr>`;
        rows._items = d.items;
        document.getElementById("pg").textContent = `Page ${d.page} of ${d.pages} (${d.total} reports)`;
        document.getElementById("prev").disabled = d.page <= 1;
        document.getElementById("nextp").disabled = d.page >= d.pages;
      } catch (e) { rows.innerHTML = `<tr><td colspan="6"><div class="alert alert-error">${esc(e.message)}</div></td></tr>`; }
    }
    function dlgError(t) { dmsg.hidden = !t; dmsg.textContent = t || ""; }

    rows.addEventListener("click", (e) => {
      const b = e.target.closest("[data-edit]"); if (!b) return;
      current = rows._items.find((i) => i.id === b.dataset.edit);
      document.getElementById("dlg-title").textContent = current.title;
      document.getElementById("d-status").value = current.status;
      document.getElementById("d-note").value = ""; document.getElementById("d-photo").value = ""; dlgError("");
      dlg.showModal();
    });
    document.getElementById("d-close").addEventListener("click", () => dlg.close());
    document.getElementById("d-save").addEventListener("click", async () => {
      dlgError("");
      try {
        await api(`/api/admin/issues/${current.id}/status`, { method: "PATCH", auth: true, body: { status: document.getElementById("d-status").value, note: document.getElementById("d-note").value.trim() } });
        dlg.close(); U.toast("Status updated."); load(); stats();
      } catch (e) { dlgError(e.message); }
    });
    document.getElementById("d-up").addEventListener("click", async () => {
      const f = document.getElementById("d-photo").files[0]; if (!f) return dlgError("Choose a photo first.");
      const fd = new FormData(); fd.append("photo", f); dlgError("");
      try { await api(`/api/admin/issues/${current.id}/after-photo`, { method: "POST", auth: true, form: fd }); dlg.close(); U.toast("After photo saved."); load(); }
      catch (e) { dlgError(e.message); }
    });
    document.getElementById("d-del").addEventListener("click", async () => {
      if (!confirm("Delete this report and its photos for good?")) return;
      try { await api(`/api/admin/issues/${current.id}`, { method: "DELETE", auth: true }); dlg.close(); U.toast("Report deleted."); load(); stats(); }
      catch (e) { dlgError(e.message); }
    });
    let t; document.getElementById("a-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; load(); }, 300); });
    document.getElementById("a-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
    document.getElementById("a-cat").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; load(); });
    document.getElementById("prev").addEventListener("click", () => { state.page--; load(); });
    document.getElementById("nextp").addEventListener("click", () => { state.page++; load(); });
    stats(); load();
  }
})();
