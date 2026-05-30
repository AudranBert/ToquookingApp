# AGENTS.md - ToquookingApp Working Notes

## Purpose
This file is the execution guide for future work in this repository.
Follow this first, then implement changes.

## Core Rule
- Production target is GitHub Pages (static frontend).
- Do not rely on `api/` behavior for import validation.
- Import tests must validate the frontend importer path from `src/importer.ts`.

## Project Structure
- `src/`: React frontend app.
- `src/importer.ts`: Main URL/text recipe import pipeline.
- `src/hooks/useRecipeDraft.ts`: Import UX status/loading text.
- `src/utils/ingredients.ts` + `src/utils/ingredientParser.ts`: Ingredient parsing.
- `src/origins.ts`: Origin mapping.
- `api/`: Local/serverless endpoints (not used on GitHub Pages runtime).
- `scripts/check-importers.mjs`: Reusable importer verification script.

## File Endings
- Repository text files are stored with LF line endings.
- On Windows, Git may warn that LF will be replaced by CRLF in the working tree; this is expected when `autocrlf` is enabled.
- Before finishing a change, run `git diff --check` and fix whitespace/end-of-file issues (for example trailing spaces or extra blank lines at EOF).

## Importer Architecture (Frontend)
`importRecipeFromUrl(url)` in `src/importer.ts`:
1. Fetch source HTML via direct request + fallback proxies.
2. Apply domain-specific parser when domain is known.
3. Parse structured data (JSON-LD / microdata) when available.
4. Use text/markdown fallback only when needed.
5. Merge and sanitize result.

Known domain parsers currently registered in `DOMAIN_PARSERS`:
- `marmiton.org`
- `cuisine-libre.org`
- `cuisineaz.com`
- `papillesetpupilles.fr`
- `cuisineactuelle.fr`

YouTube has dedicated handling via `parseYouTubeImport`.

## Mandatory Testing Workflow
Always run these after importer changes.

### 1) Build check
```powershell
npm run build
```

### 2) Automated importer check (frontend path)
```powershell
npm run check:importers
```
Optional JSON output:
```powershell
npm run check:importers -- --json
```
Optional targeted URL:
```powershell
npm run check:importers -- --url "https://example.com/recipe"
```

What this script verifies per URL:
- Parsed recipe name
- Ingredients count
- Instructions count
- Image presence
- Warning presence (including partial import warnings)

### 3) Manual UI spot-check (when behavior changed)
- Run frontend locally (`npm run dev` or `npm run preview`).
- Import at least one representative URL per changed domain.
- Confirm imported fields are coherent in UI (name, ingredients, steps, image, timings).

## Baseline Validation URLs
These are canonical regression links and should be checked regularly.

Expected: should import correctly or almost.
- https://www.cuisine-libre.org/osso-bucco-lombard
- https://www.marmiton.org/recettes/recette_pot-au-feu-facile_44578.aspx
- https://www.cuisineaz.com/recettes/tzatziki-facile-17295.aspx
- https://www.papillesetpupilles.fr/2026/05/cotes-de-porc-au-citron-et-au-thym-cuisson-douce-au-four.html/
- https://www.cuisineactuelle.fr/recettes/pizza-facile-106483.aspx

Expected: partial is acceptable.
- https://www.youtube.com/shorts/eEB6pkC4X5o

## Known External Limitations
- `papillesetpupilles.fr` may return anti-bot/Cloudflare pages (`"Just a moment..."`) depending on fetch source and timing.
- Some sources may still return partial warnings even when usable data is extracted.
- Network/proxy variability can change extraction quality between runs.

## Quality Bar For Importer Changes
When editing importers:
- Prefer structured extraction (JSON-LD/microdata/explicit HTML blocks) over noisy generic text fallback.
- Avoid regressions on existing domains by rerunning full URL baseline list.
- Keep warning messages with proper French accents.
- Do not introduce dependency on `api/` path for production behavior.

## Quick Commands
```powershell
npm run build
npm run check:importers
npm run check:importers -- --json
npm run check:importers -- --url "https://www.cuisineaz.com/recettes/poulet-teriyaki-79496.aspx"
```

## Definition of Done (Importer Task)
A change is complete only if:
1. `npm run build` passes.
2. `npm run check:importers` runs successfully.
3. Results for modified domain(s) are improved or at least not regressed.
4. Any remaining limitation is documented in PR/task summary.
