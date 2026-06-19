import type { Product } from "../types";
import { searchWooCommerceStore } from "./woocommerce";

export const SITE = "pcbuilders.lk";

export async function search(query: string): Promise<Product[]> {
  return searchWooCommerceStore(query, {
    site: SITE,
    searchUrl: (q) => `https://pcbuilders.lk/?s=${encodeURIComponent(q)}&post_type=product`,
    // This theme wraps the whole card (image, title, price) in one link,
    // so the title text lives in its own element but the link is found
    // by its class instead of by nesting.
    getTitleAndUrl: (card) => {
      const title = card.find(".woocommerce-loop-product__title").first().text().trim();
      const href = card.find("a.woocommerce-loop-product__link").first().attr("href");
      if (!title || !href) return null;
      return { title, href };
    },
  });
}
