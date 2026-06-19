import type { Product } from "../types";
import { searchWooCommerceStore } from "./woocommerce";

export const SITE = "techzone.lk";

export async function search(query: string): Promise<Product[]> {
  return searchWooCommerceStore(query, {
    site: SITE,
    searchUrl: (q) => `https://techzone.lk/?s=${encodeURIComponent(q)}&post_type=product`,
    getTitleAndUrl: (card) => {
      const title = card.find(".woocommerce-loop-product__title").first().text().trim();
      const href = card.find("a.woocommerce-loop-product__link").first().attr("href");
      if (!title || !href) return null;
      return { title, href };
    },
  });
}
