const express = require("express");
const Issue = require("../models/Issue");
const { requireAuth, requireAdmin, roleOf } = require("../middleware/auth");
const { HttpError, parse } = require("../middleware/errors");
const { listQuery, statusChange } = require("../validation");
const q = require("../issueQueries");
const upload = require("../upload");
const { saveImage, removeImage } = require("../storage");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/me", (req, res) => res.json({ uid: req.user.uid, ...roleOf(req.user.uid) }));

router.get("/stats", async (_req, res) => res.json(await q.stats({ includeRejected: true })));

router.get("/issues", async (req, res) => {
  res.json(await q.list(parse(listQuery, req.query), { includeRejected: true, uid: req.user.uid }));
});

router.patch("/issues/:id/status", async (req, res) => {
  const { status, note } = parse(statusChange, req.body || {});
  if (status === "rejected" && !note) throw new HttpError(400, "Please add a note explaining why this report is rejected.");
  const doc = await Issue.findById(q.objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Issue not found");
  doc.status = status;
  doc.resolvedAt = status === "resolved" ? new Date() : null;
  doc.statusHistory.push({ status, note, at: new Date() });
  await doc.save();
  res.json(q.present(doc.toObject(), { uid: req.user.uid }));
});

router.post("/issues/:id/after-photo", upload.single("photo"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Please choose a photo.");
  const doc = await Issue.findById(q.objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Issue not found");
  const url = await saveImage(req.file);
  if (!url) throw new HttpError(400, "Only JPG, PNG or WebP photos are allowed.");
  const old = doc.afterPhoto;
  doc.afterPhoto = url;
  await doc.save();
  if (old) await removeImage(old);
  res.json(q.present(doc.toObject(), { uid: req.user.uid }));
});

router.delete("/issues/:id", async (req, res) => {
  const doc = await Issue.findByIdAndDelete(q.objectId(req.params.id));
  if (!doc) throw new HttpError(404, "Issue not found");
  await Promise.all([...doc.photos, doc.afterPhoto].filter(Boolean).map(removeImage));
  res.json({ ok: true });
});

module.exports = router;
