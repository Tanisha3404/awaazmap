(function () {
  const { esc, api } = U;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const BLUE = "#2a78d6"; // one hue for magnitude; every bar is also labelled on its axis
  Chart.defaults.font.family = '"Barlow", system-ui, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.color = "#566059";
  Chart.defaults.animation = U.reduced() ? false : { duration: 600 };

  function bar(id, labels, data, colors, horizontal, unit) {
    return new Chart(document.getElementById(id), {
      type: "bar",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, maxBarThickness: 34, borderSkipped: "start" }] },
      options: {
        indexAxis: horizontal ? "y" : "x", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed[horizontal ? "x" : "y"]}${unit || ""}` } } },
        scales: {
          [horizontal ? "x" : "y"]: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.07)" }, border: { display: false } },
          [horizontal ? "y" : "x"]: { grid: { display: false }, border: { color: "#9aa39b" } },
        },
      },
    });
  }
  function table(id, head, rows) {
    document.getElementById(id).innerHTML = `<summary>View as a table</summary><table><thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table>`;
  }

  api("/api/issues/stats").then((s) => {
    const fixed = s.byStatus.resolved || 0, open = s.total - fixed - (s.byStatus.rejected || 0);
    const t = (n, label, c) => `<div class="tile" style="--c:${c}"><b>${n}</b><span>${label}</span></div>`;
    document.getElementById("tiles").innerHTML = t(s.total, "Problems reported", "var(--sign)") + t(open, "Still open", STATUS.reported.color) + t(fixed, "Fixed", STATUS.resolved.color) + t(s.avgDaysToResolve == null ? "–" : s.avgDaysToResolve, "Days to fix, on average", STATUS.in_progress.color);
    if (!s.total) { document.getElementById("charts").innerHTML = '<div class="empty"><h3>No reports yet</h3><p>Charts appear once people start reporting.</p></div>'; return; }

    const months = s.byMonth.map((m) => new Date(m.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }));
    bar("c-month", months, s.byMonth.map((m) => m.count), BLUE, false);
    table("t-month", ["Month", "Reports"], months.map((m, i) => [m, s.byMonth[i].count]));

    const stKeys = ["reported", "acknowledged", "in_progress", "resolved"].filter((k) => s.byStatus[k]);
    bar("c-status", stKeys.map((k) => STATUS[k].label), stKeys.map((k) => s.byStatus[k]), stKeys.map((k) => STATUS[k].color), true);
    table("t-status", ["Status", "Reports"], stKeys.map((k) => [STATUS[k].label, s.byStatus[k]]));

    const cats = Object.keys(s.byCategory).sort((a, b) => s.byCategory[b] - s.byCategory[a]);
    bar("c-cat", cats.map((k) => CATS[k].label), cats.map((k) => s.byCategory[k]), BLUE, true);
    table("t-cat", ["Category", "Reports"], cats.map((k) => [CATS[k].label, s.byCategory[k]]));

    const fast = Object.keys(s.avgDaysToResolveByCategory).sort((a, b) => s.avgDaysToResolveByCategory[a] - s.avgDaysToResolveByCategory[b]);
    if (fast.length) {
      bar("c-days", fast.map((k) => CATS[k].label), fast.map((k) => s.avgDaysToResolveByCategory[k]), BLUE, true, " days");
      table("t-days", ["Category", "Average days to fix"], fast.map((k) => [CATS[k].label, s.avgDaysToResolveByCategory[k]]));
    } else document.getElementById("c-days").closest(".chart-card").hidden = true;
  }).catch((e) => { document.getElementById("charts").innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; });
})();
