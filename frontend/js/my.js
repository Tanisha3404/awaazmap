(function () {
  const { rowHTML, api, plural } = U;
  U.requireLogin().then(() => api("/api/issues/mine", { auth: true })).then((d) => {
    const box = document.getElementById("my-list");
    if (!d.items.length) {
      box.innerHTML = `<div class="empty"><h3>You have not reported anything yet</h3><p>Spotted a pothole, a broken light or a pile of garbage? Put it on the map.</p><a class="btn btn-primary" href="report.html">Report a problem</a></div>`;
      return;
    }
    const votes = d.items.reduce((s, i) => s + i.upvoteCount, 0), fixed = d.items.filter((i) => i.status === "resolved").length;
    document.getElementById("my-summary").textContent = `${plural(d.items.length, "report")}, ${fixed} fixed, ${plural(votes, "person")} backed you.`;
    box.innerHTML = `<div class="table-wrap" style="background:var(--card)">${d.items.map((i) => rowHTML(i)).join("")}</div>`;
  }).catch((e) => { document.getElementById("my-list").innerHTML = `<div class="alert alert-error">${U.esc(e.message)}</div>`; });
})();
