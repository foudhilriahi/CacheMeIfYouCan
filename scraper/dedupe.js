import crypto from "crypto";

// Normalize title for deduplication: lowercase, strip punctuation, collapse whitespace
const normalizeTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// Hash a URL for fast dedup lookup
const hashUrl = (url) => {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
};

// Composite key for cross-platform dedup when URLs differ
// Same job posted on different sites gets same composite hash
const compositeKey = (title, company, location) => {
  const normalized = [
    normalizeTitle(title),
    company.toLowerCase().trim(),
    location.toLowerCase().trim(),
  ].join("|");
  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 16);
};

// Check if a job already exists in DB — by url_hash first, then composite key
const isDuplicate = (db, job) => {
  const urlHash = hashUrl(job.url);
  const compKey = compositeKey(job.title, job.company, job.location || "");

  const byUrl = db
    .prepare("SELECT id FROM jobs WHERE url_hash = ?")
    .get(urlHash);
  if (byUrl) return true;

  const byComposite = db
    .prepare("SELECT id FROM jobs WHERE dedupe_key = ?")
    .get(compKey);
  if (byComposite) return true;

  return false;
};

// Insert a job, tracking both URL-level and cross-platform dedupe keys
const insertJob = (db, job) => {
  const urlHash = hashUrl(job.url);
  const compKey = compositeKey(job.title, job.company, job.location || "");

  try {
    db.prepare(
      `
      INSERT INTO jobs (url, url_hash, dedupe_key, title, company, location, description, salary, tags, platform, posted_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      job.url,
      urlHash,
      compKey,
      job.title,
      job.company,
      job.location || "",
      job.description || "",
      job.salary || "",
      job.tags || "",
      job.platform,
      job.posted_date || "",
    );
    return true;
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      // Duplicate url_hash or dedupe_key — skip
      return false;
    }
    throw err;
  }
};

export { hashUrl, compositeKey, normalizeTitle, isDuplicate, insertJob };
