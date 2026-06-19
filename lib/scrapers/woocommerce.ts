import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import { fetchHtml } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice } from "./util";

// pcbuilders.lk, techzone.lk and mdcomputers.lk are all built on
// WooCommerce. Its built-in search (?s=<query>&post_type=product) returns
// the same product grid markup as browsing the shop, so all three sites
// share this loop - only the search URL and the way each theme marks up
// the product title/link differ.

export interface WooCommerceSite {
  site: string;
  searchUrl: (query: string) => string;
  // Different themes nest the title and link differently (e.g. the title
  // text inside a link, or a link wrapping the title), so each site
  // supplies its own way of pulling both out of a product card.
  getTitleAndUrl: (
    card: cheerio.Cheerio<AnyNode>,
  ) => { title: string; href: string } | null;
}

export async function searchWooCommerceStore(
  query: string,
  site: WooCommerceSite,
): Promise<Product[]> {
  const url = site.searchUrl(query);

  if (!(await isAllowedByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const products: Product[] = [];

  $("ul.products li.product").each((_, element) => {
    const card = $(element);
    const classes = card.attr("class") ?? "";

    // This comparator only reports brand-new prices. WooCommerce stores
    // here keep used hardware in "used-*" categories, so skip those
    // listings entirely rather than mixing them in with new stock.
    if (looksUsed(classes)) return;

    const titleAndUrl = site.getTitleAndUrl(card);
    if (!titleAndUrl) return;
    const { title, href } = titleAndUrl;

    if (looksUsed(title)) return;

    const priceText = card.find(".price .woocommerce-Price-amount").first().text();
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;

    products.push({
      site: site.site,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: href,
      inStock: !classes.includes("outofstock"),
      warranty: extractWarranty(title),
    });
  });

  return products;
}
