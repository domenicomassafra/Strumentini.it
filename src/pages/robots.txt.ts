import type { APIRoute } from "astro";
import { buildRobotsTxt } from "../seo/public-discovery";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.href;
  return new Response(buildRobotsTxt(siteUrl), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
