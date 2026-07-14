# Tier 1 deploy guide — Vercel walkthrough

The Next.js app at `apps/web/` deploys to Vercel as its own project.
The Tier 0 static demo at `manhaj.pages.dev` stays put on Cloudflare —
those URLs keep working until we cut over.

## Plain-English glossary

- **Vercel** — the company that builds Next.js. Their hosting platform is
  the "native" home for Next.js apps. Hobby tier is free and fine for the
  pilot.
- **Monorepo subdirectory deploy** — we have one git repo, multiple
  projects inside (`apps/web/`, plus the schema/etl/templates at the root).
  Vercel needs to be told the Next.js app lives in `apps/web/`, not the
  repo root.
- **Environment variables** — secrets and config strings the app reads at
  runtime. Vercel encrypts them at rest. We never commit them.

---

## Step 1 — Sign up for Vercel (~3 min, one-time)

1. Open <https://vercel.com/signup>
2. Click **"Continue with GitHub"** → authorize Vercel to read your repos
   (Vercel uses your existing GitHub identity; no new password)
3. Pick the **Hobby (Personal)** plan — free, sufficient for the pilot
4. Skip the "Invite teammates" step

You're now in the Vercel dashboard.

---

## Step 2 — Import the manhaj repo as a project

1. Top-right: **"Add New…"** → **"Project"**
2. Under **"Import Git Repository"**, find `Emouawad2/manhaj` in the list
   (if you don't see it, click **"Adjust GitHub App Permissions"** and
   grant Vercel access to the manhaj repo)
3. Click **"Import"** next to `manhaj`

You land on the **Configure Project** page. This is where the
monorepo-subdirectory setting matters.

---

## Step 3 — Configure the project (CRITICAL — don't skip)

### Root Directory

Click **"Edit"** next to "Root Directory" and set it to:

```
apps/web
```

This tells Vercel "the Next.js app lives in this subdirectory, not the
repo root." If you skip this, Vercel will try to build the whole repo
and fail because there's no package.json at the root.

### Framework Preset

After setting Root Directory, Vercel auto-detects **Next.js** and shows
it in the Framework Preset dropdown. Leave it as-is.

### Build & Output Settings

Leave all defaults:
- Build Command: `next build` (auto-detected)
- Output Directory: `.next` (auto-detected)
- Install Command: `npm install` (auto-detected)
- Development Command: leave blank

### Environment Variables (paste these in)

Expand the **"Environment Variables"** section. Add each variable below
(name on the left, value on the right). Make sure each one applies to
**all three environments** (Production, Preview, Development) — leave
that checkbox checked.

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://qntmzazndkcdgkwmrhae.supabase.co` | Safe to commit; browser-visible |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_757UEjZSZRD81kd1Cmp2QQ_r0eQXl4H` | Safe to commit; browser-visible |
| `APP_NAME` | `Manhaj` | |
| `SCHOOL_NAME` | `International School of Oman` | |
| `ACADEMIC_YEAR` | `2026-2027` | |
| `SUPABASE_SERVICE_ROLE_KEY` | *(your service-role key from Supabase Dashboard → Settings → API)* | ⚠️ Server-only. Paste here, NEVER in chat. |

**Important about `SUPABASE_SERVICE_ROLE_KEY`:** in the Vercel UI there's
usually a small lock icon or "Sensitive" toggle next to the value field.
Use it — that marks the var as encrypted-at-rest and hides the value
from teammates with read-only access.

### Click "Deploy"

Vercel starts building. Takes about 1–2 minutes.

---

## Step 4 — Verify the deploy worked

Once the build finishes, Vercel shows a URL like
`https://manhaj-emouawad2.vercel.app` (or similar). Open it.

You should see:
- **Landing page** at `/` with 4 role cards + live counts:
  `69 teachers · 41 sections · 32 subjects · 453 load assignments`
- **Admin dashboard** at `/admin` with real numbers in every hero card
  and the load distribution showing all 69 teachers

If both pages show the right numbers, deploy is healthy. If they show
"—" or zeros, the service-role key probably didn't get saved correctly —
go back to Vercel → Settings → Environment Variables and check.

---

## Step 5 — Custom domain (optional, ~5 min)

If you want a real domain like `app.manhaj.app` instead of
`manhaj-emouawad2.vercel.app`:

1. Vercel Project → **Settings → Domains**
2. Type `app.manhaj.app` (or your preferred subdomain) → **Add**
3. Vercel shows DNS records to add. Two paths depending on where you
   bought the domain:
   - **If domain is on Cloudflare** (e.g. you bought it via Cloudflare
     Registrar earlier): add a CNAME record in Cloudflare DNS pointing to
     `cname.vercel-dns.com`. Wait ~1 min for propagation.
   - **If domain is elsewhere**: follow Vercel's instructions for your
     registrar.

For the pilot, the default `.vercel.app` URL is fine.

---

## Step 6 — Tell me when it's live

Reply with the deployed URL and I'll cross-check from this side:
- HTTP 200 on `/` and `/admin`
- Real counts visible
- No console errors
- Headers look right (security, caching)

Then we move to the next chunk: porting the parent course-selection
form to Next.js (so it actually saves to Postgres instead of just
showing "Submitted"), then magic-link auth.

---

## What happens to manhaj.pages.dev?

Stays alive for now. It's our:
- Sandbox for any static mockups (attendance, section-mapping currently
  live there)
- Fallback URL while Tier 1 is in flux
- Auto-deploy testbed for design changes

Once the Next.js app at Vercel covers everything the static demo does,
we'll either:
- Point manhaj.pages.dev's domain at Vercel and retire Cloudflare Pages, OR
- Repurpose manhaj.pages.dev as the "marketing site" / pre-login landing
  and keep the Next.js app at a separate subdomain

That's a Tier 2 decision; doesn't matter right now.
