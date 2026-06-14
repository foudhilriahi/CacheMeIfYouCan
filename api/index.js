import db from "../db/index.js";
import runScraper from "../scraper/index.js";
import exportJobs from "../scraper/export.js";

export function registerApiRoutes(app) {
  // List jobs with filters
  app.get("/api/jobs", async (req) => {
    const { platform, company, search, limit = 50, offset = 0 } = req.query;

    let query =
      "SELECT id, url, title, company, location, salary, tags, platform, posted_date, scraped_at FROM jobs WHERE 1=1";
    const params = [];

    if (platform) {
      query += " AND platform = ?";
      params.push(platform);
    }
    if (company) {
      query += " AND company LIKE ?";
      params.push(`%${company}%`);
    }
    if (search) {
      query += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY scraped_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const jobs = db.prepare(query).all(...params);
    const total = db
      .prepare("SELECT COUNT(*) as count FROM jobs WHERE 1=1")
      .get().count;

    return { jobs, total, limit: Number(limit), offset: Number(offset) };
  });

  // Single job detail
  app.get("/api/jobs/:id", async (req) => {
    const job = db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(req.params.id);
    if (!job) return req.reply.code(404).send({ error: "Job not found" });
    return job;
  });

  // Stats summary
  app.get("/api/stats", async () => {
    return {
      total_jobs: db.prepare("SELECT COUNT(*) as count FROM jobs").get().count,
      new_jobs: db
        .prepare("SELECT COUNT(*) as count FROM jobs WHERE is_new = 1")
        .get().count,
      platforms: db
        .prepare(
          "SELECT platform, COUNT(*) as count FROM jobs GROUP BY platform",
        )
        .all(),
      last_scrape: db
        .prepare(
          "SELECT finished_at FROM scrape_logs WHERE status = 'done' ORDER BY finished_at DESC LIMIT 1",
        )
        .get(),
    };
  });

  // Trigger a scrape run
  app.post("/api/scrape", async (req) => {
    const { platforms } = req.body || {};
    const platformNames = platforms || ["remoteok", "wwr", "hackernews"];

    // Mark all existing jobs as no longer new before scrape
    db.prepare("UPDATE jobs SET is_new = 0").run();

    const results = await runScraper(platformNames);
    exportJobs();

    return { status: "done", results };
  });

  // Scrape logs history (JSON)
  app.get("/api/scrape/logs", async () => {
    return db
      .prepare("SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 20")
      .all();
  });

  // Scrape logs history (HTML fragment for htmx)
  app.get("/api/scrape/logs/fragment", async (req, reply) => {
    const logs = db
      .prepare("SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 8")
      .all();

    const html = logs.length
      ? logs
          .map((log) => {
            const status = log.status || "unknown";
            const emoji =
              status === "done" ? "✅" : status === "error" ? "❌" : "⏳";
            const summary = `${emoji} ${log.platform} · ${status} · found ${log.jobs_found || 0}, new ${log.jobs_new || 0}`;
            const ended = log.finished_at ? ` · ${log.finished_at}` : "";
            const err = log.error ? ` · ${log.error}` : "";
            return `<div>${summary}${ended}${err}</div>`;
          })
          .join("")
      : "<div>No scrape runs yet.</div>";

    reply.type("text/html").send(html);
  });
}
