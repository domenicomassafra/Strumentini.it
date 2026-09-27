import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

if (!await exists(dist)) {
  throw new Error("dist/ is missing; run npm run build before the portable deployment check");
}

const required = [
  "index.html",
  "404.html",
  "library/index.html",
  "onboarding/index.html",
  "robots.txt",
  "sitemap.xml",
];
for (const file of required) {
  if (!await exists(join(dist, file))) throw new Error(`portable static check: missing dist/${file}`);
}

const files = await walk(dist);
const relativeFiles = files.map((path) => relative(dist, path).replaceAll("\\", "/"));
const forbiddenRuntimeArtifacts = relativeFiles.filter((path) =>
  path === "_worker.js" || path.startsWith("functions/") || path.startsWith(".netlify/functions/"),
);
if (forbiddenRuntimeArtifacts.length > 0) {
  throw new Error(`portable static check: server-runtime artifacts found: ${forbiddenRuntimeArtifacts.join(", ")}`);
}

const textExtensions = new Set([".html", ".js", ".css", ".json", ".xml", ".txt"]);
const forbiddenText = [
  /https?:\/\/[^\s"']*\.workers\.dev\b/iu,
  /https?:\/\/[^\s"']*\.pages\.dev\b/iu,
  /https?:\/\/example\.invalid\b/iu,
  /\/Users\/domenico\/Code\//u,
];
for (const path of files) {
  if (!textExtensions.has(extname(path))) continue;
  const source = await readFile(path, "utf8");
  for (const pattern of forbiddenText) {
    if (pattern.test(source)) {
      throw new Error(`portable static check: provider/dev-only reference ${pattern} found in dist/${relative(dist, path)}`);
    }
  }
}

const home = await readFile(join(dist, "index.html"), "utf8");
if (!home.includes('href="https://strumentiutili.it/"')) {
  throw new Error("portable static check: production canonical origin is missing from dist/index.html");
}

console.log(`portable static check PASS: ${relativeFiles.length} files, no server runtime, no provider-only origin dependency`);
