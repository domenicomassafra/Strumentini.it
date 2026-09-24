import type { APIRoute } from "astro";
import { catalog } from "../generated/catalog";
import { buildSitemapXml } from "../seo/public-discovery";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.href;
  return new Response(buildSitemapXml(catalog, siteUrl), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
