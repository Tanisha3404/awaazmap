# Awaaz Map

A public map where citizens report civic problems (potholes, garbage, broken lights, water leaks) and track whether they get fixed.

- `backend/`  Node.js + Express + MongoDB API (see backend/README.md)
- `frontend/` plain HTML, CSS and JavaScript (Leaflet map, Chart.js, GSAP, Firebase login)

## Run it on your computer
1. `cd backend`
2. `npm install`
3. `copy .env.example .env` (Windows) and check `MONGODB_URI`; set `FIREBASE_PROJECT_ID=awaazmap`
4. `npm run seed` (optional sample reports)
5. `npm start`, then open http://localhost:5000

The backend also serves the `frontend` folder, so this one command runs the whole website.

## Becoming admin
Log in once, open http://localhost:5000/admin.html. It will show your Firebase user ID.
Put that ID in `ADMIN_UIDS` in `backend/.env`, restart the server, and reload the admin page.

## Firebase
`frontend/js/config.js` holds the public web config. In the Firebase console, enable Email/Password and Google
sign-in. When you deploy, add your live domain under Authentication, Settings, Authorized domains.
