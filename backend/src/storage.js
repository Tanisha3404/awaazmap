const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

// detect real image type
function detectExt(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

// Cloudinary 
function cloudinary() {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(config.cloudinaryUrl.trim());
  return m ? { key: m[1], secret: m[2], cloud: m[3] } : null;
}
const FOLDER = "awaazmap";
const sign = (params, secret) =>
  crypto.createHash("sha1").update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret).digest("hex");

async function uploadToCloudinary(c, file, ext) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = { folder: FOLDER, timestamp };
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: "image/" + (ext === "jpg" ? "jpeg" : ext) }), "photo." + ext);
  form.append("api_key", c.key);
  form.append("timestamp", timestamp);
  form.append("folder", FOLDER);
  form.append("signature", sign(signed, c.secret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) throw new Error("Photo upload failed: " + ((json.error && json.error.message) || res.status));
  return json.secure_url;
}

async function removeFromCloudinary(c, url) {
  const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
  if (!m || !url.includes("/" + c.cloud + "/")) return;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { public_id: m[1], timestamp };
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.append(k, v));
  form.append("api_key", c.key);
  form.append("signature", sign(params, c.secret));
  await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/destroy`, { method: "POST", body: form }).catch(() => {});
}

// Saves an uploaded image buffer
async function saveImage(file) {
  const ext = detectExt(file.buffer);
  if (!ext) return null;
  const c = cloudinary();
  if (c) return uploadToCloudinary(c, file, ext);
  await fs.mkdir(config.uploadDir, { recursive: true });
  const name = crypto.randomBytes(16).toString("hex") + "." + ext;
  await fs.writeFile(path.join(config.uploadDir, name), file.buffer);
  return "/uploads/" + name;
}

// Removes an image from storage (Cloudinary or local disk)
async function removeImage(url) {
  if (typeof url !== "string") return;
  const c = cloudinary();
  if (/^https:\/\/res\.cloudinary\.com\//.test(url)) return c ? removeFromCloudinary(c, url) : undefined;
  if (!url.startsWith("/uploads/")) return;
  await fs.unlink(path.join(config.uploadDir, path.basename(url))).catch(() => {});
}

module.exports = { saveImage, removeImage, detectExt };
