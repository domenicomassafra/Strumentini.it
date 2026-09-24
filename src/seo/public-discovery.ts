import type { ToolSummary } from "../catalog/manifest";

export type DiscoveryTool = Pick<ToolSummary, "route" | "name" | "summary" | "category">;

const GENERIC_DESCRIPTION = "runs locally in your browser with bounded inputs and explicit results.";
const BRAND = "UtilityOS";

function normalizedSiteUrl(siteUrl: string | URL | undefined): string | undefined {
  if (siteUrl === undefined) return undefined;
  const value = siteUrl.toString().trim();
  if (value === "") return undefined;
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeDiscoveryPath(pathname: string): string {
  const path = pathname.split(/[?#]/u, 1)[0] ?? "/";
  const absolute = path.startsWith("/") ? path : `/${path}`;
  return absolute.length > 1 ? absolute.replace(/\/+$/u, "") : absolute;
}

export function resolveDiscoveryUrl(pathname: string, siteUrl?: string | URL): string {
  const path = normalizeDiscoveryPath(pathname);
  const base = normalizedSiteUrl(siteUrl);
  return base === undefined ? path : new URL(path, base).href;
}

export function formatPageTitle(title: string): string {
  const value = title.trim();
  if (value === "" || value.toLocaleLowerCase("en").includes(BRAND.toLocaleLowerCase("en"))) return value || BRAND;
  return `${value} · ${BRAND}`;
}

export function selectPageDescription(description: string, tool?: DiscoveryTool): string {
  const value = description.trim();
  if (tool === undefined || value === "") return tool?.summary ?? value;
  const generic = `${tool.name} ${GENERIC_DESCRIPTION}`;
  return value === generic ? tool.summary : value;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export function buildSitemapXml(tools: readonly DiscoveryTool[], siteUrl?: string | URL): string {
  const paths = [...new Set(["/", "/library", ...tools.map((tool) => tool.route)])];
  const entries = paths.map((path) => `  <url><loc>${escapeXml(resolveDiscoveryUrl(path, siteUrl))}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildRobotsTxt(siteUrl?: string | URL): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${resolveDiscoveryUrl("/sitemap.xml", siteUrl)}\n`;
}

export function buildToolStructuredData(tool: DiscoveryTool, canonicalUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.summary,
    url: canonicalUrl,
    applicationCategory: tool.category,
    operatingSystem: "Web",
  };
}

export function buildLibraryStructuredData(
  tools: readonly DiscoveryTool[],
  canonicalUrl: string,
  siteUrl?: string | URL,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "UtilityOS Tool Library",
    description: "Search deterministic local tools by task, input, category, and runtime.",
    url: canonicalUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: tools.length,
      itemListElement: tools.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: resolveDiscoveryUrl(tool.route, siteUrl),
      })),
    },
  };
}

export function buildWebsiteStructuredData(canonicalUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: canonicalUrl,
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
