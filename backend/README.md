# Awaaz Map – backend

Node.js + Express + MongoDB API for the civic issue reporter.

## Run locally
1. Install MongoDB (or use a free Atlas cluster) and Node 18+.
2. `cp .env.example .env` and fill it in (`FIREBASE_PROJECT_ID`, `ADMIN_UIDS`).
3. `npm install`
4. `npm run seed` (optional sample issues, `npm run seed -- --reset` to refresh them)
5. `npm start` → http://localhost:5000

## Tests
`npm test` (uses a throwaway database; set `TEST_MONGODB_URI` if MongoDB is not on the default port).

## API
| Method | Path | Who | What |
|---|---|---|---|
| GET | /api/issues | anyone | list; filters `category,status,q,bbox,sort,page,limit` |
| GET | /api/issues/stats | anyone | totals, by status/category, average days to resolve |
| GET | /api/issues/mine | login | my reports |
| GET | /api/issues/:id | anyone | one issue |
| POST | /api/issues | login | report (multipart, up to 3 photos) |
| POST | /api/issues/:id/upvote | login | toggle "me too" |
| GET | /api/admin/me, /stats, /issues | admin | admin views (include rejected) |
| PATCH | /api/admin/issues/:id/status | admin | change status (+note) |
| POST | /api/admin/issues/:id/after-photo | admin | upload "after" photo |
| DELETE | /api/admin/issues/:id | admin | delete |

Photos are stored in `uploads/` locally. Render's free disk is wiped on redeploy, so before deploying we will switch `src/storage.js` to Cloudinary.
