// This file contains functions for querying the issues collection in MongoDB. It is used by the API routes and the admin page.
const mongoose = require("mongoose");
const Issue = require("./models/Issue");
const { HttpError } = require("./middleware/errors");

const DAY = 24 * 60 * 60 * 1000;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function objectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Issue not found");
  return id;
}

// build a MongoDB filter object from the query parameters; used by list() and stats().
function buildFilter(q, { includeRejected = false } = {}) {
  const f = {};
  if (q.category) f.category = q.category;
  if (q.status) f.status = q.status;
  else if (!includeRejected) f.status = { $ne: "rejected" };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    f.$or = [{ title: rx }, { description: rx }, { address: rx }];
  }
  if (q.bbox) {
    const [minLng, minLat, maxLng, maxLat] = q.bbox.split(",").map(Number);
    if (minLng >= maxLng || minLat >= maxLat) throw new HttpError(400, "bbox: minimums must be smaller than maximums");
    f.location = {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
        },
      },
    };
  }
  return f;
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  top: { upvoteCount: -1, createdAt: -1 },
};

// present an issue document in the format expected by the API clients. The `upvoted` and `uid` parameters are used to indicate whether the current user has upvoted this issue and whether it was reported by them
function present(o, { upvoted = false, uid = null } = {}) {
  const end = o.resolvedAt ? new Date(o.resolvedAt).getTime() : Date.now();
  return {
    id: String(o._id),
    title: o.title,
    description: o.description,
    category: o.category,
    status: o.status,
    location: { lat: o.location.coordinates[1], lng: o.location.coordinates[0] },
    address: o.address,
    photos: o.photos,
    afterPhoto: o.afterPhoto || "",
    reporterName: o.reporter ? o.reporter.name : "Citizen",
    upvoteCount: o.upvoteCount,
    hasUpvoted: upvoted,
    isMine: !!uid && !!o.reporter && o.reporter.uid === uid,
    statusHistory: (o.statusHistory || []).map((h) => ({ status: h.status, note: h.note, at: h.at })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    resolvedAt: o.resolvedAt || null,
    daysOpen: Math.max(0, Math.floor((end - new Date(o.createdAt).getTime()) / DAY)),
    demo: !!o.demo,
  };
}

// Which of these issues has this user upvoted? One query for the whole page
async function upvotedSet(docs, uid) {
  if (!uid || !docs.length) return new Set();
  const rows = await Issue.find({ _id: { $in: docs.map((d) => d._id) }, upvotes: uid }).select("_id").lean();
  return new Set(rows.map((r) => String(r._id)));
}

async function presentMany(docs, uid) {
  const set = await upvotedSet(docs, uid);
  return docs.map((d) => present(d, { upvoted: set.has(String(d._id)), uid }));
}

async function list(q, { includeRejected = false, uid = null } = {}) {
  const filter = buildFilter(q, { includeRejected });
  const [total, docs] = await Promise.all([
    Issue.countDocuments(filter),
    Issue.find(filter).select("-upvotes").sort(SORTS[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
  ]);
  return { items: await presentMany(docs, uid), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

// Return statistics about the issues in the database. If `includeRejected` is true, rejected issues are included in the counts
async function stats({ includeRejected = false } = {}) {
  const match = includeRejected ? {} : { status: { $ne: "rejected" } };
  const [byStatus, byCategory, resolved, byMonth] = await Promise.all([
    Issue.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Issue.aggregate([{ $match: match }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
    Issue.aggregate([
      { $match: { status: "resolved", resolvedAt: { $ne: null } } },
      { $group: { _id: "$category", avgMs: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } }, n: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const totalResolved = resolved.reduce((s, r) => s + r.n, 0);
  const avgMs = totalResolved ? resolved.reduce((s, r) => s + r.avgMs * r.n, 0) / totalResolved : null;
  return {
    total: byStatus.reduce((s, r) => s + r.n, 0),
    byStatus: toMap(byStatus),
    byCategory: toMap(byCategory),
    resolved: totalResolved,
    avgDaysToResolve: avgMs === null ? null : Math.round((avgMs / DAY) * 10) / 10,
    avgDaysToResolveByCategory: Object.fromEntries(resolved.map((r) => [r._id, Math.round((r.avgMs / DAY) * 10) / 10])),
    byMonth: byMonth.map((r) => ({ month: r._id, count: r.n })),
  };
}

module.exports = { objectId, buildFilter, present, presentMany, list, stats };
