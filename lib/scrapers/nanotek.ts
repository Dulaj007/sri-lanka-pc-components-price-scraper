import * as cheerio from "cheerio";

import { fetchHtml } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice } from "./util";

export const SITE = "nanotek.lk";

const BASE_URL = "https://www.nanotek.lk";

// nanotek.lk runs on a CS-Cart style storefront rather than WordPress.
// Its search page takes the query in a "q" parameter and lists results as
// <li class="ty-catPage-productListItem"> cards.
export async function search(query: string): Promise<Product[]> {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

  if (!(await isAllowedByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const products: Product[] = [];

  $("li.ty-catPage-productListItem").each((_, element) => {
    const card = $(element);

    const href = card.find("a").first().attr("href");
    const title = card.find(".ty-productBlock-title").first().text().trim();
    if (!title || !href) return;

    if (looksUsed(title)) return;

    const priceText = card.find(".ty-productBlock-price-retail").first().text();
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;

    const stockText = card.find(".ty-productBlock-specialMsg").first().text().trim();

    products.push({
      site: SITE,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: href,
      inStock: /in stock/i.test(stockText),
      warranty: extractWarranty(title),
    });
  });

  return products;
}
