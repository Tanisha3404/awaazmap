const { z } = require("zod");
const { CATEGORIES, STATUSES } = require("./constants");

// validation schemas for API requests
const num = (label, min, max) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .transform(Number)
    .pipe(z.number({ error: `${label} must be a number` }).min(min, `${label} is out of range`).max(max, `${label} is out of range`));

const createIssue = z.object({
  title: z.string({ error: "Title is required" }).trim().min(5, "Title must be at least 5 characters").max(120, "Title is too long"),
  description: z.string({ error: "Description is required" }).trim().min(10, "Please describe the problem in at least 10 characters").max(1500, "Description is too long"),
  category: z.enum(CATEGORIES, { error: "Choose a valid category" }),
  lat: num("Latitude", -90, 90),
  lng: num("Longitude", -180, 180),
  address: z.string().trim().max(200, "Address is too long").optional().default(""),
});

const listQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, "bbox must be minLng,minLat,maxLng,maxLat")
    .optional(),
  sort: z.enum(["newest", "oldest", "top"]).optional().default("newest"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const statusChange = z.object({
  status: z.enum(STATUSES, { error: "Choose a valid status" }),
  note: z.string().trim().max(500, "Note is too long").optional().default(""),
});

module.exports = { createIssue, listQuery, statusChange };
