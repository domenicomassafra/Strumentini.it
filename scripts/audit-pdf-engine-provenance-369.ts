/**
 * #369: read-only, execution-backed PDF dependency provenance audit.
 * Local content hashes do NOT authenticate an upstream tarball or license.
 * Run: npx tsx scripts/audit-pdf-engine-provenance-369.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export interface PdfAsset369 { readonly path: string; readonly bytes: number; readonly sha256: string }
export interface PdfInspection369 {
  readonly identity: { readonly packageName: "pdfjs-dist"; readonly version: string; readonly declaredLicense: "Apache-2.0" };
  readonly integrity: { readonly lockAndInstallAgree: true; readonly lockResolution: string; readonly lockIntegrity: string; readonly tarballSha512Attested: false };
  readonly imports: { readonly files: number; readonly remoteCount: 0 };
  readonly assets: readonly PdfAsset369[];
  readonly licenseNotices: readonly PdfAsset369[];
  readonly limitations: readonly string[];
}
export interface PdfComparison369 {
  readonly engine: "in-house PDF parser/writer" | "Mozilla PDF.js" | "MuPDF" | "macOS PDFKit";
  readonly installed: boolean;
  readonly licenseGate: string;
  readonly source: string;
  readonly capabilities: readonly string[];
  readonly browserBundle: string;
  readonly mobileEvidence: "NOT_RUN";
}
export interface PdfAudit369 {
  readonly inspection: PdfInspection369;
  readonly probe: { readonly fixturePageCount: number; readonly extractedText: string; readonly fixtureSha256: string };
  readonly comparison: readonly PdfComparison369[];
  readonly adoption: "NO_ADOPT_NO_GOLD";
}
function refuse(message: string): never { throw Error("PDF369_NO_GO: " + message); }
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function safeFile(root: string, local: string): string {
  let actual: string;
  try { actual = realpathSync(resolve(root, local)); }
  catch { refuse("missing required local artifact: " + local); }
  const base = realpathSync(root);
  if (!actual.startsWith(base + sep)) refuse("artifact escapes repository: " + local);
  if (!statSync(actual).isFile()) refuse("expected regular file: " + local);
  return actual;
}
function readBounded(root: string, local: string, min = 1): Buffer {
  const file = safeFile(root, local);
  const size = statSync(file).size;
  if (size < min || size > 16 * 1024 * 1024) refuse("empty, tampered or oversized artifact: " + local);
  return readFileSync(file);
}
function sourceArtifact(root: string, file: string, min = 1): PdfAsset369 {
  const bytes = readBounded(root, "node_modules/pdfjs-dist/" + file, min);
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}
function json(root: string, local: string): Record<string, any> {
  let result: unknown;
  try { result = JSON.parse(readBounded(root, local).toString("utf8")); }
  catch { refuse("invalid JSON vendor manifest or lock: " + local); }
  if (result === null || typeof result !== "object" || Array.isArray(result)) refuse("invalid JSON object: " + local);
  return result as Record<string, any>;
}
const CODE_ASSETS = [
  "build/pdf.mjs", "build/pdf.worker.mjs", "legacy/build/pdf.mjs",
  "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm", "wasm/quickjs-eval.wasm",
] as const;
const NOTICE_ASSETS = [
  "LICENSE", "wasm/LICENSE_JBIG2", "wasm/LICENSE_QCMS",
  "wasm/LICENSE_PDFJS_JBIG2", "wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG",
  "wasm/LICENSE_PDFJS_QCMS", "standard_fonts/LICENSE_LIBERATION",
  "standard_fonts/LICENSE_FOXIT", "cmaps/LICENSE",
] as const;
// Installed files are evidence to validate, not a root-license umbrella over
// bundled codecs/fonts. These fingerprints of the *notices' content type*
// detect substituted/mislabelled notices without asserting legal clearance.
const NOTICE_EVIDENCE: Readonly<Record<(typeof NOTICE_ASSETS)[number], RegExp>> = {
  LICENSE: /Apache License\s+Version 2\.0, January 2004/u,
  "wasm/LICENSE_JBIG2": /PDFium Authors[\s\S]+Redistribution and use in source and binary forms/u,
  "wasm/LICENSE_QCMS": /qcms[\s\S]+Permission is hereby granted/u,
  "wasm/LICENSE_PDFJS_JBIG2": /Mozilla Foundation[\s\S]+Licensed under the Apache License/u,
  "wasm/LICENSE_OPENJPEG": /BSD License[\s\S]+Redistribution and use/u,
  "wasm/LICENSE_PDFJS_OPENJPEG": /Mozilla Foundation[\s\S]+Redistribution and use/u,
  "wasm/LICENSE_PDFJS_QCMS": /MIT License[\s\S]+Permission is hereby granted/u,
  "standard_fonts/LICENSE_LIBERATION": /GNU General Public License v\.2[\s\S]+special exception/u,
  "standard_fonts/LICENSE_FOXIT": /PDFium Authors[\s\S]+Redistribution and use/u,
  "cmaps/LICENSE": /Adobe Systems Incorporated[\s\S]+Redistribution and use/u,
};
function sourceFiles(root: string): string[] {
  const base = resolve(root, "src/engines/pdf");
  if (!existsSync(base) || !statSync(base).isDirectory() || realpathSync(base) !== base) refuse("PDF engine directory missing/linked");
  const paths: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) refuse("untrusted PDF source symlink");
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) paths.push(path);
    }
  };
  visit(base);
  if (!paths.length) refuse("no PDF source files to audit");
  return paths;
}
function remote(value: string): boolean {
  // URL-based loaders strip leading whitespace. blob: can also carry runnable
  // Worker code and must not silently pass this bounded direct-source gate.
  return /^(?:https?:|\/\/|data:|javascript:|blob:)/iu.test(value.trimStart());
}
function scanImports(root: string, files: readonly string[]): void {
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false,
      /\.tsx?$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    if ((parsed as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) {
      refuse("PDF source AST parse failed: " + relative(root, file));
    }
    // Track only literal, locally visible consts. Unknown runtime values remain
    // outside this static audit; a locally obvious remote endpoint must not pass.
    const bindings: Map<string, string | null>[] = [new Map()];
    type Sink369 = "fetch" | "importScripts" | "require";
    const sinkNames: readonly Sink369[] = ["fetch", "importScripts", "require"];
    // Separately track direct lexical aliases of dangerous host functions.
    // A local declaration (including a function parameter) shadows the host
    // name. Keep possible mutable aliases conservative if later reassigned.
    const sinkBindings: Map<string, Sink369 | null>[] = [new Map()];
    const sinkName = (input: ts.Expression | undefined, depth = 0): Sink369 | null => {
      if (!input || depth > 8) return null;
      if (ts.isParenthesizedExpression(input) || ts.isAsExpression(input)
        || ts.isTypeAssertionExpression(input)) return sinkName(input.expression, depth + 1);
      if (!ts.isIdentifier(input)) return null;
      for (let i = sinkBindings.length - 1; i >= 0; i--) {
        if (sinkBindings[i]!.has(input.text)) return sinkBindings[i]!.get(input.text) ?? null;
      }
      return sinkNames.includes(input.text as Sink369) ? input.text as Sink369 : null;
    };
    const staticValue = (input: ts.Expression | undefined, depth = 0): string | null => {
      if (!input || depth > 8) return null;
      if (ts.isStringLiteralLike(input)) return input.text;
      if (ts.isParenthesizedExpression(input) || ts.isAsExpression(input)
        || ts.isTypeAssertionExpression(input)) return staticValue(input.expression, depth + 1);
      if (ts.isIdentifier(input)) {
        for (let i = bindings.length - 1; i >= 0; i--) {
          if (bindings[i]!.has(input.text)) return bindings[i]!.get(input.text) ?? null;
        }
      }
      if (ts.isBinaryExpression(input) && input.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = staticValue(input.left, depth + 1);
        const right = staticValue(input.right, depth + 1);
        if (left !== null && right !== null) return left + right;
      }
      if (ts.isNewExpression(input) && ts.isIdentifier(input.expression)
        && input.expression.text === "URL") {
        const address = staticValue(input.arguments?.[0], depth + 1);
        if (address === null) return null;
        const base = staticValue(input.arguments?.[1], depth + 1);
        if (base !== null) {
          // A relative first argument can still resolve to remote code when
          // the second argument is a statically known remote base URL.
          try { return new URL(address, base).href; }
          catch { /* Invalid static bases are outside URL resolution. */ }
        }
        // import.meta.url and runtime bases cannot be evaluated here; preserve
        // the direct literal check without claiming full runtime coverage.
        return address;
      }
      return null;
    };
    const check = (value: ts.Expression | undefined, category: string): void => {
      const literal = staticValue(value);
      if (literal === null) return;
      if (remote(literal)) refuse("remote " + category + " import/fetch forbidden: " + relative(root, file));
      if (/^(?:mupdf(?:\/|$)|@mupdf\/)/iu.test(literal)) {
        refuse("AGPL/commercial MuPDF donor import forbidden: " + relative(root, file));
      }
    };
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclarationList(node)) {
        const isConst = (node.flags & ts.NodeFlags.Const) !== 0;
        for (const declaration of node.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            // Mutable locals still shadow constants, but must not be treated as
            // static after possible reassignment.
            bindings[bindings.length - 1]!.set(declaration.name.text,
              isConst ? staticValue(declaration.initializer) : null);
            // A declaration shadows its own name during initialization (TDZ).
            // Following known aliases through one or more local bindings is
            // enough for this audit; arbitrary closures remain out of scope.
            const alias = declaration.initializer && ts.isIdentifier(declaration.initializer)
              && declaration.initializer.text === declaration.name.text
              ? null : sinkName(declaration.initializer);
            sinkBindings[sinkBindings.length - 1]!.set(declaration.name.text, alias);
          }
        }
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) check(node.moduleSpecifier, "module");
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
        const sink = ts.isIdentifier(node.expression) ? sinkName(node.expression)
          : sinkNames.includes(name as Sink369) ? name as Sink369 : null;
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || sink !== null) {
          for (const argument of (sink === "importScripts" ? node.arguments : node.arguments.slice(0, 1))) {
            check(argument, sink ?? "dynamic module");
          }
        }
      }
      if (ts.isNewExpression(node) && (ts.isIdentifier(node.expression)
        || ts.isPropertyAccessExpression(node.expression))
        && ["Worker", "SharedWorker"].includes(ts.isIdentifier(node.expression)
          ? node.expression.text : node.expression.name.text)) {
        check(node.arguments?.[0], "worker/URL");
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(node.left) && node.left.name.text === "workerSrc") {
        check(node.right, "PDF.js workerSrc");
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)) {
        // If a mutable local can become a host sink, retain that possibility.
        // Never erase a known sink from a dynamic reassignment.
        const alias = sinkName(node.right);
        if (alias !== null) {
          for (let i = sinkBindings.length - 1; i >= 0; i--) {
            if (sinkBindings[i]!.has(node.left.text)) {
              sinkBindings[i]!.set(node.left.text, alias);
              break;
            }
          }
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name) {
        sinkBindings[sinkBindings.length - 1]!.set(node.name.text, null);
      }
      const functionScope = ts.isFunctionLike(node);
      const scoped = ts.isBlock(node) || ts.isSourceFile(node);
      if (scoped) bindings.push(new Map());
      if (scoped || functionScope) {
        sinkBindings.push(new Map());
        if (functionScope) {
          if ("name" in node && node.name && ts.isIdentifier(node.name as ts.Node)) {
            sinkBindings[sinkBindings.length - 1]!.set((node.name as ts.Identifier).text, null);
          }
          for (const parameter of node.parameters) {
            if (ts.isIdentifier(parameter.name)) {
              sinkBindings[sinkBindings.length - 1]!.set(parameter.name.text, null);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
      if (scoped || functionScope) sinkBindings.pop();
      if (scoped) bindings.pop();
    };
    visit(parsed);
  }
}
export function inspectPdfEngineProvenance369(projectRoot: string): PdfInspection369 {
  const root = realpathSync(projectRoot);
  const own = json(root, "package.json");
  const lock = json(root, "package-lock.json");
  const vendor = json(root, "node_modules/pdfjs-dist/package.json");
  if (vendor.name !== "pdfjs-dist" || typeof vendor.version !== "string"
    || !/^\d+\.\d+\.\d+$/u.test(vendor.version)) refuse("vendor identity or version untrusted");
  if (vendor.version !== "6.4.299"
    || !["6.4.299", "^6.4.299"].includes(own.dependencies?.["pdfjs-dist"])) {
    refuse("unreviewed PDF dependency/version");
  }
  if (vendor.license !== "Apache-2.0") refuse("AGPL/commercial/unknown license not approved");
  const pinned = lock.packages?.["node_modules/pdfjs-dist"];
  const lockRootDependency = lock.packages?.[""]?.dependencies?.["pdfjs-dist"];
  if (lockRootDependency !== undefined && lockRootDependency !== own.dependencies["pdfjs-dist"]) {
    refuse("root manifest/lock PDF dependency mismatch");
  }
  if (!pinned || pinned.version !== vendor.version || pinned.license !== "Apache-2.0") {
    refuse("lock version/license mismatch");
  }
  const resolved = "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-" + vendor.version + ".tgz";
  if (pinned.resolved !== resolved) refuse("noncanonical lock resolution");
  if (typeof pinned.integrity !== "string"
    || !/^sha512-[a-zA-Z0-9+/]{86}==$/u.test(pinned.integrity)
    || Buffer.from(pinned.integrity.slice(7), "base64").length !== 64) {
    refuse("lock integrity malformed or missing");
  }
  const license = readBounded(root, "node_modules/pdfjs-dist/LICENSE", 200).toString("utf8");
  if (!/Apache License\s+Version 2\.0, January 2004/u.test(license)
    || !/TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION/u.test(license)
    || !/4\. Redistribution/u.test(license)
    || /\bcommercial\s+use\s+(?:is\s+)?(?:prohibited|forbidden|not\s+permitted)\b/iu.test(license)) {
    refuse("installed Apache license text missing/tampered");
  }
  const licenseNotices = NOTICE_ASSETS.map((file) => sourceArtifact(root, file, 100));
  for (const file of NOTICE_ASSETS) {
    const noticeText = readBounded(root, "node_modules/pdfjs-dist/" + file, 100).toString("utf8");
    if (/\b(?:AGPL|Affero General Public License|commercial\s+use\s+(?:is\s+)?(?:prohibited|forbidden|not\s+permitted))\b/iu.test(noticeText)
      || !NOTICE_EVIDENCE[file].test(noticeText)) {
      refuse("license/notice text tampered, incompatible or not understood: " + file);
    }
  }
  const assets = CODE_ASSETS.map((file) => sourceArtifact(root, file, 4096));
  for (const file of CODE_ASSETS.filter((item) => item.endsWith(".mjs"))) {
    const head = readBounded(root, "node_modules/pdfjs-dist/" + file).subarray(0, 3000).toString("utf8");
    if (!/Licensed under the Apache License, Version 2\.0/u.test(head)) {
      refuse("vendor artifact header/license missing: " + file);
    }
  }
  const appFiles = sourceFiles(root);
  const vendorFiles = CODE_ASSETS.filter((file) => file.endsWith(".mjs"))
    .map((file) => safeFile(root, "node_modules/pdfjs-dist/" + file));
  scanImports(root, [...appFiles, ...vendorFiles]);
  for (const name of ["mupdf", "mupdf-js", "mupdf-wasm", "@mupdf/mupdf"]) {
    if (existsSync(resolve(root, "node_modules", name))) refuse("unapproved MuPDF installation detected");
  }
  return {
    identity: { packageName: "pdfjs-dist", version: vendor.version, declaredLicense: "Apache-2.0" },
    integrity: {
      lockAndInstallAgree: true, lockResolution: resolved, lockIntegrity: pinned.integrity, tarballSha512Attested: false,
    },
    imports: { files: appFiles.length + vendorFiles.length, remoteCount: 0 },
    assets, licenseNotices,
    limitations: [
      "Local SHA256 fingerprints are not authenticated upstream tarball attestations; npm SRI only checked for syntax.",
      ...(lockRootDependency === undefined ? ["Root npm lock dependency declaration absent; its consistency NOT VERIFIED."] : []),
      "Bundled WASM source/transitive rights and QuickJS redistribution notices NOT independently proven.",
      "Static direct import/fetch audit does NOT prove CSP/remote network silence of every transitive runtime.",
      "Deployed bundle download sizes, physical device RAM, fidelity, mobile/rights/legal owner review NOT_RUN.",
    ],
  };
}
export async function auditInstalledPdfEngine369(projectRoot: string): Promise<PdfAudit369> {
  const root = realpathSync(projectRoot);
  const inspection = inspectPdfEngineProvenance369(root);
  const fixture = readBounded(root, "quality/fixtures/pdf-gold/simple-2page.pdf", 100);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loader = pdfjs.getDocument({
    data: Uint8Array.from(fixture), useSystemFonts: false, disableAutoFetch: true, disableStream: true,
  });
  let pages = 0;
  const text: string[] = [];
  try {
    const doc = await loader.promise;
    pages = doc.numPages;
    if (pages !== 2) refuse("PDF.js independent fixture page count mismatch");
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const words = await page.getTextContent();
      text.push(words.items.map((item) => "str" in item ? item.str : "").join(" ").trim());
      page.cleanup();
    }
  } catch (error) {
    refuse("PDF.js functional parse refused: " + String(error).slice(0, 150));
  } finally {
    await loader.destroy().catch(() => undefined);
  }
  const extractedText = text.join(" ").slice(0, 1000);
  if (!/alpha/iu.test(extractedText) || !/beta/iu.test(extractedText)) {
    refuse("PDF.js text extraction fixture semantics not independently proved");
  }
  const mainBytes = inspection.assets.find((item) => item.path === "build/pdf.mjs")?.bytes ?? 0;
  const workerBytes = inspection.assets.find((item) => item.path === "build/pdf.worker.mjs")?.bytes ?? 0;
  return {
    inspection,
    probe: { fixturePageCount: pages, extractedText, fixtureSha256: hash(fixture) },
    comparison: [
      { engine: "in-house PDF parser/writer", installed: true, licenseGate: "FIRST_PARTY_SOURCE_REVIEW_REQUIRED",
        source: "src/engines/pdf/parser.ts + writer.ts", capabilities: ["local PDF object parse", "document writing"],
        browserBundle: "Source only; deployed chunk NOT_MEASURED", mobileEvidence: "NOT_RUN" },
      { engine: "Mozilla PDF.js", installed: true, licenseGate: "APACHE_2_0_DECLARED_RIGHTS_UNREVIEWED",
        source: "node_modules/pdfjs-dist@" + inspection.identity.version,
        capabilities: ["real 2-page PDF fixture parsing", "extract alpha/beta text", "installed worker module"],
        browserBundle: "PDF.js " + mainBytes + "B + worker " + workerBytes + "B raw disk; NOT deployed download",
        mobileEvidence: "NOT_RUN" },
      { engine: "MuPDF", installed: false, licenseGate: "AGPL_OR_COMMERCIAL_UNAPPROVED",
        source: "NO_VENDOR_ARCHIVE_INSTALLED_OR_EXAMINED", capabilities: [],
        browserBundle: "NOT_MEASURED", mobileEvidence: "NOT_RUN" },
      { engine: "macOS PDFKit", installed: process.platform === "darwin", licenseGate: "NATIVE_OS_NOT_BROWSER_VENDOR",
        source: "macOS native OS framework, not npm donor", capabilities: [],
        browserBundle: "NOT_APPLICABLE", mobileEvidence: "NOT_RUN" },
    ],
    adoption: "NO_ADOPT_NO_GOLD",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(JSON.stringify(await auditInstalledPdfEngine369(resolve(import.meta.dirname, "..")), null, 2) + "\n");
  } catch (error) {
    process.stderr.write("PDF369_NO_GO: " + String(error) + "\n");
    process.exitCode = 2;
  }
}
