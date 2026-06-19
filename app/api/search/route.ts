import { NextRequest, NextResponse } from "next/server";

import { readCachedResults, writeCachedResults } from "@/lib/cache";
import { scrapers } from "@/lib/scrapers";
import type { Product, SearchResponse, SiteStatus } from "@/lib/types";

// Tell Vercel this route needs the full 10-second window (Hobby plan max).
// Without this, Vercel may apply a shorter default.
export const maxDuration = 10;

// Give each site this long to respond. Set below the function timeout so
// there's time for the response to be assembled and sent before Vercel
// cuts the connection.
const SCRAPER_TIMEOUT_MS = 8_000;

interface ScraperOutcome {
  products: Product[];
  status: SiteStatus;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timed out")), ms);
  });
}

// Runs one site's scraper with a timeout and turns any failure into a
// SiteStatus instead of letting it reject the whole search.
async function runScraper(
  site: string,
  search: (query: string) => Promise<Product[]>,
  query: string,
): Promise<ScraperOutcome> {
  try {
    const products = await Promise.race([search(query), timeout(SCRAPER_TIMEOUT_MS)]);
    return { products, status: { site, ok: true, count: products.length } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { products: [], status: { site, ok: false, count: 0, error: message } };
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing search query. Use /api/search?q=<part name>" },
      { status: 400 },
    );
  }

  // Every site is scraped at the same time - this is what keeps a 7-site
  // search to "however long the slowest site takes" instead of the sum
  // of all seven.
  const outcomes = await Promise.all(
    scrapers.map(({ site, search }) => runScraper(site, search, query)),
  );

  const results = outcomes.flatMap((outcome) => outcome.products);
  results.sort((a, b) => a.price - b.price);

  const sites = outcomes.map((outcome) => outcome.status);

  // If every site failed (e.g. no internet during a demo), fall back to
  // whatever we found for this query last time, but keep the live (failed)
  // site statuses so it's clear the data is stale.
  if (results.length === 0) {
    const cached = await readCachedResults(query);
    if (cached) {
      return NextResponse.json({
        ...cached.response,
        sites,
        cachedAt: cached.cachedAt,
      });
    }
  }

  const response: SearchResponse = { query, results, sites };

  if (results.length > 0) {
    await writeCachedResults(query, response);
  }

  return NextResponse.json(response);
}
