import { catalog } from "../generated/catalog";
import { groups } from "../catalog/groups";
import { canonicalDiscoveryPath, publicIndexPaths } from "./public-discovery";

// Keep the allowlist identical to the canonical index and release validator:
// an Astro-generated page is not automatically eligible for indexing.
const indexablePaths = new Set([
  ...publicIndexPaths,
  ...groups.map((group) => `/categorie/${group.slug}`),
  ...catalog.map((tool) => tool.route),
].map(canonicalDiscoveryPath));

export function isPublicSitemapUrl(value: string, site: string): boolean {
  const url = new URL(value);
  return url.origin === new URL(site).origin &&
    url.search === "" && url.hash === "" &&
    indexablePaths.has(url.pathname);
}
