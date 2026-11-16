const { Schema, model } = require("mongoose");
const { CATEGORIES, STATUSES } = require("../constants");

const historySchema = new Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, default: "", maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const issueSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    category: { type: String, required: true, enum: CATEGORIES, index: true },
    status: { type: String, enum: STATUSES, default: "reported", index: true },
    // GeoJSON point: coordinates are [longitude, latitude]. The 2dsphere index powers map-area queries
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    address: { type: String, default: "", maxlength: 200 },
    photos: { type: [String], default: [] },
    afterPhoto: { type: String, default: "" }, // shown next to the first photo as the before/after slider
    reporter: {
      uid: { type: String, required: true, index: true },
      name: { type: String, default: "Citizen", maxlength: 60 },
    },
    upvotes: { type: [String], default: [] }, // Firebase UIDs
    upvoteCount: { type: Number, default: 0, min: 0, index: true },
    statusHistory: { type: [historySchema], default: [] },
    resolvedAt: { type: Date, default: null },
    demo: { type: Boolean, default: false }, // sample data created by the seed script
  },
  { timestamps: true }
);

issueSchema.index({ location: "2dsphere" });
issueSchema.index({ createdAt: -1 });

module.exports = model("Issue", issueSchema);
