# CacheMeIfYouCan

A job market scraper + tracker that collects remote roles from multiple sources, deduplicates them, stores them in SQLite, and serves them through a Fastify API to a searchable dashboard.

**Stack:** Node.js, Playwright, SQLite (`better-sqlite3`), Fastify, Alpine.js, htmx

---

## What this app does

- Scrapes jobs from:
  - RemoteOK
  - Hacker News (Who is Hiring)
  - WeWorkRemotely
- Deduplicates jobs using:
  - URL hash (exact duplicate protection)
  - Composite dedupe key (`title + company + location`) for cross-platform duplicates
- Stores jobs + scrape logs in SQLite
- Exposes API endpoints for dashboard data and scrape triggers
- Provides a dashboard with search/filter + detail panel
- Supports:
  - **Local full mode** (real Fastify API)
  - **GitHub Pages static mode** (real scraped JSON exported by automation)

---

## How to use it (local)

### 1) Install

```bash
npm ci
npx playwright install chromium
```

### 2) Run a scrape

```bash
npm run scrape
```

### 3) Start the app

```bash
npm start
```

Open: `http://localhost:3000`

### 4) Optional: export static data

```bash
npm run export
```

This writes JSON to `public/data/` and `docs/data/`.

---

## How it works under the hood

## Architecture

- `scraper/`
  - Platform scrapers (Playwright)
  - Throttling/concurrency controls
  - Dedupe + DB inserts
- `db/index.js`
  - SQLite initialization + schema + indexes + migration
- `api/index.js`
  - Fastify routes (`/api/jobs`, `/api/stats`, `/api/scrape`, etc.)
- `public/index.html`
  - Main UI (Alpine.js + htmx)
- `docs/index.html`
  - Pages copy of UI (kept in sync by workflow)

## Data flow

1. Scraper pulls jobs from each platform
2. Each job gets:
   - `url_hash`
   - `dedupe_key`
3. Insert skips duplicates via unique constraints
4. Jobs are stored in `data/jobs.db`
5. API serves live data in local mode
6. Export step writes JSON snapshots for static hosting

---

## API reference (local mode)

- `GET /api/jobs?limit=100&search=&platform=`
- `GET /api/jobs/:id`
- `GET /api/stats`
- `POST /api/scrape`
- `GET /api/scrape/logs`
- `GET /api/scrape/logs/fragment` (htmx HTML fragment)

---

## Throttling / anti-block strategy

Implemented in `scraper/throttle.js`:

- Random delay between requests (`randomDelay`)
- Concurrency limiting (`runWithConcurrency`, default = 2)

This reduces aggressive burst behavior and lowers block risk.

---

## Docker

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

---

## GitHub Pages (real refreshed data)

Important: GitHub Pages is static, so it cannot run Fastify/Playwright at request time.

This repo provides near-live behavior by using GitHub Actions to:

- scrape on a schedule,
- export JSON into `docs/data/`,
- publish updates automatically.

Workflow: `.github/workflows/scrape.yml`

Target repo:
- `https://github.com/foudhilriahi/CacheMeIfYouCan`

Target Pages URL:
- `https://foudhilriahi.github.io/CacheMeIfYouCan/`

### One-time GitHub setup //done

1. Push code to `main` branch in `foudhilriahi/CacheMeIfYouCan`.
2. In **Settings → Actions → General → Workflow permissions**, set **Read and write permissions**.
3. In **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/docs**
4. Run workflow manually once from **Actions → Scheduled Scrape & Publish Pages Data**.

After first run, `docs/data/jobs.json` and `docs/data/stats.json` will exist and Pages will show real scraped data.

---

## Project structure

```text
.github/workflows/   # CI/CD automation
api/                 # Fastify routes
db/                  # SQLite init + schema/migration
docs/                # GitHub Pages site + exported data
public/              # Local frontend
scraper/             # Scraper engine + platforms + dedupe + export
server.js            # App entrypoint
```

---

## Notes

- WeWorkRemotely can occasionally timeout depending on network/runtime conditions.
- Data DB file is excluded from git (`data/`, `*.db`) and regenerated/populated by runs.
