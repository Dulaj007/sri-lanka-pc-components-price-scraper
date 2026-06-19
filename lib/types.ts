// Shared types used by the scrapers, the API route, and the UI.
// Keeping them in one place means every scraper returns data in the
// exact same shape, so the frontend doesn't need to care which site
// a result came from.

// A single product listing found on one of the stores.
export interface Product {
  site: string; // hostname of the store, e.g. "pcbuilders.lk"
  title: string; // product name as shown on the store's page
  price: number; // numeric price (in the given currency, usually LKR)
  currency: string; // e.g. "LKR"
  condition: "new" | "used" | "unknown";
  url: string; // direct link to the product page
  inStock: boolean;
  warranty?: string; // e.g. "2 Years", only set when the listing mentions one
}

// The outcome of running one site's scraper, regardless of whether it
// found anything. Used to show "X of Y sites responded" and to surface
// per-site errors without failing the whole search.
export interface SiteStatus {
  site: string;
  ok: boolean; // false if the scraper threw, timed out, or was skipped
  count: number; // number of products this site contributed
  error?: string; // human-readable reason, only set when ok is false
}

// The full response returned by /api/search.
export interface SearchResponse {
  query: string;
  results: Product[]; // merged results from every site, sorted by price ascending
  sites: SiteStatus[]; // one entry per site that was attempted
  cachedAt?: string; // ISO timestamp, present if served from the JSON cache
}
