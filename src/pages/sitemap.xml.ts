import type { APIRoute } from "astro";
import { catalog } from "../generated/catalog";
import { groups } from "../catalog/groups";
import { buildSitemapXml } from "../seo/public-discovery";

export const prerender = true;

/** The ten public category pages are indexable destinations of their own. */
const categoryPaths = groups.map((group) => `/categorie/${group.slug}`);

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.href;
  return new Response(buildSitemapXml(catalog, siteUrl, categoryPaths), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
