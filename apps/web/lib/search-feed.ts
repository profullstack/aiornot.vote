import type { ListSort } from "./queries";

export type SearchMediaType = "image" | "video";

const SORTS: ListSort[] = ["newest", "trending", "hardest", "most_guessed", "featured"];

export function normalizeSearchSort(value: string | null | undefined): ListSort {
  return SORTS.includes(value as ListSort) ? (value as ListSort) : "newest";
}

export function normalizeSearchMediaType(value: string | null | undefined): SearchMediaType | undefined {
  return value === "image" || value === "video" ? value : undefined;
}

export function searchFeedParams(filters: {
  q?: string;
  tag?: string;
  mediaType?: SearchMediaType;
  sort?: ListSort;
  featuredOnly?: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.mediaType) params.set("media_type", filters.mediaType);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.featuredOnly) params.set("featured", "1");
  return params;
}

export function searchPagePathFromParams(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
