import * as cheerio from "cheerio";

import { fetchHtml } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice, resolveUrl } from "./util";

export const SITE = "gamestreet.lk";

const BASE_URL = "https://gamestreet.lk";

// gamestreet.lk isn't WordPress - it's a custom PHP storefront with its
// own search page that takes the query in a "searchText" parameter.
export async function search(query: string): Promise<Product[]> {
  const url = `${BASE_URL}/search.php?searchText=${encodeURIComponent(query)}`;

  if (!(await isAllowedByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const products: Product[] = [];

  $(".product_content").each((_, element) => {
    const card = $(element);

    const link = card.find(".product_title a").first();
    const title = link.text().trim();
    const href = link.attr("href");
    if (!title || !href) return;

    if (looksUsed(title)) return;

    const priceText = card.find(".redPrice").first().text();
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;

    products.push({
      site: SITE,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: resolveUrl(href, BASE_URL),
      // gamestreet doesn't show stock status on the search page, so we
      // assume listed items are in stock.
      inStock: true,
      warranty: extractWarranty(title),
    });
  });

  return products;
}
