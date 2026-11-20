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

Le cloud optionnel (Render + PostgreSQL), la sauvegarde automatique et le partage
par lien sont décrits dans [le guide de configuration cloud](docs/cloud.md).

```powershell
npm run build
npm run preview
npm run check:importers
npm run check:importers -- --json
npm run check:importers -- --url "https://www.cuisineaz.com/recettes/poulet-teriyaki-79496.aspx"
```

### Import validation notes

The historical Cuisine Libre osso-bucco and Cuisine Actuelle pizza URLs can return 404 pages. The frontend now rejects these pages and keeps the source link with a manual-entry warning. They remain in the regression list; `check:importers` reports their unavailability as a failure, including with `--json`.

A live Cuisine Actuelle check can also use:
```powershell
npm run check:importers -- --url "https://www.cuisineactuelle.fr/recettes/la-vraie-soupe-a-l-oignon-super-simple-106587"
```

Plain text section boundaries, proxy error pages and structured-data priority are covered by `npm run test:features`. Network results can still vary with source/proxy availability; partial warnings remain visible even when several fields were extracted.

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
- ✔️ In recipes needed tools : like oven, fryer, toaster... So we can filter on fryer for example
- Maybe some AI tools: better autofilling of the import form, scan book ans import recipe directly, translate recipes
- ✔️ Smart servings scaling + unit conversions (metric/imperial).
- Ingredient normalization (aliases/synonyms) to improve search and shopping-list merge.
- Recipe version history with restore points.
- Backup/sync UX improvements (integrity checks and optional cloud-folder sync workflow).

- Recipe tools/equipment support: add a tools field (oven, air fryer, blender, etc.) with filtering and batch tagging.
- Smart scaling + unit conversion: scale servings with better fractional display and metric/imperial conversion.

## Code Organization

- `src/screens/`: application screens.
- `src/components/`: UI components.
- `src/hooks/`: React state and interactions.
- `src/data/recipeRepository.ts`: local recipe writes and atomic cloud queue updates.
- `src/cloud/`: optional API access, upload queue, manual transfers, sharing and trash.
- `src/importer.ts`: public import entry point; helpers and site parsers live in `src/import/`.
- `src/utils/`: focused helpers, including shopping lists, image compression, backups and text sharing.
- `src/utils/legacyRecipeLink.ts`: compatibility reader for older embedded recipe links.
- `src/styles/`: base, responsive and backup styles, loaded in order by `src/styles.css`.
- `backend/`: optional Node server and PostgreSQL storage.

Cloud browser settings are in `src/cloud/config.ts`; server limits and maintenance settings are in `backend/config.mjs`. Image compression settings remain in `src/utils/imageCompression.ts`. Private keys and database identifiers retain their existing storage names for compatibility.

See [cloud documentation](docs/cloud.md) for configuration and deployment.
