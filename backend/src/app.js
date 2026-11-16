const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const config = require("./config");
const { notFound, errorHandler } = require("./middleware/errors");
const { requireAuth, roleOf } = require("./middleware/auth");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.isProd) app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" }, referrerPolicy: { policy: "strict-origin-when-cross-origin" } }));

  const localDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(
    "/api",
    cors({
      origin(origin, cb) {
        if (!origin || config.clientOrigins.includes(origin) || (!config.isProd && localDev.test(origin))) return cb(null, true);
        cb(null, false);
      },
    })
  );
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/me", requireAuth, (req, res) => res.json({ uid: req.user.uid, ...roleOf(req.user.uid) }));
  app.use("/api/issues", require("./routes/issues"));
  app.use("/api/admin", require("./routes/admin"));
  app.use("/api", notFound);

  // serve uploaded files and frontend (if present)
  app.use("/uploads", express.static(config.uploadDir, { dotfiles: "deny", maxAge: "7d" }));

  const frontend = path.resolve(__dirname, "../../frontend");
  if (config.serveFrontend && fs.existsSync(frontend)) {
    app.use(express.static(frontend));
    const nf = path.join(frontend, "404.html");
    app.use((_req, res) => (fs.existsSync(nf) ? res.status(404).sendFile(nf) : res.status(404).send("Not found")));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
