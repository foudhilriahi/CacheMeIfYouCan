// Custom throttling module — random delays between requests to avoid scraping blocks

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = (min = 1500, max = 4000) => {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return delay(ms);
};

// Concurrency limiter — runs tasks in batches
const runWithConcurrency = async (tasks, limit = 2) => {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = task().then((r) => {
      executing.splice(executing.indexOf(p), 1);
      return r;
    });
    executing.push(p);
    results.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
};

export { delay, randomDelay, runWithConcurrency };
