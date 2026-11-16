// Test setup: real MongoDB (a throwaway database), fake Firebase tokens
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");

process.env.ADMIN_UIDS = "admin-uid";
process.env.OFFICIAL_UIDS = "official-uid";
process.env.SERVE_FRONTEND = "false";
process.env.DISABLE_RATE_LIMIT = "true";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "awaaz-uploads-"));

// Fake Firebase: tokens are "admin" or "user:<uid>". Anything else is rejected.
require.cache[require.resolve("../src/firebase")] = {
  id: "firebase-stub", filename: "firebase-stub", loaded: true,
  exports: {
    async verifyIdToken(t) {
      if (t === "admin") return { uid: "admin-uid", name: "Admin" };
      if (t === "official") return { uid: "official-uid", name: "Ward Office" };
      if (t.startsWith("user:")) return { uid: t.slice(5), name: "User " + t.slice(5) };
      throw new Error("bad token");
    },
  },
};

const { createApp } = require("../src/app");
const Issue = require("../src/models/Issue");

const baseUri = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = "awaaz_test_" + crypto.randomBytes(4).toString("hex");

// Smallest valid-looking files, detected by their first bytes.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const FAKE = Buffer.from("this is not an image at all, just text pretending");

async function start() {
  await mongoose.connect(`${baseUri.replace(/\/$/, "")}/${dbName}`, { serverSelectionTimeoutMS: 5000 });
  await Issue.init();
  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // body = JSON, form = FormData (for photo uploads)
  async function call(method, url, { body, form, token } = {}) {
    const headers = token ? { Authorization: "Bearer " + token } : {};
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    let json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }
    return { status: res.status, body: json };
  }
  async function stop() {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  }
  return { call, stop };
}

function issueForm(fields = {}, photos = []) {
  const f = new FormData();
  const v = { title: "Big pothole near school", description: "A deep pothole that damages vehicles.", category: "road", lat: "18.52", lng: "73.85", address: "FC Road", ...fields };
  for (const [k, val] of Object.entries(v)) if (val !== null) f.append(k, val);
  for (const p of photos) f.append("photos", new Blob([p.buf]), p.name || "a.png");
  return f;
}

module.exports = { start, issueForm, PNG, FAKE, Issue };
