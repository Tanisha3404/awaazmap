const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let api;
before(async () => { api = await h.start(); });
after(async () => { await api.stop(); });

const create = async (fields, token = "user:alice", photos = []) =>
  api.call("POST", "/api/issues", { form: h.issueForm(fields, photos), token });

test("health check", async () => {
  const r = await api.call("GET", "/api/health");
  assert.equal(r.status, 200);
});

test("creating an issue needs a login", async () => {
  const r = await create({}, null);
  assert.equal(r.status, 401);
});

test("bad token is rejected", async () => {
  const r = await create({}, "garbage");
  assert.equal(r.status, 401);
});

test("create issue with a real photo", async () => {
  const r = await create({}, "user:alice", [{ buf: h.PNG }]);
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "reported");
  assert.equal(r.body.photos.length, 1);
  assert.match(r.body.photos[0], /^\/uploads\/[0-9a-f]{32}\.png$/);
  assert.equal(r.body.isMine, true);
  assert.equal(r.body.reporterUid, undefined);
  assert.equal(r.body.upvotes, undefined);
  assert.equal(r.body.location.lat, 18.52);
});

test("fake image is rejected", async () => {
  const r = await create({}, "user:alice", [{ buf: h.FAKE, name: "x.png" }]);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /JPG, PNG or WebP/);
});

test("more than 3 photos is rejected", async () => {
  const r = await create({}, "user:alice", Array(4).fill({ buf: h.PNG }));
  assert.equal(r.status, 400);
});

test("validation errors", async () => {
  assert.equal((await create({ title: "abc" })).status, 400);
  assert.equal((await create({ category: "nope" })).status, 400);
  assert.equal((await create({ lat: "abc" })).status, 400);
  assert.equal((await create({ lat: "95" })).status, 400);
  assert.equal((await create({ lng: null })).status, 400);
});

test("list filters, search, sort and bbox", async () => {
  await h.Issue.deleteMany({});
  await create({ title: "Garbage heap on lane", category: "garbage", lat: "18.50", lng: "73.80" }, "user:bob");
  await create({ title: "Streetlight is out", category: "streetlight", lat: "19.00", lng: "74.00" }, "user:bob");
  await create({ title: "Water pipe leaking", category: "water", lat: "18.51", lng: "73.81" }, "user:cara");

  let r = await api.call("GET", "/api/issues");
  assert.equal(r.body.total, 3);
  r = await api.call("GET", "/api/issues?category=garbage");
  assert.equal(r.body.total, 1);
  r = await api.call("GET", "/api/issues?q=leaking");
  assert.equal(r.body.items[0].category, "water");
  r = await api.call("GET", "/api/issues?q=" + encodeURIComponent("(.*"));
  assert.equal(r.status, 200); // regex characters are escaped
  r = await api.call("GET", "/api/issues?bbox=73.7,18.4,73.9,18.6");
  assert.equal(r.body.total, 2);
  r = await api.call("GET", "/api/issues?bbox=bad");
  assert.equal(r.status, 400);
  r = await api.call("GET", "/api/issues?sort=oldest&limit=1");
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.pages, 3);
  assert.equal(r.body.items[0].title, "Garbage heap on lane");
});

test("mine lists only my reports", async () => {
  const r = await api.call("GET", "/api/issues/mine", { token: "user:bob" });
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 2);
  assert.equal((await api.call("GET", "/api/issues/mine")).status, 401);
});

test("detail: 404 for unknown or invalid ids", async () => {
  assert.equal((await api.call("GET", "/api/issues/not-an-id")).status, 404);
  assert.equal((await api.call("GET", "/api/issues/64b7f0f0f0f0f0f0f0f0f0f0")).status, 404);
});

test("upvote toggles and cannot be done on own issue", async () => {
  const list = await api.call("GET", "/api/issues?q=leaking");
  const id = list.body.items[0].id;
  let r = await api.call("POST", `/api/issues/${id}/upvote`, { token: "user:dave" });
  assert.deepEqual(r.body, { upvoted: true, upvoteCount: 1 });
  let d = await api.call("GET", `/api/issues/${id}`, { token: "user:dave" });
  assert.equal(d.body.hasUpvoted, true);
  d = await api.call("GET", `/api/issues/${id}`);
  assert.equal(d.body.hasUpvoted, false);
  r = await api.call("POST", `/api/issues/${id}/upvote`, { token: "user:dave" });
  assert.deepEqual(r.body, { upvoted: false, upvoteCount: 0 });
  r = await api.call("POST", `/api/issues/${id}/upvote`, { token: "user:cara" });
  assert.equal(r.status, 400);
  r = await api.call("POST", `/api/issues/${id}/upvote`);
  assert.equal(r.status, 401);
});

test("concurrent upvotes from different users all count; same user never double counts", async () => {
  const id = (await api.call("GET", "/api/issues?q=leaking")).body.items[0].id;
  await Promise.all(["u1", "u2", "u3", "u4", "u5"].map((u) => api.call("POST", `/api/issues/${id}/upvote`, { token: "user:" + u })));
  assert.equal((await api.call("GET", `/api/issues/${id}`)).body.upvoteCount, 5);
  // same user firing twice at once: ends as exactly one of 0 or 1 for that user
  await Promise.all([1, 2].map(() => api.call("POST", `/api/issues/${id}/upvote`, { token: "user:u9" })));
  const c = (await api.call("GET", `/api/issues/${id}`)).body.upvoteCount;
  assert.ok(c === 5 || c === 6);
  const doc = await h.Issue.findById(id).lean();
  assert.equal(doc.upvoteCount, doc.upvotes.length);
});

test("sort=top orders by upvotes", async () => {
  const r = await api.call("GET", "/api/issues?sort=top");
  assert.equal(r.body.items[0].title, "Water pipe leaking");
});

test("admin endpoints need admin", async () => {
  assert.equal((await api.call("GET", "/api/admin/me")).status, 401);
  const r = await api.call("GET", "/api/admin/me", { token: "user:alice" });
  assert.equal(r.status, 403);
  assert.equal(r.body.uid, "alice");
  assert.equal((await api.call("GET", "/api/admin/me", { token: "admin" })).status, 200);
});

test("admin status changes, history and resolvedAt", async () => {
  const id = (await api.call("GET", "/api/issues?q=lane")).body.items[0].id;
  let r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "in_progress", note: "Crew assigned" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "in_progress");
  assert.equal(r.body.statusHistory.length, 2);
  assert.equal(r.body.resolvedAt, null);
  r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "resolved" } });
  assert.ok(r.body.resolvedAt);
  r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "reported" } });
  assert.equal(r.body.resolvedAt, null); // reopened
  r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "bogus" } });
  assert.equal(r.status, 400);
  r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "user:alice", body: { status: "resolved" } });
  assert.equal(r.status, 403);
});

test("rejecting needs a note and hides the issue publicly", async () => {
  const id = (await api.call("GET", "/api/issues?q=Streetlight")).body.items[0].id;
  let r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "rejected" } });
  assert.equal(r.status, 400);
  r = await api.call("PATCH", `/api/admin/issues/${id}/status`, { token: "admin", body: { status: "rejected", note: "Duplicate report" } });
  assert.equal(r.status, 200);
  assert.equal((await api.call("GET", "/api/issues?q=Streetlight")).body.total, 0);
  assert.equal((await api.call("GET", `/api/issues/${id}`)).status, 404);
  assert.equal((await api.call("GET", `/api/issues/${id}`, { token: "user:bob" })).status, 200); // owner still sees it
  assert.equal((await api.call("POST", `/api/issues/${id}/upvote`, { token: "user:zed" })).status, 404);
  const a = await api.call("GET", "/api/admin/issues?status=rejected", { token: "admin" });
  assert.equal(a.body.total, 1);
});

test("admin after-photo upload", async () => {
  const id = (await api.call("GET", "/api/issues?q=lane")).body.items[0].id;
  const f = new FormData();
  f.append("photo", new Blob([h.PNG]), "after.png");
  let r = await api.call("POST", `/api/admin/issues/${id}/after-photo`, { form: f, token: "admin" });
  assert.equal(r.status, 200);
  assert.match(r.body.afterPhoto, /^\/uploads\//);
  const f2 = new FormData();
  f2.append("photo", new Blob([h.FAKE]), "after.png");
  r = await api.call("POST", `/api/admin/issues/${id}/after-photo`, { form: f2, token: "admin" });
  assert.equal(r.status, 400);
  r = await api.call("POST", `/api/admin/issues/${id}/after-photo`, { form: new FormData(), token: "admin" });
  assert.equal(r.status, 400);
});

test("stats: public hides rejected, admin includes", async () => {
  const pub = await api.call("GET", "/api/issues/stats");
  assert.equal(pub.body.total, 2);
  assert.equal(pub.body.byStatus.rejected, undefined);
  const adm = await api.call("GET", "/api/admin/stats", { token: "admin" });
  assert.equal(adm.body.total, 3);
  assert.equal(adm.body.byStatus.rejected, 1);
  assert.ok(Array.isArray(pub.body.byMonth));
});

test("admin delete removes the issue", async () => {
  const id = (await api.call("GET", "/api/issues?q=leaking")).body.items[0].id;
  assert.equal((await api.call("DELETE", `/api/admin/issues/${id}`, { token: "admin" })).status, 200);
  assert.equal((await api.call("GET", `/api/issues/${id}`)).status, 404);
  assert.equal((await api.call("DELETE", `/api/admin/issues/${id}`, { token: "admin" })).status, 404);
});

test("/api/me reports the role of the logged-in account", async () => {
  assert.equal((await api.call("GET", "/api/me")).status, 401);
  assert.deepEqual((await api.call("GET", "/api/me", { token: "user:zoe" })).body, { uid: "zoe", admin: false, official: false });
  assert.deepEqual((await api.call("GET", "/api/me", { token: "admin" })).body, { uid: "admin-uid", admin: true, official: false });
  assert.deepEqual((await api.call("GET", "/api/me", { token: "official" })).body, { uid: "official-uid", admin: false, official: true });
});

test("admin-only (official) accounts can use admin tools but cannot report or upvote", async () => {
  assert.equal((await api.call("GET", "/api/admin/me", { token: "official" })).status, 200);
  assert.equal((await api.call("GET", "/api/admin/stats", { token: "official" })).status, 200);
  const r = await create({ title: "Official trying to report" }, "official");
  assert.equal(r.status, 403);
  const id = (await api.call("GET", "/api/issues?limit=1")).body.items[0].id;
  assert.equal((await api.call("POST", `/api/issues/${id}/upvote`, { token: "official" })).status, 403);
  // a full admin can still act as a citizen
  assert.equal((await create({ title: "Admin reporting as citizen" }, "admin")).status, 201);
});
