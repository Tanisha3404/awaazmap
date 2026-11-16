// This file loads environment variables from a .env file and exports them as a config object
require("dotenv").config({ quiet: true });
const path = require("path");

const env = process.env;
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

module.exports = {
  isProd: env.NODE_ENV === "production",
  port: parseInt(env.PORT || "5000", 10),
  mongoUri: env.MONGODB_URI || "mongodb://127.0.0.1:27017/awaazmap",
  // used for firebase
  firebaseProjectId: env.FIREBASE_PROJECT_ID || "awaazmap",
  // Firebase UIDs allowed to use the admin page
  adminUids: list(env.ADMIN_UIDS),
  // Firebase UIDs of admin-only accounts: they can use the admin page but cannot post reports or upvote
  officialUids: list(env.OFFICIAL_UIDS),
  clientOrigins: list(env.CLIENT_ORIGINS),
  serveFrontend: env.SERVE_FRONTEND !== "false",
  // Cloudinary stores photos when deployed
  // Set CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  cloudinaryUrl: env.CLOUDINARY_URL || "",
  // to see uploaded files
  uploadDir: env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : path.resolve(__dirname, "../uploads"),
};
