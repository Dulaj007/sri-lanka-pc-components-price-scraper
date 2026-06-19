// Small helpers shared by every per-site scraper. Keeping this logic in
// one place means each scraper file can stay focused on "where do I find
// the title/price/stock on this particular site" instead of repeating
// the same string-cleanup code seven times.

// Turns a messy price string into a plain number.
//
// Sri Lankan stores write prices in all sorts of ways:
//   "Rs. 235,000.00"
//   "Rs.28,000.00"   <- note the "." straight after "Rs": stripping
//                        currency symbols first would leave ".28,000.00"
//                        and misread that as 0.28
//   "LKR 16,000.00"
//   "Rs:27,000.00"
//   "23,100.00 per unit"
//   "205,000 LKR" (with non-breaking spaces around the number)
//
// Instead of stripping currency symbols and hoping what's left is a
// number, we search for the number itself: a run of digits, optionally
// grouped with commas, optionally followed by a decimal portion. The
// match always starts at a digit, so a leading "Rs." can't be mistaken
// for part of the number.
export function parsePrice(text: string): number | null {
  const match = text.match(/\d[\d,]*(\.\d+)?/);
  if (!match) return null;

  const withoutThousands = match[0].replace(/,/g, "");
  const value = Number.parseFloat(withoutThousands);

  return Number.isFinite(value) ? value : null;
}

// Many listings mention a warranty period right in the product title, e.g.
//   "Kingston Fury Beast 16GB DDR4 (2 YEARS WARRANTY)"
//   "Access Point Bdcom Wap2100-T512 (2y)"
// This pulls that out and normalises it to something like "2 Years".
const WARRANTY_KEYWORD = /warranty/i;

export function extractWarranty(title: string): string | undefined {
  // Only treat short "(2y)"-style suffixes as a warranty if the word
  // "warranty" doesn't appear anywhere - otherwise we rely on the full
  // "<number> <unit> warranty" match below.
  const fullMatch = title.match(/(\d+)\s*[- ]?\s*(year|yr|month|mo)s?\.?\s*warranty/i);
  const shortMatch = !WARRANTY_KEYWORD.test(title)
    ? title.match(/\((\d+)\s*(y|yr|m|mo)\)/i)
    : null;

  const match = fullMatch ?? shortMatch;
  if (!match) return undefined;

  const amount = match[1];
  const unitLetter = match[2].toLowerCase().charAt(0);
  const unit = unitLetter === "y" ? "Year" : "Month";
  const plural = amount === "1" ? "" : "s";

  return `${amount} ${unit}${plural}`;
}

// Turns a relative URL like "/products/some-item" into an absolute one
// using the site's base URL. Falls back to the original string if the
// URL can't be parsed for some reason.
export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// Checks a product title/category text for words that mark a listing as
// second-hand. The whole point of this comparator is "brand new market
// prices", so any scraper that finds one of these markers should drop the
// listing entirely.
const USED_PATTERN = /\bused\b/i;

export function looksUsed(...texts: (string | undefined)[]): boolean {
  return texts.some((text) => text && USED_PATTERN.test(text));
}
