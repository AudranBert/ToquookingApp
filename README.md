# Toquooking

Toquooking is a local-first digital recipe book for importing, personalizing, searching, saving, and sharing recipes.

## Overview

Main capabilities:

- Import recipes from websites through the Toquooking server, and from free text locally.
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
- URL imports sent to the server configured in `public/online-config.json`.
- A small frontend client in `src/importer.ts`; website fetching and parsing run in `backend/recipe-importer.mjs`.

Note for local development:

- Start the backend with `npm run start:cloud` to test URL imports.
- `npm run dev` exposes `/api/image` via Vite middleware for local image loading.

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

- On every push/merge to `main`, `.github/workflows/ci.yml` verifies lint, formatting, offline tests and bundle budgets before deploying the checked build directly to GitHub Pages with `actions/deploy-pages`.
- Deployment status and the site URL are available in the `github-pages` environment.

Repository setup (once):

1. In **Settings > Pages > Build and deployment**, set **Source** to **GitHub Actions**.
2. In **Settings > Environments > github-pages**, ensure deployment branch rules allow `main`. If rules currently allow only `gh-pages`, replace that rule with `main`.
3. Merge the workflow changes into `main`, or run the `CI` workflow manually after the changes are on GitHub.

The old `gh-pages` branch is no longer used and can be kept or deleted after the first successful deployment. No additional secret is required.

Manual deploy from GitHub Actions:

- Run the `CI` workflow.
- Optional input `ref` lets you deploy a specific branch, tag, or commit SHA.
- Environment deployment rules apply to the branch selected for the workflow run. With a `main`-only rule, select `main` and use `ref` to choose the revision to build.
- Local changes must be committed and pushed before they can be deployed through GitHub Actions.

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

Plain text section boundaries, error pages and structured-data priority are covered by `npm run test:features`. Network results can still vary with source/proxy availability; partial warnings remain visible even when several fields were extracted.

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

## Quality checks

Run `npm run lint`, `npm run format:check`, `npm test`, and `npm run build:budget`.
`npm run check:importers` additionally checks the live source sites through the frontend client and server parser. Live checks depend on network access and source anti-bot protection; they remain separate from deterministic offline regression tests.
Backup imports preserve local recipes when IDs collide and create an imported copy.
