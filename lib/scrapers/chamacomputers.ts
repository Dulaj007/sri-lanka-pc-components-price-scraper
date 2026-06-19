import * as cheerio from "cheerio";

import { fetchHtml } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice, resolveUrl } from "./util";

export const SITE = "chamacomputers.lk";

const BASE_URL = "https://www.chamacomputers.lk";

// chamacomputers.lk is a Next.js storefront. Its search page renders
// product cards as plain server-side HTML, each one a link to
// "/products/<category>/<slug>" that contains the title and price.
export async function search(query: string): Promise<Product[]> {
  const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}`;

  if (!(await isAllowedByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const products: Product[] = [];

  $('a[href^="/products/"]').each((_, element) => {
    const card = $(element);

    // Plain category/navigation links also start with "/products/" but
    // don't have a price - only treat elements with a price as cards.
    const priceEl = card.find("h2 p.font-semibold").first();
    if (priceEl.length === 0) return;

    const title = card.find("p.line-clamp-3").first().text().trim();
    const href = card.attr("href");
    if (!title || !href) return;

    if (looksUsed(title)) return;

    const price = parsePrice(priceEl.text());
    if (price === null || price <= 0) return;

    const stockText = card.find("div.absolute div").first().text().trim();

    products.push({
      site: SITE,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: resolveUrl(href, BASE_URL),
      inStock: /in stock/i.test(stockText),
      warranty: extractWarranty(title),
    });
  });

  return products;
}
