export type ToolIconKey =
  | "archive"
  | "calculator"
  | "calendar"
  | "chart"
  | "code"
  | "compare"
  | "document"
  | "file"
  | "folder"
  | "hash"
  | "image"
  | "link"
  | "list"
  | "palette"
  | "qr"
  | "research"
  | "shield"
  | "table"
  | "text"
  | "time";

export interface ToolIconInput {
  readonly id: string;
  readonly category: string;
}

const CATEGORY_ICONS: Readonly<Record<string, ToolIconKey>> = {
  "business-math": "calculator",
  "client-work-math": "calculator",
  data: "table",
  "date-time": "calendar",
  developer: "code",
  documents: "document",
  files: "file",
  "files-assets": "image",
  "image-visual": "palette",
  marketing: "chart",
  research: "research",
  text: "text",
  "web-operations": "link",
};

const ID_RULES: ReadonlyArray<readonly [RegExp, ToolIconKey]> = [
  [/\b(?:zip|archive)\b/u, "archive"],
  [/(?:checksum|hash|hmac)/u, "hash"],
  [/(?:calendar|date|day|deadline|week|quarter|anniversary|holiday|ics)/u, "calendar"],
  [/(?:time|timezone|epoch|hours|timesheet|duration)/u, "time"],
  [/(?:pdf|document)/u, "document"],
  [/(?:folder)/u, "folder"],
  [/(?:file|filename)/u, "file"],
  [/(?:image|screenshot|favicon|exif|aspect-ratio)/u, "image"],
  [/(?:color|palette|contrast)/u, "palette"],
  [/(?:csv|tsv|table|column|row|pivot|delimiter|missing-value)/u, "table"],
  [/(?:qr)/u, "qr"],
  [/(?:url|domain|utm|redirect|robots|open-graph|meta-preview|query-string|email-domain|tracking-cleaner)/u, "link"],
  [/(?:json|yaml|toml|jwt|regex|cron|uuid|base64|html-entity|user-agent|mime-type)/u, "code"],
  [/(?:compare|comparison|diff|duplicate|dedupe|intersection|difference)/u, "compare"],
  [/(?:sort|list|inventory|manifest|index-generator)/u, "list"],
  [/(?:citation|bibtex|isbn|doi|research|evidence|reference|timeline|reading-list|vocabulary)/u, "research"],
  [/(?:secret|safe-share|metadata-risk|signature-detector)/u, "shield"],
  [/(?:chart|conversion-rate|roas|cpa|cpc|cpm|campaign)/u, "chart"],
  [/(?:rate|margin|markup|profit|budget|invoice|percentage|interest|discount|capacity|utilization|break-even|fee|income|currency)/u, "calculator"],
  [/(?:text|word|character|quote|slug|unicode|whitespace|markdown|case-converter|find-replace|line-)/u, "text"],
];

const ICON_BODY: Readonly<Record<ToolIconKey, string>> = {
  archive: '<path d="M3 4.5h10v8H3z"/><path d="M2.5 2.5h11v2h-11zM6 7.5h4"/>',
  calculator: '<rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M5.5 5.5h5M5.5 8.5h1M8 8.5h1M10.5 8.5h1M5.5 11h1M8 11h1M10.5 11h1"/>',
  calendar: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5 2v3M11 2v3M2.5 6.5h11M5 9h2M9 9h2M5 11h2"/>',
  chart: '<path d="M2.5 13.5h11M4 11V7.5M8 11V4.5M12 11V2.5"/>',
  code: '<path d="M6 4 2.5 8 6 12M10 4l3.5 4-3.5 4M9 2.5 7 13.5"/>',
  compare: '<path d="M2.5 5h8M8.5 3l2 2-2 2M13.5 11h-8M7.5 9l-2 2 2 2"/>',
  document: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3M6 8h4M6 10.5h4"/>',
  file: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/>',
  folder: '<path d="M2.5 5h4l1-1.5h6v9h-11z"/>',
  hash: '<path d="M5.5 2.5 4.5 13.5M10.5 2.5 9.5 13.5M2.5 6h11M2 10h11"/>',
  image: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1"/><path d="m4 11 2.5-2.5 1.7 1.7 1.3-1.3L12 11"/>',
  link: '<path d="M6.3 9.7 4.8 11.2a2.3 2.3 0 0 1-3.3-3.3l2-2a2.3 2.3 0 0 1 3.3 0M9.7 6.3l1.5-1.5a2.3 2.3 0 0 1 3.3 3.3l-2 2a2.3 2.3 0 0 1-3.3 0M5.5 10.5l5-5"/>',
  list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1"/>',
  palette: '<path d="M8 2.5a5.5 5.5 0 1 0 0 11h1.1a1.2 1.2 0 0 0 .5-2.3c-.6-.3-.4-1.2.3-1.2h1.2A2.9 2.9 0 0 0 14 7.1 5.5 5.5 0 0 0 8 2.5Z"/><circle cx="5.2" cy="6" r=".6"/><circle cx="7.5" cy="4.8" r=".6"/><circle cx="10.2" cy="5.4" r=".6"/>',
  qr: '<path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h1.5v1.5H9.5zM12 9.5h1.5V13H12zM9.5 12h1.5v1.5H9.5z"/>',
  research: '<circle cx="7" cy="7" r="4"/><path d="m10 10 3.5 3.5M5.5 5.5h3M5.5 7.5h2"/>',
  shield: '<path d="M8 2.5 13 4v3.6c0 3.1-2 5.1-5 6.4-3-1.3-5-3.3-5-6.4V4z"/><path d="m5.7 8 1.4 1.4 3.2-3.2"/>',
  table: '<rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M6 3v10M10 3v10"/>',
  text: '<path d="M3 3.5h10M8 3.5v9M5.5 12.5h5"/>',
  time: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.5V8l2.5 1.5"/>',
};

export function categoryIconKey(category: string): ToolIconKey {
  return CATEGORY_ICONS[category] ?? "list";
}

export function toolIconKey(tool: ToolIconInput): ToolIconKey {
  const id = tool.id.toLocaleLowerCase("en-US");
  for (const [pattern, key] of ID_RULES) if (pattern.test(id)) return key;
  return categoryIconKey(tool.category);
}

function safeClassName(value: string): string {
  return /^[a-z0-9 _-]+$/iu.test(value) ? value : "tool-icon";
}

export function iconSvgMarkup(key: ToolIconKey, className = "tool-icon"): string {
  const cssClass = safeClassName(className);
  return `<svg class="${cssClass}" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_BODY[key]}</svg>`;
}

export function toolIconSvg(tool: ToolIconInput, className = "tool-icon"): string {
  return iconSvgMarkup(toolIconKey(tool), className);
}

export function categoryIconSvg(category: string, className = "category-icon"): string {
  return iconSvgMarkup(categoryIconKey(category), className);
}
