import { promises as fs } from "fs";
import path from "path";

import type { SearchResponse } from "./types";

// All cached results live in one JSON file. There's no database here -
// this is just enough persistence so the app has something to show if a
// site is slow or temporarily down.
const CACHE_FILE = path.join(process.cwd(), "data", "cache.json");

interface CacheEntry {
  response: SearchResponse;
  cachedAt: string;
}

type CacheFile = Record<string, CacheEntry>;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

async function readCacheFile(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    // No cache file yet, or it's corrupted - start fresh.
    return {};
  }
}

// Returns the most recent cached results for a query, if we have any.
export async function readCachedResults(query: string): Promise<CacheEntry | undefined> {
  const cache = await readCacheFile();
  return cache[normalizeQuery(query)];
}

// Saves the results of a successful search so they can be served as a
// fallback later. Failures to write are logged but not thrown - caching
// is a nice-to-have, not something that should break a search.
export async function writeCachedResults(query: string, response: SearchResponse): Promise<void> {
  const cache = await readCacheFile();
  cache[normalizeQuery(query)] = { response, cachedAt: new Date().toISOString() };

  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Failed to write cache file:", err);
  }
}
