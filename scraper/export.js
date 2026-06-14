import db from "../db/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Export all jobs to JSON for GitHub Pages static demo
const exportJobs = () => {
  const jobs = db
    .prepare(
      `
    SELECT id, url, title, company, location, salary, tags, platform, posted_date, scraped_at
    FROM jobs ORDER BY scraped_at DESC
  `,
    )
    .all();

  const stats = {
    total_jobs: db.prepare("SELECT COUNT(*) as count FROM jobs").get().count,
    new_jobs: db
      .prepare("SELECT COUNT(*) as count FROM jobs WHERE is_new = 1")
      .get().count,
    platforms: db
      .prepare("SELECT platform, COUNT(*) as count FROM jobs GROUP BY platform")
      .all(),
    last_scrape: db
      .prepare(
        "SELECT finished_at FROM scrape_logs WHERE status = 'done' ORDER BY finished_at DESC LIMIT 1",
      )
      .get(),
    exported_at: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "..", "public", "data");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "jobs.json"),
    JSON.stringify(jobs, null, 2),
  );
  fs.writeFileSync(
    path.join(outputDir, "stats.json"),
    JSON.stringify(stats, null, 2),
  );

  // Also write to docs folder for GitHub Pages deployment
  const docsDir = path.join(__dirname, "..", "docs", "data");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(
    path.join(docsDir, "jobs.json"),
    JSON.stringify(jobs, null, 2),
  );
  fs.writeFileSync(
    path.join(docsDir, "stats.json"),
    JSON.stringify(stats, null, 2),
  );

  console.log(
    `📦 Exported ${jobs.length} jobs + stats to public/data/ and docs/data/`,
  );
};

// CLI runner
if (process.argv[1] && process.argv[1].includes("export.js")) {
  exportJobs();
}

export default exportJobs;
