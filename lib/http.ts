// Shared fetch helpers. Every scraper goes through fetchHtml() so we get
// a consistent User-Agent, a request timeout, and per-host rate limiting
// "for free" instead of every scraper reimplementing it.

// Identifies this project honestly to the sites it talks to, per the
// "scraping etiquette" requirements.
export const USER_AGENT =
  "sri-lanka-pc-price-comparator/0.1 (portfolio project; educational, non-commercial price comparison)";

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_BETWEEN_REQUESTS_MS = 1500;

// A few sites publish a longer "Crawl-delay" in their robots.txt. We honour
// those specifically instead of using the default for every host.
const CRAWL_DELAY_OVERRIDES_MS: Record<string, number> = {
  "techzone.lk": 3000,
  "www.nanotek.lk": 20000,
  "nanotek.lk": 20000,
};

// Last request time per hostname, so repeated requests to the same site
// (e.g. a scraper that needs more than one page) are spaced out even
// though all scrapers run concurrently against *different* hosts.
const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(hostname: string): Promise<void> {
  const delay = CRAWL_DELAY_OVERRIDES_MS[hostname] ?? DEFAULT_DELAY_BETWEEN_REQUESTS_MS;
  const last = lastRequestAt.get(hostname) ?? 0;
  const wait = last + delay - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(hostname, Date.now());
}

// Shared by fetchHtml() and postForm() below: applies our User-Agent, a
// timeout, and per-host throttling, then returns the response body as
// text. Throws on network errors, timeouts, or non-2xx responses -
// scrapers catch this and report the site as failed without taking down
// the whole search.
async function request(url: string, init?: RequestInit): Promise<string> {
  const hostname = new URL(url).hostname;
  await throttle(hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...init?.headers },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${url} responded with HTTP ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// Fetches a URL as text. Used by scrapers that expose search results via
// a plain GET request with a query string.
export async function fetchHtml(url: string): Promise<string> {
  return request(url);
}

// Submits a classic HTML form (application/x-www-form-urlencoded) via
// POST. Used by sites whose search only works as a form submission rather
// than a GET with query parameters (e.g. barclays.lk).
export async function postForm(
  url: string,
  fields: Record<string, string>,
): Promise<string> {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
