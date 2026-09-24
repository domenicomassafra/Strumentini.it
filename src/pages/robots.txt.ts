import type { APIRoute } from "astro";
import { buildRobotsTxt } from "../release/validation";

const fallbackSite = new URL("https://example.invalid");

export const GET: APIRoute = ({ site }) => new Response(buildRobotsTxt(site ?? fallbackSite), {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
});
