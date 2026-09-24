import type { APIRoute } from "astro";
import { catalog } from "../generated/catalog";
import { buildSitemapXml } from "../release/validation";

const fallbackSite = new URL("https://example.invalid");

export const GET: APIRoute = ({ site }) => {
  const routes = ["/", "/library/", ...catalog.map((tool) => tool.route)];
  return new Response(buildSitemapXml(site ?? fallbackSite, routes), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
