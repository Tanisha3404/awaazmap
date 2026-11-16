const multer = require("multer");
const { MAX_PHOTOS, MAX_PHOTO_BYTES } = require("./constants");

// Photos are held in memory, checked, then saved by src/storage.js.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
});

module.exports = upload;
