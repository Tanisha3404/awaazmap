const express = require("express");
const rateLimit = require("express-rate-limit");
const Issue = require("../models/Issue");
const { optionalAuth, requireAuth, requireCitizen } = require("../middleware/auth");
const { HttpError, parse } = require("../middleware/errors");
const { createIssue, listQuery } = require("../validation");
const q = require("../issueQueries");
const upload = require("../upload");
const { saveImage, removeImage } = require("../storage");

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
  keyGenerator: (req) => req.user.uid,
  message: { error: "You are reporting too quickly. Please try again later." },
});

router.get("/stats", async (_req, res) => res.json(await q.stats()));

router.get("/", optionalAuth, async (req, res) => {
  const query = parse(listQuery, req.query);
  res.json(await q.list(query, { uid: req.user && req.user.uid }));
});

// returns all issues reported by the logged-in user, sorted by newest first
router.get("/mine", requireAuth, async (req, res) => {
  const docs = await Issue.find({ "reporter.uid": req.user.uid }).select("-upvotes").sort({ createdAt: -1 }).lean();
  res.json({ items: await q.presentMany(docs, req.user.uid) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const doc = await Issue.findById(q.objectId(req.params.id)).select("-upvotes").lean();
  if (!doc) throw new HttpError(404, "Issue not found");
  const uid = req.user && req.user.uid;
  const isMine = uid && doc.reporter.uid === uid;
  if (doc.status === "rejected" && !isMine) throw new HttpError(404, "Issue not found");
  const [item] = await q.presentMany([doc], uid);
  res.json(item);
});

router.post("/", requireAuth, requireCitizen, createLimiter, upload.array("photos", 3), async (req, res) => {
  const data = parse(createIssue, req.body || {});
  const saved = [];
  for (const f of req.files || []) {
    const url = await saveImage(f);
    if (!url) {
      await Promise.all(saved.map(removeImage));
      throw new HttpError(400, "Only JPG, PNG or WebP photos are allowed.");
    }
    saved.push(url);
  }
  const doc = await Issue.create({
    title: data.title,
    description: data.description,
    category: data.category,
    address: data.address,
    location: { type: "Point", coordinates: [data.lng, data.lat] },
    photos: saved,
    reporter: { uid: req.user.uid, name: (req.user.name || "Citizen").slice(0, 60) },
    statusHistory: [{ status: "reported", note: "Issue reported" }],
  });
  res.status(201).json(q.present(doc.toObject(), { uid: req.user.uid }));
});

// upvote an issue. If the user has already upvoted, this removes their upvote.
router.post("/:id/upvote", requireAuth, requireCitizen, async (req, res) => {
  const id = q.objectId(req.params.id);
  const uid = req.user.uid;
  const doc = await Issue.findById(id).select("reporter status").lean();
  if (!doc || doc.status === "rejected") throw new HttpError(404, "Issue not found");
  if (doc.reporter.uid === uid) throw new HttpError(400, "You cannot upvote your own report.");
  const added = await Issue.updateOne({ _id: id, upvotes: { $ne: uid } }, { $addToSet: { upvotes: uid }, $inc: { upvoteCount: 1 } });
  let upvoted = true;
  if (!added.modifiedCount) {
    await Issue.updateOne({ _id: id, upvotes: uid }, { $pull: { upvotes: uid }, $inc: { upvoteCount: -1 } });
    upvoted = false;
  }
  const fresh = await Issue.findById(id).select("upvoteCount").lean();
  res.json({ upvoted, upvoteCount: fresh.upvoteCount });
});

module.exports = router;
