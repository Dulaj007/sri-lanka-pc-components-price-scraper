import type { Product } from "../types";
import { searchWooCommerceStore } from "./woocommerce";

export const SITE = "mdcomputers.lk";

export async function search(query: string): Promise<Product[]> {
  return searchWooCommerceStore(query, {
    site: SITE,
    searchUrl: (q) => `https://mdcomputers.lk/?s=${encodeURIComponent(q)}&post_type=product`,
    // This theme puts the link *inside* the title element, the other
    // way around from pcbuilders/techzone.
    getTitleAndUrl: (card) => {
      const link = card.find(".woo-loop-product__title a").first();
      const title = link.text().trim();
      const href = link.attr("href");
      if (!title || !href) return null;
      return { title, href };
    },
  });
}
