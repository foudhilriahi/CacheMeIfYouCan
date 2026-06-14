import { chromium } from 'playwright';
import { randomDelay } from '../throttle.js';

// RemoteOK has a JSON API — we use Playwright to fetch it for consistency
// but parse the JSON response directly (much faster than DOM scraping)
const scrapeRemoteOK = async (browser) => {
  const page = await browser.newPage();
  const jobs = [];

  try {
    await page.goto('https://remoteok.com/api', { waitUntil: 'networkidle' });
    await randomDelay();

    const content = await page.textContent('body');
    const data = JSON.parse(content);

    for (const item of data) {
      if (!item.id || !item.position) continue;

      jobs.push({
        url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
        title: item.position,
        company: item.company || '',
        location: item.location || 'Remote',
        description: item.description || '',
        salary: item.salary || '',
        tags: (item.tags || []).join(','),
        platform: 'remoteok',
        posted_date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      });
    }
  } catch (err) {
    console.error('RemoteOK scrape error:', err.message);
  } finally {
    await page.close();
  }

  return jobs;
};

export default scrapeRemoteOK;
