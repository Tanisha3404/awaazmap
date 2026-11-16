const config = require("../config");
const firebase = require("../firebase");

function bearer(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function load(req, res, token, soft) {
  try {
    req.user = await firebase.verifyIdToken(token);
    return true;
  } catch (e) {
    if (soft) return true; // browsing stays open to guests 
    res.status(401).json({ error: "Your login has expired. Please log in again." });
    return false;
  }
}

// allows guests to browse, but loads user info if a valid token is present
async function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return next();
  if (await load(req, res, token, true)) next();
}

// requires a valid token, otherwise returns 401
async function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  if (await load(req, res, token)) next();
}

const isAdmin = (uid) => config.adminUids.includes(uid);
// An official account is admin-only
const isOfficial = (uid) => config.officialUids.includes(uid) && !isAdmin(uid);
const roleOf = (uid) => ({ admin: isAdmin(uid), official: isOfficial(uid) });

// requires a valid token and an admin account, otherwise returns 403
function requireAdmin(req, res, next) {
  if (!isAdmin(req.user.uid) && !isOfficial(req.user.uid)) {
    return res.status(403).json({ error: "This account is not an admin.", uid: req.user.uid });
  }
  next();
}

// requires a valid token and a citizen account, otherwise returns 403
function requireCitizen(req, res, next) {
  if (isOfficial(req.user.uid)) return res.status(403).json({ error: "This is an admin-only account. Use a citizen account to report or upvote." });
  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin, requireCitizen, roleOf };
