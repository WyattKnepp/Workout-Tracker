# Lifts — workout tracker

React (Vite) front end + a tiny Node server that stores everything as JSON files in `data/`.

## Run
    npm install
    npm run build
    PORT=3000 VAPID_SUBJECT=mailto:you@yourdomain.com npm start

Binds to 127.0.0.1 by default (set `HOST=0.0.0.0` to change); put your authenticated reverse proxy in front.
Back up the `data/` folder (or use Settings → Download backup).

Env: `PORT`, `HOST`, `DATA_DIR`, `VAPID_SUBJECT` (contact for push; needed by some push services).

Dev: `npm run dev:server` and `npm run dev` (Vite proxies /api).

## Phone
Open the site, then Share → Add to Home Screen (needed for lock-screen rest alerts on iPhone).
Settings → "Alert when phone is locked" turns on a push notification that your server sends when rest ends.
