import * as cheerio from "cheerio";

import { postForm } from "../http";
import { isAllowedByRobots } from "../robots";
import type { Product } from "../types";
import { extractWarranty, looksUsed, parsePrice } from "./util";

export const SITE = "barclays.lk";

const SEARCH_URL = "https://www.barclays.lk/searchresult.asp";

// barclays.lk is an older ASP site with no query-string search - the
// search form submits as a POST instead.
export async function search(query: string): Promise<Product[]> {
  if (!(await isAllowedByRobots(SEARCH_URL))) {
    throw new Error("Blocked by robots.txt");
  }

  const html = await postForm(SEARCH_URL, {
    SearchWord: query,
    FrmSearchWords: "",
    hidSearchStringType: "2",
    from: "",
  });

  const $ = cheerio.load(html);
  const products: Product[] = [];

  $("ul.products-grid li.item").each((_, element) => {
    const card = $(element);

    const link = card.find(".item-title a").first();
    const title = link.text().trim();
    const href = link.attr("href");
    if (!title || !href) return;

    if (looksUsed(title)) return;

    const priceText = card.find(".item-price .price-box .regular-price .price").first().text();
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;

    products.push({
      site: SITE,
      title,
      price,
      currency: "LKR",
      condition: "new",
      url: href,
      inStock: card.find(".availability").first().hasClass("in-stock"),
      warranty: extractWarranty(title),
    });
  });

  return products;
}
