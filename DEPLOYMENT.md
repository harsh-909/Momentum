# Deploying Momentum 2.0 (free tier)

Three free services, deployed in this order so the config values exist when you need them:

```
Neon (Postgres)  <--  Render (FastAPI API)  <--  Vercel (React static build)
                          ^
                          |  GET /api/health every 10 min
                      cron-job.org (keeps Render warm)
```

Total cost: $0.
Accounts needed: GitHub (repo must be pushed), Neon, Render, Vercel, cron-job.org.

## 1. Neon (database)

1. Create a project at https://neon.tech (free tier).
   Name it `momentum`, pick the region closest to you.
2. From the project dashboard copy TWO connection strings:
   - The **pooled** string (host contains `-pooler`). Used by the app at runtime.
   - The **direct** string (no `-pooler`). Used only by Alembic migrations.
3. Rewrite both to the async driver scheme the app expects:
   `postgresql://...` becomes `postgresql+asyncpg://...` and drop any `?sslmode=require` suffix in favor of `?ssl=require`.
   Example: `postgresql+asyncpg://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?ssl=require`
4. Optional but recommended: create a `dev` branch in Neon for pre-deploy testing against real Postgres.

Why Neon over Supabase: Neon auto-resumes from idle in under a second; Supabase free pauses the whole project after a week of inactivity and needs a manual dashboard restore.

## 2. Render (API)

1. https://render.com -> New -> Web Service -> connect the GitHub repo, branch `momentum-2.0`.
2. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Pre-Deploy Command**: `alembic upgrade head`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/health`
   - **Instance Type**: Free
3. Environment variables:
   - `DATABASE_URL` = the Neon **pooled** `postgresql+asyncpg://...` string
   - `MIGRATIONS_DATABASE_URL` = the Neon **direct** string (Alembic uses it via env.py)
   - `CORS_ORIGINS` = leave as `http://localhost:5173` for now; you will replace it with the Vercel URL in step 4
   - `ENV` = `production`
   - `PYTHON_VERSION` = `3.12`
4. Deploy. When it is live, note the service URL, e.g. `https://momentum-api.onrender.com`, and confirm `GET /api/health` returns `{"status":"ok"}`.

Free-tier reality: the instance spins down after ~15 minutes idle and cold-starts in ~30-60s.
Step 5 fixes that.

## 3. Vercel (frontend)

1. https://vercel.com -> Add New -> Project -> import the repo.
2. Settings:
   - **Root Directory**: `frontend`
   - Framework preset: Vite (build `npm run build`, output `dist` - the defaults)
3. Environment variable:
   - `VITE_API_URL` = the Render URL from step 2 (no trailing slash), e.g. `https://momentum-api.onrender.com`
4. Deploy and note the production URL, e.g. `https://momentum-xyz.vercel.app`.

## 4. Close the CORS loop

Back in Render, set `CORS_ORIGINS` to the exact Vercel production URL (comma-separate extra origins if you keep a preview URL too):

```
CORS_ORIGINS=https://momentum-xyz.vercel.app
```

Redeploy the Render service.
Open the Vercel URL, sign up, and confirm goals save (watch the "Saved" chip).

## 5. Keep the API warm

Create a free cron job at https://cron-job.org:
- URL: `https://momentum-api.onrender.com/api/health`
- Interval: every 10 minutes.

`/api/health` deliberately never touches the database, so this keeps Render warm without burning Neon compute hours (Neon still autosuspends between real requests, which is fine because it resumes instantly).

## 6. Move your data in

Option A (recommended, no tooling): open the deployed app, sign up as `harsh`, then Header -> Import -> pick `userData/harsh.json`.
The import validates the v1 file, replaces the fresh profile, and saves immediately.

Option B (bulk/CLI): from `backend/` with `DATABASE_URL` pointed at Neon:

```
.venv\Scripts\python scripts/import_userdata.py --dir ../userData
```

It prompts for an initial password per user and never overwrites existing passwords.

## 7. Troubleshooting

- **Login works locally but not on Vercel**: `CORS_ORIGINS` does not exactly match the Vercel origin (scheme + host, no trailing slash), or `VITE_API_URL` was set after the build - redeploy the frontend after changing env vars.
- **First request of the day takes a minute**: the cron pinger is not running, or Render slept anyway - check the cron-job.org execution log.
- **`ssl` errors on Render**: the `DATABASE_URL` must use `postgresql+asyncpg://` and `?ssl=require` (asyncpg does not understand `sslmode`).
- **Alembic fails on deploy**: `MIGRATIONS_DATABASE_URL` must be the direct (non-pooled) Neon string.
- **429 rate_limited during testing**: the auth endpoints rate-limit per IP/username; wait out the window shown in `retryAfter`.

## Free-tier limits recap

- Neon: 0.5 GB storage (snapshots are ~1 MB/user/year - effectively unlimited here), ~190 compute hours/month (fine because the health check never touches it).
- Render: 750 instance-hours/month - exactly enough for one always-on service kept warm by the pinger.
- Vercel Hobby: non-commercial use, 100 GB bandwidth/month - far above what a personal tracker needs.

Upgrade path if it ever matters: Render Starter ($7/mo) removes the spin-down; Neon Launch adds storage/compute; nothing in the code changes.
