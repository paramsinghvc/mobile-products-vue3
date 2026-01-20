import type { Product } from "./api";

export type SortKey = "price-asc" | "price-desc" | "title-asc" | "title-desc";

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "price-asc", label: "price - low to high" },
  { value: "price-desc", label: "price - high to low" },
  { value: "title-asc", label: "title - A to Z" },
  { value: "title-desc", label: "title - Z to A" },
];

export const DEFAULT_SORT: SortKey = "title-asc";

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === "string" && SORT_OPTIONS.some((o) => o.value === v);
}

export function sortProducts(items: Product[], sort: SortKey): Product[] {
  const copy = [...items];

  switch (sort) {
    case "price-asc":
      copy.sort((a, b) => a.price - b.price);
      return copy;
    case "price-desc":
      copy.sort((a, b) => b.price - a.price);
      return copy;
    case "title-asc":
      copy.sort((a, b) => a.title.localeCompare(b.title));
      return copy;
    case "title-desc":
      copy.sort((a, b) => b.title.localeCompare(a.title));
      return copy;
  }
}
