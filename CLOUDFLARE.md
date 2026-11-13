# Cloudflare Pages deployment

The live portfolio is at https://365-trucking.pages.dev/. This source copy contains placeholder service configuration and is not automatically linked to that deployment.

1. Configure your own public Supabase settings in src/public-config.js and optionally Maps in dist/maps-config.js.
2. Run npm ci, npm run build:auth, npm run check, and npm test.
3. Run node scripts/prepare-cloudflare.mjs https://YOUR-PROJECT.pages.dev .cloudflare-dist (replace the project name; the output folder must not already exist).
4. Upload the contents of .cloudflare-dist to your Cloudflare Pages project, with index.html at the root.
5. Configure Supabase Auth site/redirect URLs and the Google Maps website allowlist for your deployed origin. Update canonical and sharing URLs for your own site.

Only static dist files are packaged. SQL, tests, source files, node_modules, environment files, and email preview pages are excluded. Do not deploy private credentials. The current repository includes public placeholder values; configure and test your own backend before using protected routes.
