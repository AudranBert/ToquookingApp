# Toquooking

Your own digital recipe book! An all in one app for importing, personalizing, searching, saving, sharing recipes. Everything is done locally.

## GitHub Pages

This app is configured to work on GitHub Pages (repo subpath hosting).

- Build locally: `npm run build`
- Deploy with the existing script: `npm run deploy`
- Optional explicit base path override:
  - PowerShell: `$env:BASE_PATH='/your-repo-name/'; npm run build`

Import behavior on static hosting:
- Local dev uses the local `/api/import` and `/api/image` proxy endpoints.
- GitHub Pages fallback uses client-side import parsing and direct image URLs so import and images still work without server functions.

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
