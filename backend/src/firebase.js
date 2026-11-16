// This file loads environment variables from a .env file and exports them as a config object
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const config = require("./config");

function auth() {
  const app = getApps()[0] || initializeApp({ projectId: config.firebaseProjectId });
  return getAuth(app);
}

// verifies a Firebase ID token and returns the decoded token (or throws an error if invalid)
async function verifyIdToken(token) {
  return auth().verifyIdToken(token);
}

module.exports = { verifyIdToken };
