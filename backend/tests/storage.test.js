// Cloudinary storage
process.env.CLOUDINARY_URL = "cloudinary://123456:topsecret@democloud";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { saveImage, removeImage } = require("../src/storage");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

test("uploads signed to Cloudinary and returns the https URL", async () => {
  let seen;
  global.fetch = async (url, opts) => { seen = { url, form: opts.body }; return { ok: true, json: async () => ({ secure_url: "https://res.cloudinary.com/democloud/image/upload/v1/awaazmap/abc.png" }) }; };
  const url = await saveImage({ buffer: PNG });
  assert.equal(url, "https://res.cloudinary.com/democloud/image/upload/v1/awaazmap/abc.png");
  assert.equal(seen.url, "https://api.cloudinary.com/v1_1/democloud/image/upload");
  const ts = seen.form.get("timestamp");
  const expected = crypto.createHash("sha1").update(`folder=awaazmap&timestamp=${ts}topsecret`).digest("hex");
  assert.equal(seen.form.get("signature"), expected);
  assert.equal(seen.form.get("api_key"), "123456");
  assert.equal(seen.form.get("api_secret"), null);
});

test("a fake image is rejected before any upload", async () => {
  let called = false; global.fetch = async () => { called = true; };
  assert.equal(await saveImage({ buffer: Buffer.from("definitely not an image file") }), null);
  assert.equal(called, false);
});

test("upload errors surface as an error", async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid Signature" } }) });
  await assert.rejects(() => saveImage({ buffer: PNG }), /Invalid Signature/);
});

test("removing a Cloudinary photo sends a signed destroy for its public id", async () => {
  let seen;
  global.fetch = async (url, opts) => { seen = { url, form: opts.body }; return { ok: true, json: async () => ({}) }; };
  await removeImage("https://res.cloudinary.com/democloud/image/upload/v17/awaazmap/abc.png");
  assert.equal(seen.url, "https://api.cloudinary.com/v1_1/democloud/image/destroy");
  assert.equal(seen.form.get("public_id"), "awaazmap/abc");
  const ts = seen.form.get("timestamp");
  assert.equal(seen.form.get("signature"), crypto.createHash("sha1").update(`public_id=awaazmap/abc&timestamp=${ts}topsecret`).digest("hex"));
});
