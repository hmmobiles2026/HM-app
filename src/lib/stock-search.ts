/**
 * Stock search matching and ranking. No Prisma import — the where-fragment it builds
 * is a plain object, so this stays testable and safe to import anywhere.
 *
 * Replaces a single `contains` of the whole query against each field, which meant a
 * two-word search like "iphone 17" matched nothing (brand and model are separate
 * columns), and alphabetical ordering with a hard cap of 10, which silently hid
 * Samsung A06 from a search for "6".
 */

/** Words the searcher typed. Capped so a pasted paragraph can't build a huge query. */
export function searchTokens(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One word matching any field a person would reasonably search by. */
export function tokenFilter(t: string) {
  return {
    OR: [
      { brand: { name: { contains: t, mode: "insensitive" as const } } },
      { model: { name: { contains: t, mode: "insensitive" as const } } },
      { name: { contains: t, mode: "insensitive" as const } },
      { partBrand: { name: { contains: t, mode: "insensitive" as const } } },
      { tags: { has: t.toLowerCase() } },
    ],
  };
}

export type SearchableProduct = {
  name: string;
  stockQty: number;
  brand: { name: string };
  model: { name: string } | null;
  partBrand: { name: string } | null;
};

/**
 * How well a product answers the query. Ordering used to be alphabetical, so "6"
 * returned Honor and Huawei parts and pushed Samsung A06 past the cut-off entirely —
 * it looked like the part wasn't in stock at all.
 */
export function relevance(p: SearchableProduct, query: string, tokens: string[]): number {
  const brand = p.brand.name.toLowerCase();
  const model = (p.model?.name ?? "").toLowerCase();
  const part = p.name.toLowerCase();
  const partBrand = (p.partBrand?.name ?? "").toLowerCase();
  const haystack = `${brand} ${model} ${part} ${partBrand}`.replace(/\s+/g, " ").trim();
  const q = query.trim().toLowerCase();

  let score = 0;
  if (model && model === q) score += 120;
  if (`${brand} ${model}`.trim() === q) score += 100;
  if (haystack.startsWith(q)) score += 40;
  else if (haystack.includes(q)) score += 20;

  for (const t of tokens) {
    const lt = t.toLowerCase();
    if (model === lt || brand === lt) score += 35;
    else if (new RegExp(`\\b${escapeRegex(lt)}`, "i").test(haystack)) score += 15;
    else score += 4;
  }

  // A part actually on the shelf is the more useful answer.
  if (p.stockQty > 0) score += 8;
  return score;
}

/** Ranked best-first, then by stock, then alphabetically for a stable order. */
export function rankProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
  tokens: string[]
): T[] {
  return [...products].sort((a, b) => {
    const diff = relevance(b, query, tokens) - relevance(a, query, tokens);
    if (diff !== 0) return diff;
    if (b.stockQty !== a.stockQty) return b.stockQty - a.stockQty;
    return a.brand.name.localeCompare(b.brand.name) || a.name.localeCompare(b.name);
  });
}

/** Never fetch an unbounded set, however loose the query. */
export const SEARCH_SCAN = 80;

/** Hard ceiling on results, so a one-letter search can't dump the catalogue. */
export const SEARCH_MAX = 30;

/**
 * Telegram rejects messages over 4096 characters. A fixed result count was the wrong
 * limit — 12 was too few for "6" (20 real matches, Samsung A06 fell off) yet could
 * still overflow for long product names. Fit to the space instead.
 */
export function fitCount(lines: string[], budget = 3400): number {
  let used = 0;
  for (let i = 0; i < lines.length && i < SEARCH_MAX; i++) {
    used += lines[i].length + 2; // blank line between entries
    if (used > budget) return i;
  }
  return Math.min(lines.length, SEARCH_MAX);
}
