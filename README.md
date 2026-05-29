# In-Sync ATS

Healthcare-focused Applicant Tracking System for In-Sync. Manages clients, candidates, mandates, demand-coms, imports, and the recruitment pipeline end-to-end.

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn-ui
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **Hosting:** Cloudflare Pages
- **Mobile shell:** Capacitor (camera, geolocation, network)
- **Integrations:** Aadhaar / PAN verification, Exotel telephony, resume parsing, bulk import pipelines

## Local Development

```sh
npm install
npm run dev          # http://localhost:8080
npm run build        # outputs to dist/
npm run lint
```

`.env` (gitignored) must contain at minimum:

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

For deploys, also include:

```env
CLOUDFLARE_API_TOKEN=cfut_...
CLOUDFLARE_ACCOUNT_ID=...
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # server-only, never bundled
SUPABASE_DB_PASSWORD=...
```

Only values prefixed `VITE_` are inlined into the browser bundle. Anything that grants write access (service role key, sbp_ token, Cloudflare API token) must NOT be prefixed `VITE_`.

## Deploy — Frontend (Cloudflare Pages)

The frontend ships directly from a local working tree using Wrangler. There is no GitHub Actions step for the frontend; pushing code does not deploy it.

```powershell
npm run build
Set-Content -Path dist\_redirects -Value "/*  /index.html  200"
wrangler pages deploy dist --project-name=ats-sync --branch=main
```

The Cloudflare Pages project is `ats-sync`, served at `https://ats-sync.pages.dev`. The custom domain `ats.in-sync.co.in` points at it via a proxied CNAME on the `in-sync.co.in` zone.

## Deploy — Supabase (CI)

Migrations and edge functions deploy automatically on push to `main` when files under `supabase/**` change. See `.github/workflows/supabase-deploy.yml`.

Required GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN` (`sbp_…`)
- `SUPABASE_DB_PASSWORD`
- `VITE_SUPABASE_PROJECT_ID`

## Custom Domain

Production: `https://ats.in-sync.co.in`

DNS is managed in Cloudflare; the record is a proxied CNAME pointing at `ats-sync.pages.dev`.

## Rollback

Forward-rollback (bad new deploy, Pages itself fine): use the Cloudflare Pages dashboard to roll back to a previous deployment of `ats-sync`.

Full rollback to Azure (only viable while the legacy SWA still exists): PATCH the production CNAME back to `lemon-bush-0d238d11e.7.azurestaticapps.net` via the Cloudflare API.
