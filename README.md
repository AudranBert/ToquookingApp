# Toquooking

Toquooking is a local-first digital recipe book for importing, personalizing, searching, saving, and sharing recipes.

## Overview

Main capabilities:
- Import recipes from supported websites and free text.
- Edit imported content (title, ingredients, steps, images, tags, notes).
- Search by name, ingredient, tags, origin, and seasonal hints.
- Export/share recipes as PDF, PNG, text, and JSON.
- Build shopping lists from selected recipes.

Supported import sources (expected good or near-good extraction):
- `marmiton.org`
- `cuisineaz.com`
- `cuisine-libre.org`
- `papillesetpupilles.fr`
- `cuisineactuelle.fr`

YouTube imports are supported in partial mode.

## Local Development

```powershell
npm install
npm run dev
```

## Production Build

```powershell
npm run build
```

## Preview Like GitHub Pages (without pushing)

Use static preview from the production bundle:

```powershell
npm run build
npm run preview
```

Open the preview URL (usually `http://localhost:4173/ToquookingApp/`).

This matches GitHub Pages behavior:
- Static files served from `dist/`.
- No runtime dependency on serverless `api/` handlers.
- Frontend importer path from `src/importer.ts`.

Note for local development:
- `npm run dev` exposes `/api/import` and `/api/image` via Vite middleware.
- Those routes are backed by `src/dev/recipeImportCore.ts` and `src/dev/imageProxyCore.ts`.

## Offline Test Flow

To validate offline-like behavior:
1. Run `npm run build` then `npm run preview`.
2. Open browser DevTools Network tab.
3. Switch network to `Offline`.
4. Reload and verify fallback UX/messages.

Expected behavior:
- App shell should still load if already cached by browser/service worker policy.
- External URL imports fail gracefully offline and keep manual-entry workflow usable.

## Deployment

Automatic deploy:
- On every push/merge to `main`, `.github/workflows/deploy-pages.yml` builds and deploys to `gh-pages`.

Manual deploy from GitHub Actions:
- Run the `Deploy GitHub Pages` workflow.
- Optional input `ref` lets you deploy a specific branch, tag, or commit SHA.

Manual local deploy (including local uncommitted changes):

```powershell
npm run build
npm run deploy
```

Manual local deploy from a specific commit:

```powershell
git checkout <commit-sha>
npm ci
npm run build
npm run deploy
git checkout -
```

## Useful Commands

```powershell
npm run build
npm run preview
npm run check:importers
npm run check:importers -- --json
npm run check:importers -- --url "https://www.cuisineaz.com/recettes/poulet-teriyaki-79496.aspx"
```

## What is next

TO DO:
- ✔️ HTTPS/Phone App
- ✔️ Change page remove Message headband
- ✔️ Better shopping list recipe selection
- ✔️ In save menu: can download an example json. So people can generate recipe json with IA. For example they scan a recipe book -> ia formatting (json ) -> import in app.
- ✔️ Tooltip for showing which website are supported when importing
- ✔️ Can have multiples images
- ✔️ Saves: handle images (saving and reloading, use zip maybe)
- Can personnalize app as it was our cooking book.
- ✔️ English UI
- In recipes needed tools : like oven, fryer, toaster... So we can filter on fryer for example
- Maybe some AI tools: better autofilling of the import form, scan book ans import recipe directly, translate recipes
