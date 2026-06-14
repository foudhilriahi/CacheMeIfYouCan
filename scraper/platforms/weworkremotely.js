import { chromium } from 'playwright';
import { randomDelay } from '../throttle.js';

// We Work Remotely — full Playwright HTML scraping
const scrapeWWR = async (browser) => {
  const page = await browser.newPage();
  const jobs = [];

  try {
    await page.goto('https://weworkremotely.com', { waitUntil: 'networkidle' });
    await randomDelay();

    // Click into remote job categories and scrape listings
    const listings = await page.locator('li.featured, li.job').all();

    for (const listing of listings) {
      try {
        const titleEl = listing.locator('a .title, a .position');
        const companyEl = listing.locator('.company');
        const linkEl = listing.locator('a').first();

        const title = await titleEl.textContent() || '';
        const company = await companyEl.textContent() || '';
        const url = await linkEl.getAttribute('href') || '';

        if (!title || !url) continue;

        const tags = await listing.locator('.tags .tag').allTextContents();

        jobs.push({
          url: url.startsWith('http') ? url : `https://weworkremotely.com${url}`,
          title: title.trim(),
          company: company.trim(),
          location: 'Remote',
          description: '',
          salary: '',
          tags: tags.join(','),
          platform: 'wwr',
          posted_date: '',
        });
      } catch {
        // Skip malformed listings
      }
    }
  } catch (err) {
    console.error('WWR scrape error:', err.message);
  } finally {
    await page.close();
  }

  return jobs;
};

export default scrapeWWR;
