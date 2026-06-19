"use client";

// This is the whole frontend - one page component that owns the search
// state and renders everything from the search box to the results table.
// "use client" makes it a React Client Component, which is required because
// we use useState and event handlers (Next.js server components can't do
// that).

import { useState } from "react";

import type { Product, SearchResponse } from "@/lib/types";

const SITES = [
  { name: "PC Builders", url: "https://pcbuilders.lk" },
  { name: "TechZone", url: "https://techzone.lk" },
  { name: "Game Street", url: "https://gamestreet.lk" },
  { name: "MD Computers", url: "https://mdcomputers.lk" },
  { name: "Nanotek", url: "https://www.nanotek.lk" },
  { name: "Chama Computers", url: "https://www.chamacomputers.lk" },
  { name: "Barclays", url: "https://www.barclays.lk" },
];

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

// Turns a raw LKR number into a readable string like "LKR 28,000.00".
// Using the standard Intl API means commas/decimals follow the locale
// automatically rather than us hand-rolling the formatting.
function formatPrice(price: number): string {
  return (
    "LKR " +
    price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Triggers a browser download of the current search results as a .json
// file. Works entirely client-side - no server round-trip needed.
function downloadJson(data: SearchResponse): void {
  const filename = `${data.query.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-prices.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function PriceCard({ label, product }: { label: string; product: Product }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {formatPrice(product.price)}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{product.site}</span>
    </div>
  );
}

function StockBadge({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
      In stock
    </span>
  ) : (
    <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
      Out of stock
    </span>
  );
}

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [sitesOpen, setSitesOpen] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setSearchError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
      const data = (await res.json()) as SearchResponse;
      setResults(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  // Sort the results independently of the order the API returns them.
  // Defaulting to cheapest-first makes price comparison the most natural
  // way to read the table.
  const sorted = results
    ? [...results.results].sort((a, b) =>
        sortAsc ? a.price - b.price : b.price - a.price,
      )
    : [];

  const lowestProduct = sorted.length > 0 ? sorted[0] : null;
  const highestProduct = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const sitesOk = results?.sites.filter((s) => s.ok).length ?? 0;
  const sitesTotal = results?.sites.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ── Sites modal ─────────────────────────────────────────── */}
      {sitesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSitesOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Stores we search
              </h2>
              <button
                onClick={() => setSitesOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {SITES.map((site) => (
                <li key={site.url}>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <span>{site.name}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {site.url.replace("https://", "").replace("www.", "")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Sri Lanka PC Price Comparator
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Live brand-new prices from 7 local stores
            </p>
          </div>

          {/* Right-side header actions */}
          <div className="flex items-center gap-2">
            {/* Sites list button */}
            <button
              onClick={() => setSitesOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5M1.5 8h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              View sites
            </button>

            {/* GitHub icon link */}
            <a
              href="https://github.com/Dulaj007"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub profile"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* ── Search form ────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. RTX 5070, Ryzen 7 9800X3D, 32GB DDR5…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:ring-zinc-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* ── Loading state ─────────────────────────────────────── */}
        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-300" />
            <p className="text-sm">Searching all 7 stores simultaneously…</p>
          </div>
        )}

        {/* ── Fetch error ───────────────────────────────────────── */}
        {searchError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {searchError}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────── */}
        {results && !loading && (
          <div className="mt-8 flex flex-col gap-6">
            {/* Stale cache notice */}
            {results.cachedAt && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                All sites failed to respond — showing cached results from{" "}
                {new Date(results.cachedAt).toLocaleString()}.
              </div>
            )}

            {sorted.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No results found for &ldquo;{results.query}&rdquo; across any of the {sitesTotal} stores.
              </p>
            ) : (
              <>
                {/* ── Summary row ──────────────────────────────── */}
                <div className="flex flex-wrap items-start gap-3">
                  {lowestProduct && (
                    <PriceCard label="Lowest price" product={lowestProduct} />
                  )}
                  {highestProduct && lowestProduct !== highestProduct && (
                    <PriceCard label="Highest price" product={highestProduct} />
                  )}
                  <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Stores responded
                    </span>
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {sitesOk} / {sitesTotal}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {sorted.length} listing{sorted.length !== 1 ? "s" : ""} found
                    </span>
                  </div>
                </div>

                {/* ── Toolbar: sort + export ────────────────────── */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">Sort by price:</label>
                    <button
                      onClick={() => setSortAsc(true)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        sortAsc
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      Cheapest first
                    </button>
                    <button
                      onClick={() => setSortAsc(false)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        !sortAsc
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      Most expensive first
                    </button>
                  </div>
                  <button
                    onClick={() => downloadJson(results)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <path d="M8 2v8m0 0L5 7m3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Save as JSON
                  </button>
                </div>

                {/* ── Results table ────────────────────────────── */}
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/60">
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Store</th>
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Product</th>
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Price</th>
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Warranty</th>
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Stock</th>
                        <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((product, i) => (
                        <tr
                          key={`${product.site}-${product.url}-${i}`}
                          className="border-b border-zinc-100 bg-white transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {product.site}
                          </td>
                          <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                            {product.title}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatPrice(product.price)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                            {product.warranty ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StockBadge inStock={product.inStock} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Per-site error messages ───────────────────── */}
                {results.sites.some((s) => !s.ok) && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Sites that did not respond
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {results.sites
                        .filter((s) => !s.ok)
                        .map((s) => (
                          <span
                            key={s.site}
                            title={s.error}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                          >
                            {s.site}: {s.error ?? "failed"}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col items-center gap-3 text-center">
          {/* Disclaimer */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Disclaimer:</span>{" "}
            This project was built for educational purposes only. All prices are
            scraped live from public store pages — always verify on the store&apos;s
            own site before purchasing. Not intended for commercial use.
          </p>

          {/* Divider */}
          <div className="w-16 border-t border-zinc-200 dark:border-zinc-700" />

          {/* Signature */}
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Made with{" "}
            <span className="text-red-500" aria-label="love">♥</span>
            {" "}by{" "}
            <a
              href="https://github.com/Dulaj007"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              Dulaj
            </a>
            {" · "}
            <a
              href="https://github.com/Dulaj007"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              github.com/Dulaj007
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
