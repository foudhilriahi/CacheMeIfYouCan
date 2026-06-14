import { chromium } from 'playwright';
import { randomDelay } from '../throttle.js';

// Hacker News "Who's Hiring" thread — uses Algolia API via Playwright
const scrapeHN = async (browser) => {
  const page = await browser.newPage();
  const jobs = [];

  // Get current month's thread ID from Algolia search
  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2025-01"

  try {
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=Who%20is%20Hiring&tags=story&numericFilters=created_at_i>${Math.floor(new Date(`${currentMonth}-01`).getTime() / 1000)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await randomDelay();

    const content = await page.textContent('body');
    const data = JSON.parse(content);

    // Find the most recent "Who is Hiring" thread
    const thread = data.hits.find((h) =>
      h.title && h.title.toLowerCase().includes('who is hiring')
    );

    if (!thread || !thread.objectID) {
      console.log('No HN Who is Hiring thread found for this month');
      return jobs;
    }

    // Fetch top-level comments of that thread
    const commentsUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=100`;
    await page.goto(commentsUrl, { waitUntil: 'networkidle' });
    await randomDelay();

    const commentsContent = await page.textContent('body');
    const commentsData = JSON.parse(commentsContent);

    for (const comment of commentsData.hits) {
      const text = comment.comment_text || '';
      if (!text || text.length < 50) continue;

      // HN job posts usually start with company name or have "hiring" context
      // Simple parse: first line often contains company | location | role
      const firstLine = text.split('\n')[0].trim();
      const parts = firstLine.split('|').map((p) => p.trim());

      const company = parts[0] || '';
      const location = parts[1] || '';
      const title = parts[2] || 'Developer';

      // Skip if first line doesn't look like a job post
      if (!company || company.length > 40) continue;

      jobs.push({
        url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
        title: title,
        company: company,
        location: location,
        description: text.slice(0, 500),
        salary: '',
        tags: '',
        platform: 'hackernews',
        posted_date: comment.created_at ? comment.created_at.slice(0, 10) : '',
      });
    }
  } catch (err) {
    console.error('HN scrape error:', err.message);
  } finally {
    await page.close();
  }

  return jobs;
};

export default scrapeHN;
