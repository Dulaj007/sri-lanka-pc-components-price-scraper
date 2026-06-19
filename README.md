# Sri Lanka PC Price Comparator

A web application that searches seven Sri Lankan PC hardware stores simultaneously and presents their prices in a single, sortable table. Type a component name, hit search, and within a few seconds you get the lowest price, the highest price, warranty information where available, and a direct link to each listing — all in one place.

Every result shown is a brand-new item. Used and second-hand listings are identified and discarded before anything reaches the screen.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Dulaj007/sri-lanka-pc-components-price-scraper.git
cd sri-lanka-pc-components-price-scraper
npm install
```

### Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Type a part name — for example `RTX 5070`, `Ryzen 7 9800X3D`, or `32GB DDR5` — and press Search.

### Building for production

```bash
npm run build
npm start
```

### Deploying to Vercel

Connect the repository to a Vercel project. No environment variables or database setup is required. The framework is detected automatically as Next.js. Click Deploy.

The one thing that does not carry over to Vercel's free (Hobby) tier is the local JSON cache, because the serverless runtime has a read-only filesystem. The scrapers themselves work fine. See the Limitations section for more detail.

---

## Project Structure

```
.
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts        # API endpoint — runs all scrapers in parallel
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # The entire frontend (single client component)
├── lib/
│   ├── cache.ts                # Read/write data/cache.json
│   ├── http.ts                 # fetch wrapper with UA header, timeout, throttling
│   ├── robots.ts               # robots.txt parser
│   ├── types.ts                # Shared TypeScript interfaces
│   └── scrapers/
│       ├── index.ts            # Scraper registry
│       ├── util.ts             # Shared parsing helpers
│       ├── woocommerce.ts      # Shared loop for WooCommerce stores
│       ├── pcbuilders.ts
│       ├── techzone.ts
│       ├── gamestreet.ts
│       ├── mdcomputers.ts
│       ├── nanotek.ts
│       ├── chamacomputers.ts
│       └── barclays.ts
└── data/
    └── cache.json              # Local result cache (gitignored after first run)
```

---

## Stores Covered

| Store | URL | Backend |
|---|---|---|
| PC Builders | pcbuilders.lk | WooCommerce |
| TechZone | techzone.lk | WooCommerce (Electro theme) |
| Game Street | gamestreet.lk | Custom PHP |
| MD Computers | mdcomputers.lk | WooCommerce (custom theme) |
| Nanotek | nanotek.lk | CS-Cart style storefront |
| Chama Computers | chamacomputers.lk | Next.js |
| Barclays | barclays.lk | Classic ASP |

---

## Tech Stack

### Next.js 16 — App Router

The application uses the App Router introduced in Next.js 13 and stabilised in later versions. This means the file-based routing under `app/` where folders map directly to URL segments. The frontend page (`app/page.tsx`) is a React Client Component — it runs in the browser and owns all the interactive state. The API route (`app/api/search/route.ts`) is a Route Handler — it runs on the server (or on a serverless function in production) and never ships its code to the browser.

This split matters because the scraping logic, file system access, and HTTP calls all live in the Route Handler, which means they are never exposed to end users. The client only ever talks to `/api/search`.

### TypeScript

The entire codebase is TypeScript. The main benefit here is not just type safety in individual files — it is the ability to define the shape of a `Product` once in `lib/types.ts` and have the compiler enforce that shape across every scraper, the API route, and the UI. When a new field is added to `Product` (for example, `warranty` was added partway through development), TypeScript immediately shows every file that needs updating.

### Tailwind CSS v4

Tailwind is used for all styling. Version 4 is configured differently from v3 — there is no `tailwind.config.js`. Instead, configuration lives directly in `globals.css` using `@theme` blocks and CSS custom properties. This makes the design token layer feel more like standard CSS rather than a separate config file.

The design uses Tailwind's zinc grey palette throughout, with emerald green for in-stock badges and red for error states. Dark mode is supported via the `dark:` variant — it follows the operating system preference automatically without any JavaScript.

### Cheerio

Cheerio is a server-side HTML parsing library with a jQuery-style API. When a scraper fetches a page, it passes the raw HTML string to `cheerio.load()`, which returns a `$` function that behaves like jQuery's `$`. From there, CSS selectors like `$("ul.products li.product")` work exactly as they would in browser DevTools.

The reason for choosing Cheerio over a headless browser (Puppeteer, Playwright) is resource cost. A headless browser launches a full Chromium or Firefox instance — several hundred megabytes of binary, 1-2 seconds of startup time, significant memory per instance. Cheerio is a few kilobytes of JavaScript that parses static HTML in milliseconds. Since every store in this list renders its search results as server-side HTML (the product data is in the raw response body, not injected by JavaScript), a headless browser adds no value and only adds weight.

### Native fetch with AbortController

The Node.js runtime built into Next.js includes the browser-standard `fetch` API. Requests are made with `fetch()` directly, with an `AbortController` providing the request timeout. The controller's `signal` is passed to `fetch` as an option. When the timeout fires, `controller.abort()` is called, which causes the pending `fetch` to reject with an abort error. This is caught and reported as a site failure without affecting the other scrapers running in parallel.

No third-party HTTP library (axios, got, node-fetch) is needed.

### JSON file cache

Results are saved to `data/cache.json` after every successful search. The file is a plain JSON object keyed by the normalised query string (lowercase, trimmed). If a subsequent search returns zero results because all scrapers failed (network issue, site down, rate limiting), the API route checks the cache for the same query and returns the previous result with a `cachedAt` timestamp so the UI can display a notice.

The write is wrapped in a try/catch — failures are logged to the console but never thrown. This means the cache is a convenience, not a requirement. If the file cannot be written (for example, on Vercel's read-only filesystem), the app continues to work without it.

---

## How It Was Built

### Step 1 — Defining the data contract

Before writing any scraping code, the TypeScript interfaces were defined in `lib/types.ts`. The key interface is `Product`:

```typescript
interface Product {
  site: string;
  title: string;
  price: number;
  currency: string;
  condition: "new" | "used" | "unknown";
  url: string;
  inStock: boolean;
  warranty?: string;
}
```

Defining this first means the compiler enforces the shape everywhere. A scraper that returns a price as a string, or forgets the `inStock` field, will fail at compile time rather than silently producing malformed data at runtime.

`SiteStatus` captures whether a site succeeded and how many results it returned. `SearchResponse` is the object the API route assembles and sends to the browser — the merged results array, the per-site statuses, and an optional cache timestamp.

### Step 2 — Shared HTTP infrastructure

All HTTP requests go through `lib/http.ts` rather than calling `fetch` directly in each scraper. This gives three things for free:

**User-Agent header.** Every request identifies the project honestly:
```
sri-lanka-pc-price-comparator/0.1 (portfolio project; educational, non-commercial price comparison)
```
This is the right thing to do when scraping publicly accessible pages. Sites can see what is hitting them and block it if they choose to.

**Request timeout.** An `AbortController` is created per request with a 10-second timer. If the server does not respond in time, the request is cancelled. Without this, a single unresponsive server could block the entire search indefinitely.

**Per-host throttling.** A `Map` tracks the timestamp of the last request to each hostname. If a scraper makes two requests to the same host in quick succession (for example, when fetching a second page of results), it waits for the minimum interval to pass first. Most sites get a 1.5-second minimum delay. Two sites publish longer crawl delays in their `robots.txt` — techzone.lk requests 3 seconds, nanotek.lk requests 20 seconds — and those values are respected via a per-host override table.

`postForm()` was added alongside `fetchHtml()` for barclays.lk, whose search only accepts POST requests with form-encoded data. It shares the same throttle, timeout, and User-Agent logic as the GET path.

### Step 3 — robots.txt compliance

`lib/robots.ts` is called at the start of every scraper before any page is fetched. It downloads the site's `/robots.txt` once per process lifetime (subsequent calls hit an in-memory cache), parses the `User-agent: *` group, and applies longest-matching-path rules to determine whether the target URL is allowed.

The implementation covers the subset of the robots.txt spec that real-world files actually use: `User-agent`, `Disallow`, and `Allow` directives. Sitemap references and other fields are ignored. The default when no matching rule exists is to allow the request.

If a URL is disallowed, the scraper throws an error. The API route's per-scraper error wrapper catches this and records it as a site failure with the reason "Blocked by robots.txt". None of the seven sites currently block the search paths used here.

### Step 4 — Shared parsing utilities

`lib/scrapers/util.ts` contains four functions used across all scrapers.

**`parsePrice(text)`** was the most important one to get right. Sri Lankan stores write prices in at least five different formats: `"Rs.28,000.00"`, `"Rs. 235,000.00"`, `"LKR 16,000.00"`, `"Rs:27,000.00"`, and `"23,100.00 per unit"`. The naive approach — strip all non-digit, non-comma, non-period characters — breaks on `"Rs.28,000.00"` because the period in `"Rs."` survives the strip, leaving `".28,000.00"`, which JavaScript's `parseFloat` interprets as `0.28` instead of `28000`. The fix is to search for the number rather than the currency symbol: the regex `/\d[\d,]*(\.\d+)?/` matches a sequence that starts with a digit, which the leading `"Rs."` can never satisfy.

**`extractWarranty(title)`** uses a regex to find patterns like `"3 YEARS WARRANTY"` or `"(2y)"` in the product title and normalises them to `"3 Years"` or `"2 Years"`. Many Sri Lankan retailers embed warranty information directly in the product name rather than in a separate structured field, so title parsing is the only way to get it without loading each individual product page.

**`resolveUrl(href, base)`** wraps `new URL(href, base)` to turn relative paths like `/product/some-item` into absolute URLs. Several sites return relative hrefs in their search results.

**`looksUsed(...texts)`** checks for the word "used" as a whole word in any number of strings. It is called with both the product title and the CSS class string of the container element, since some WooCommerce stores categorise used items with class names like `product_cat-used-monitors` while others just put `"USED"` in the product title.

### Step 5 — The scraper modules

Each scraper is a TypeScript module that exports two things: a `SITE` constant (the hostname) and an async `search(query)` function that returns `Product[]`. The function is responsible for everything specific to that store — building the search URL, fetching the page, parsing the HTML, and mapping the results to the `Product` interface.

**WooCommerce stores (pcbuilders.lk, techzone.lk, mdcomputers.lk).** All three use WooCommerce's built-in search: `/?s=<query>&post_type=product`. The results page uses the same `ul.products li.product` structure on all three sites. A shared `searchWooCommerceStore()` function in `lib/scrapers/woocommerce.ts` handles the common loop. The only thing the individual site modules supply is a `getTitleAndUrl()` function, because the two different WooCommerce themes used by these stores place the title and product link differently in the markup — one wraps the `<h3>` inside an `<a>`, the other puts the `<a>` inside the `<h3>`.

**gamestreet.lk.** A custom PHP storefront. Search is a GET request to `search.php?searchText=<query>`. Product cards are `div.product_content` elements. The price is in a `.redPrice` element in `"Rs.28,000.00"` format, which the `parsePrice` fix handles correctly.

**nanotek.lk.** A CS-Cart style storefront. Search is a GET to `/search?q=<query>`. Product cards are `li.ty-catPage-productListItem` elements. Stock status is a text element that reads `"In Stock"`, `"In Stock - Colombo 3"`, or `"Out of Stock"`, so `inStock` is set by checking whether the string starts with `"In Stock"`.

**chamacomputers.lk.** A Next.js storefront that does full server-side rendering of search results, so the product data is available in the plain HTML response. Cards are `<a href="/products/...">` anchor elements. Navigation links also start with `/products/` so the selector is filtered down to only anchors that contain a price element (`p.font-semibold`) inside them.

**barclays.lk.** A classic ASP site from the early 2000s era. Its search does not accept query strings — results only come back through a POST form submission. The request is sent with `postForm()` to `searchresult.asp` with the search term in a `SearchWord` field. The result structure is a standard product grid: `ul.products-grid li.item` containers with `.item-title a` for the title and `.regular-price .price` for the price text.

### Step 6 — The scraper registry

`lib/scrapers/index.ts` holds a single exported array:

```typescript
export const scrapers: SiteScraper[] = [
  { site: pcbuilders.SITE, search: pcbuilders.search },
  { site: techzone.SITE, search: techzone.search },
  // ...
];
```

The API route imports this array and iterates over it. Adding a new store means writing a scraper module and adding one line to this array. Nothing else in the codebase needs to change.

### Step 7 — The API route

`app/api/search/route.ts` is the orchestration layer. When a GET request arrives with a `?q=` parameter, it:

1. Calls every scraper in the registry in parallel using `Promise.all()`.
2. Wraps each scraper call in a race against an 8-second timeout using `Promise.race()`. If the scraper does not finish in time, the timeout wins, the error is caught, and the site is recorded as failed — it does not cause the whole `Promise.all` to reject.
3. Merges all successful results into a single array and sorts by price ascending.
4. If the merged array is empty (all scrapers failed), looks up the query in the JSON cache and returns the cached response if one exists, with the current (failed) site statuses so the user knows the data is stale.
5. Otherwise, writes the new results to the cache and returns the fresh response.

Running all scrapers in parallel is what makes the response time reasonable. A sequential approach would add up to over a minute across seven sites. In parallel, the response arrives in roughly the time the slowest single site takes to respond — typically 3 to 6 seconds.

### Step 8 — The frontend

The entire UI is a single React Client Component in `app/page.tsx`. It uses three pieces of state: the current query string, a loading flag, and the last `SearchResponse` received from the API. `useState` manages all three.

When the form is submitted, a `fetch` call is made to `/api/search?q=<query>`. While that is pending, the loading flag shows a spinner. When the response arrives, the results state is set and React re-renders the page.

The results are sorted client-side independently of the API sort order, so toggling between cheapest-first and most-expensive-first does not require a new API call.

The **Save as JSON** button constructs a `Blob` from the current `SearchResponse`, calls `URL.createObjectURL()` to get a temporary URL for it, creates an invisible `<a>` element pointing at that URL with a `download` attribute, programmatically clicks it, and then calls `URL.revokeObjectURL()` to release the memory. The entire download happens in the browser — no server request is made.

---

## How to Add a New Store

1. Save the store's search results page HTML and inspect it with browser DevTools to identify the CSS selectors for the product container, title, URL, price, and stock status.

2. Create `lib/scrapers/<sitename>.ts` and implement the `search()` function:

```typescript
import * as cheerio from "cheerio";
import { fetchHtml } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice, resolveUrl } from "./util";

export const SITE = "example.lk";

export async function search(query: string): Promise<Product[]> {
  const url = `https://example.lk/search?q=${encodeURIComponent(query)}`;

  if (!(await isAllowedByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const products: Product[] = [];

  $(".product-card").each((_, el) => {
    const card = $(el);
    const title = card.find(".product-title").text().trim();
    const href = card.find("a").attr("href");
    if (!title || !href) return;

    if (looksUsed(title)) return;

    const price = parsePrice(card.find(".price").text());
    if (price === null || price <= 0) return;

    products.push({
      site: SITE,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: resolveUrl(href, "https://example.lk"),
      inStock: true,
      warranty: extractWarranty(title),
    });
  });

  return products;
}
```

3. Register it in `lib/scrapers/index.ts`:

```typescript
import * as example from "./example";

export const scrapers: SiteScraper[] = [
  // existing entries...
  { site: example.SITE, search: example.search },
];
```

The parallel execution, timeout handling, cache, and UI all pick it up automatically.

---

## Ethical Considerations

This project fetches publicly accessible search result pages — the same pages a regular visitor would see in a browser. No authentication is bypassed, no private APIs are called, and no personal data is collected.

The following practices are built in as first-class requirements, not afterthoughts:

- robots.txt is parsed and respected before every scrape
- A descriptive, honest User-Agent header is sent with every request
- Per-host request delays are applied based on each site's published Crawl-delay directive
- Hard timeouts prevent any single site from being hammered with retries
- The project is non-commercial and identifies itself as such in the User-Agent string

---

## Known Limitations

**JavaScript-rendered content.** The scraper uses `fetch` plus HTML parsing. Stores that load their product listings via client-side JavaScript after the initial page load are not supported. All seven stores currently covered render their search results as part of the server response.

**Search relevance.** The results shown are whatever each store's own search algorithm returns. Broad queries produce broad results — searching for "ram" will match any product title containing those letters, including monitors with "Frameless" in the name (which contains the substring "ram"). There is no re-ranking or filtering by relevance on this side.

**Warranty extraction.** Warranty is detected from the product title text using pattern matching. It handles the common Sri Lankan retail formats well (`"3 YEARS WARRANTY"`, `"(2y)"`, `"10 Years Warranty"`) but will miss warranties that are only mentioned in the product description body, which would require loading each individual product page.

**Stock status accuracy.** gamestreet.lk does not display stock status on its search results page. Items from that store default to showing as in stock.

**Vercel free tier cache.** The serverless functions on Vercel's Hobby plan run on a read-only filesystem. Cache writes fail silently and the fallback to cached results when all scrapers fail does not apply. The live scraping works normally.

**Repeat searches and crawl delays.** nanotek.lk specifies a 20-second crawl delay in its robots.txt. A second search sent within 20 seconds of the first will cause nanotek's scraper to time out because the rate limiter holds the request past the 8-second function timeout. The other six stores will still return results normally.
