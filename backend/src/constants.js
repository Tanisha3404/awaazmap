// This file contains constants used throughout the backend
module.exports = {
  CATEGORIES: ["road", "garbage", "streetlight", "water", "public_space", "other"],
  CATEGORY_LABELS: {
    road: "Roads & potholes",
    garbage: "Garbage & sanitation",
    streetlight: "Streetlights",
    water: "Water & drainage",
    public_space: "Public spaces",
    other: "Other",
  },
  // reported -> acknowledged -> in_progress -> resolved   (or rejected for spam/duplicates)
  STATUSES: ["reported", "acknowledged", "in_progress", "resolved", "rejected"],
  MAX_PHOTOS: 3,
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
};
