# Toquooking

Your own digital recipe book! An all in one app for importing, personalizing, searching, saving, sharing recipes. Everything is done locally.

Main features: 
- Recipes can be imported from various sources automatically. You can add tags, note, change the image, adjuste the instructions...
- You can search recipes using filters on country of origin, tags, name, ingredients. You can search for seasonal dishes.
- They can be shared through PDF, PNG, text or JSON. On phone you can share through messages!
- You can export or import all (or one) recipes with JSON.
- You can generate a shopping list by selecting recipes (PDF, PNG or Text).

### TO DO
- HTTPS/Phone App
- Change page remove Message headband
- Better shopping list recipe selection
- In save menu: can download an example json. So people can generate recipe json with IA. For example they scan a recipe book -> ia formatting (json ) -> import in app.
- Tooltip for showing which website are supported when importing
- Can have multiples images
- Saves: handle images (saving and reloading, use zip maybe)
- Default App icon. Can personnalize app as it was our cooking book.
- English UI
- In recipes needed tools : like oven, fryer, toaster... So we can filter on fryer for example 
- Maybe some AI tools: better autofilling of the import form, scan book ans import recipe directly, translate recipes

## NAS deployment (Web Station + API)

This app is split in 2 parts:
- Static frontend (PWA) served by Synology Web Station.
- Node API backend for online-only features (`/api/import`, `/api/image`).

### 1) Frontend build

1. Keep `base` in `vite.config.ts` aligned with your URL:
- If URL is `https://.../ToquookingApp/` => `base: "/ToquookingApp/"`.
- If URL is `https://.../` => `base: "/"`.
2. Build:
```bash
npm install
npm run build
```
3. Copy `dist` contents to NAS web folder:
- subpath mode: `web/ToquookingApp/`
- root mode: `web/`

### 2) API backend on NAS

1. Install Node.js package from Synology Package Center (or Node via container).
2. Copy this repository to NAS (for example in `homes/<user>/toquooking-api`).
3. Install backend deps and run:
```bash
npm install
npm run api
```
This starts API on `http://0.0.0.0:8787` by default.

Optional environment vars:
- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)

Health check:
```bash
http://<NAS_LAN_IP>:8787/health
```

### 3) Reverse proxy in DSM

In DSM `Control Panel > Login Portal > Advanced > Reverse Proxy`, add rules:

1. API rule:
- Source: `https://<your-domain>/api`
- Destination: `http://127.0.0.1:8787/api`

2. Optional health rule:
- Source: `https://<your-domain>/health`
- Destination: `http://127.0.0.1:8787/health`

Keep frontend served by Web Station at the same domain.

### 4) HTTPS + PWA

1. Configure a certificate in DSM and bind it to your domain.
2. Force HTTPS.
3. Open the final URL on phone and install the PWA.

### 5) Verify end-to-end

1. Frontend loads at:
- `https://<domain>/ToquookingApp/` (subpath) or `https://<domain>/` (root).
2. API responds:
- `https://<domain>/health` returns `{ "ok": true }`
- `https://<domain>/api/import?url=https://example.com` returns JSON.
3. In app, URL import no longer shows backend-offline fallback when backend is reachable.
