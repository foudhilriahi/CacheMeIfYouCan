import { chromium } from 'playwright';
import db from '../db/index.js';
import { insertJob } from './dedupe.js';
import { runWithConcurrency, randomDelay } from './throttle.js';
import scrapeRemoteOK from './platforms/remoteok.js';
import scrapeWWR from './platforms/weworkremotely.js';
import scrapeHN from './platforms/hackernews.js';

const platforms = {
  remoteok: scrapeRemoteOK,
  wwr: scrapeWWR,
  hackernews: scrapeHN,
};

const runScraper = async (platformNames = ['remoteok', 'wwr', 'hackernews']) => {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  const tasks = platformNames.map((name) => () => {
    const startTime = new Date().toISOString();
    const logId = db.prepare(`
      INSERT INTO scrape_logs (platform, status, started_at)
      VALUES (?, 'running', ?)
    `).run(name, startTime).lastInsertRowid;

    return platforms[name](browser)
      .then(async (jobs) => {
        await randomDelay();

        let newCount = 0;
        for (const job of jobs) {
          const inserted = insertJob(db, job);
          if (inserted) newCount++;
        }

        db.prepare(`
          UPDATE scrape_logs SET status = 'done', jobs_found = ?, jobs_new = ?, finished_at = datetime('now')
          WHERE id = ?
        `).run(jobs.length, newCount, logId);

        results[name] = { found: jobs.length, new: newCount };
        console.log(`✅ ${name}: ${jobs.length} found, ${newCount} new`);
      })
      .catch((err) => {
        db.prepare(`
          UPDATE scrape_logs SET status = 'error', error = ?, finished_at = datetime('now')
          WHERE id = ?
        `).run(err.message, logId);

        results[name] = { found: 0, new: 0, error: err.message };
        console.error(`❌ ${name}: ${err.message}`);
      });
  });

  await runWithConcurrency(tasks, 2);
  await browser.close();

  console.log('\n📊 Scrape complete:', JSON.stringify(results, null, 2));
  return results;
};

// CLI runner
if (process.argv[1] && process.argv[1].includes('index.js')) {
  const args = process.argv.slice(2);
  const platformsArg = args.length > 0 ? args : ['remoteok', 'wwr', 'hackernews'];
  runScraper(platformsArg).then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default runScraper;
