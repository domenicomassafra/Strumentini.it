import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  base64Operation,
  decodeBase64Bytes,
  encodeBase64Bytes,
  formatJson,
  formatToml,
  formatYaml,
  generateUuids,
  hashText,
  hmacText,
  htmlEntityOperation,
  inspectJwt,
  parseToml,
  parseYaml,
  queryJsonPath,
  regexTestOperation,
  runDeveloperWebTool,
  urlCodecOperation,
} from "../src/engines/developer-web";
import { cronNextRunOperation, explainCronOperation, httpStatusOperation, mimeTypeOperation, parseUserAgent, queryStringOperation, unixTimestampOperation } from "../src/engines/developer-web/web-reference";
import { jsonFormatterManifest } from "../src/tools/json-formatter/manifest";
import { yamlFormatterManifest } from "../src/tools/yaml-formatter/manifest";
import { tomlFormatterManifest } from "../src/tools/toml-formatter/manifest";
import { jsonYamlConverterManifest } from "../src/tools/json-yaml-converter/manifest";
import { urlCodecManifest } from "../src/tools/url-codec/manifest";
import { htmlEntityCodecManifest } from "../src/tools/html-entity-codec/manifest";
import { base64CodecManifest } from "../src/tools/base64-codec/manifest";
import { jwtInspectorManifest } from "../src/tools/jwt-inspector/manifest";
import { uuidGeneratorManifest } from "../src/tools/uuid-generator/manifest";
import { hashGeneratorManifest } from "../src/tools/hash-generator/manifest";
import { hmacGeneratorManifest } from "../src/tools/hmac-generator/manifest";
import { regexTesterManifest } from "../src/tools/regex-tester/manifest";
import { cronExplainerManifest } from "../src/tools/cron-explainer/manifest";
import { cronNextRunManifest } from "../src/tools/cron-next-run/manifest";
import { unixTimestampManifest } from "../src/tools/unix-timestamp/manifest";
import { httpStatusReferenceManifest } from "../src/tools/http-status-reference/manifest";
import { mimeTypeLookupManifest } from "../src/tools/mime-type-lookup/manifest";
import { userAgentParserManifest } from "../src/tools/user-agent-parser/manifest";
import { queryStringEditorManifest } from "../src/tools/query-string-editor/manifest";
import { jsonPathManifest } from "../src/tools/json-path-playground/manifest";

const manifests = [jsonFormatterManifest, yamlFormatterManifest, tomlFormatterManifest, jsonYamlConverterManifest, urlCodecManifest, htmlEntityCodecManifest, base64CodecManifest, jwtInspectorManifest, uuidGeneratorManifest, hashGeneratorManifest, hmacGeneratorManifest, regexTesterManifest, cronExplainerManifest, cronNextRunManifest, unixTimestampManifest, httpStatusReferenceManifest, mimeTypeLookupManifest, userAgentParserManifest, queryStringEditorManifest, jsonPathManifest];

const goldVectors = JSON.parse(
  await readFile(new URL("../quality/fixtures/developer-web-gold/vectors.json", import.meta.url), "utf8"),
) as { tool_vectors: Array<{ tool_id: Parameters<typeof runDeveloperWebTool>[0]; input: Record<string, unknown>; expected: Record<string, unknown> }> };

const moduleInputs: Array<[Parameters<typeof runDeveloperWebTool>[0], Record<string, unknown>]> = [
  ["json-formatter", { text: "{\"b\":2,\"a\":1}", sortKeys: true }],
  ["yaml-formatter", { text: "a: 1\nb: true\n" }],
  ["toml-formatter", { text: "name = \"Ada\"\nenabled = true\n" }],
  ["json-yaml-converter", { text: "a: 1\n", direction: "yaml-to-json" }],
  ["url-codec", { text: "Say what‽", mode: "encode" }],
  ["html-entity-codec", { text: "<x>", mode: "encode" }],
  ["base64-codec", { text: "foobar", mode: "encode" }],
  ["jwt-inspector", { token: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ." }],
  ["uuid-generator", { count: 2, seed: "test" }],
  ["hash-generator", { text: "abc", algorithm: "SHA-256" }],
  ["hmac-generator", { message: "message", key: "key", algorithm: "SHA-256" }],
  ["regex-tester", { pattern: "(\\w+)@(\\w+)", flags: "g", text: "a@b c@d" }],
  ["cron-explainer", { expression: "*/15 9-17 * * 1-5" }],
  ["cron-next-run", { expression: "*/15 * * * *", from: "2026-01-01T00:00:00.000Z", count: 3 }],
  ["unix-timestamp", { value: 0, direction: "to-date" }],
  ["http-status-reference", { status: 404 }],
  ["mime-type-lookup", { lookup: "png" }],
  ["user-agent-parser", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1" }],
  ["query-string-editor", { query: "a=1&a=2&blank=&space=hello+world" }],
  ["json-path-playground", { json: "{\"users\":[{\"name\":\"Ada\"}]}", path: "$.users[*].name" }],
];

describe("developer/web structured data", () => {
  it("matches one hand-worked Gold vector for every developer/web tool", async () => {
    expect(goldVectors.tool_vectors).toHaveLength(20);
    expect(new Set(goldVectors.tool_vectors.map((vector) => vector.tool_id)).size).toBe(20);
    for (const vector of goldVectors.tool_vectors) {
      const actual = await runDeveloperWebTool(vector.tool_id, vector.input) as Record<string, unknown>;
      for (const [key, expected] of Object.entries(vector.expected)) expect(actual[key], `${vector.tool_id}.${key}`).toEqual(expected);
    }
  });

  it("formats strict JSON and surfaces duplicate member names", () => {
    const result = formatJson("{\"a\":1,\"a\":2}", 2, true);
    expect(result.formatted).toBe("{\n  \"a\": 2\n}");
    expect(result.duplicateKeys).toEqual(["a"]);
    expect(() => formatJson("[1,]")).toThrow(/INVALID_JSON/u);
  });

  it("parses the supported YAML subset and rejects tab indentation", () => {
    expect(parseYaml("a: &x [1, 2]\nb: *x\n").value).toEqual({ a: [1, 2], b: [1, 2] });
    expect(formatYaml({ a: [1, 2] })).toBe("a:\n  - 1\n  - 2\n");
    expect(() => parseYaml("a:\n\t- tab-indent\n")).toThrow(/INVALID_YAML/u);
  });

  it("parses a bounded TOML subset and formats it", () => {
    const parsed = parseToml("[owner]\nname = \"Ada\"\nenabled = true\n");
    expect(parsed.value).toEqual({ owner: { name: "Ada", enabled: true } });
    expect(formatToml(parsed.value)).toContain("name = \"Ada\"");
    expect(parseToml("a = 1 # comment\n").value).toEqual({ a: 1 });
    expect(() => parseToml("a = 1\na = 2\n")).toThrow(/Duplicate/u);
  });

  it("keeps parser data keys from traversing object prototypes", () => {
    const prototype = Object.prototype as Record<string, unknown>;
    delete prototype.polluted;
    try {
      const toml = parseToml("__proto__.polluted = true\n[constructor.prototype.x]\ny = 1\n");
      expect(Object.hasOwn(toml.value, "__proto__")).toBe(true);
      expect(prototype.polluted).toBeUndefined();
      const yaml = parseYaml("__proto__:\n  polluted: true\n");
      expect(Object.hasOwn(yaml.value as Record<string, unknown>, "__proto__")).toBe(true);
      expect(prototype.polluted).toBeUndefined();
      expect(queryJsonPath({}, "$.toString").matches).toHaveLength(0);
      expect(() => formatJson(`${"[".repeat(129)}1${"]".repeat(129)}`)).toThrow(/JSON_TOO_DEEP/u);
    } finally {
      delete prototype.polluted;
    }
  });

  it("queries a bounded JSONPath subset", () => {
    const result = queryJsonPath({ users: [{ name: "Ada" }, { name: "Grace" }] }, "$.users[*].name");
    expect(result.matches.map(({ value }) => value)).toEqual(["Ada", "Grace"]);
    expect(() => queryJsonPath({}, "users[0]")).toThrow(/INVALID_JSON_PATH/u);
  });
});

describe("developer/web encoding and cryptography", () => {
  it("matches RFC 4648 Base64 vectors and rejects malformed padding", () => {
    expect(encodeBase64Bytes(new TextEncoder().encode("foobar"))).toBe("Zm9vYmFy");
    expect(new TextDecoder().decode(decodeBase64Bytes("Zm9vYmFy"))).toBe("foobar");
    expect(() => decodeBase64Bytes("===")).toThrow(/INVALID_BASE64/u);
    expect(() => decodeBase64Bytes("Zm9v*")).toThrow(/INVALID_BASE64/u);
    expect(base64Operation("foo", "encode")).toMatchObject({ value: "Zm9v", byteLength: 3 });
  });

  it("uses explicit percent and HTML entity policies", () => {
    expect(urlCodecOperation("Say what‽", "encode", "userinfo").value).toBe("Say%20what%E2%80%BD");
    expect(urlCodecOperation("%25%s%1G", "decode", "userinfo").value).toBe("%%s%1G");
    expect(htmlEntityOperation("<x>", "encode").value).toBe("&lt;x&gt;");
    expect(htmlEntityOperation("&lt;x&gt;", "decode").value).toBe("<x>");
  });

  it("generates RFC-shaped UUIDs and known SHA/HMAC answers", async () => {
    const uuid = generateUuids({ bytes: new Array(16).fill(0), version: 4 });
    expect(uuid.uuids).toEqual(["00000000-0000-4000-8000-000000000000"]);
    expect(await hashText("abc", "SHA-256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect((await hmacText("The quick brown fox jumps over the lazy dog", "key", "SHA-256")).digestHex).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("inspects JWT structure and labels unsecured tokens", () => {
    const result = inspectJwt("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ.");
    expect(result.unsecured).toBe(true);
    expect(result.payload).toMatchObject({ sub: "123" });
    expect(() => inspectJwt("not.a.valid.token")).toThrow(/INVALID_JWT/u);
  });

  it("tests regular expressions and bounds risky input", () => {
    expect(regexTestOperation("(\\w+)@(\\w+)", "g", "a@b c@d").matchCount).toBe(2);
    expect(() => regexTestOperation("(a+)+", "", "a".repeat(30))).toThrow(/REGEX_COMPLEXITY/u);
  });
});

describe("developer/web references and schedule operations", () => {
  it("returns local HTTP and MIME references", () => {
    expect(httpStatusOperation(404)).toMatchObject({ class: "client-error", reason: "Not Found" });
    expect(mimeTypeOperation("png", "extension")).toMatchObject({ mime: "image/png" });
    expect(mimeTypeOperation("89504e470d0a1a0a", "signature")).toMatchObject({ mime: "image/png", confidence: "signature-hint" });
  });

  it("parses user agents descriptively without capability claims", () => {
    const result = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(result).toMatchObject({ browser: "Safari", os: "iOS", device: "mobile", mobile: true });
    expect(result.warnings[0]).toMatch(/feature detection/u);
  });

  it("preserves query pair order and converts Unix time", () => {
    const query = queryStringOperation({ query: "a=1&a=2&blank=&space=hello+world" });
    expect(query.pairs).toEqual([{ key: "a", value: "1" }, { key: "a", value: "2" }, { key: "blank", value: "" }, { key: "space", value: "hello world" }]);
    expect(query.query).toBe("a=1&a=2&blank=&space=hello+world");
    expect(queryStringOperation({ url: "https://example.com/?a=1#section" })).toMatchObject({ url: "https://example.com/?a=1#section", query: "a=1" });
    expect(unixTimestampOperation(0, "seconds", "to-date")).toMatchObject({ date: "1970-01-01T00:00:00.000Z" });
  });

  it("explains cron and calculates UTC next runs", () => {
    expect(explainCronOperation("*/15 9-17 * * 1-5")).toMatchObject({ expression: "*/15 9-17 * * 1-5", semantics: expect.stringContaining("POSIX") });
    const result = cronNextRunOperation("*/15 * * * *", "2026-01-01T00:00:00.000Z", 3);
    expect(result.runs).toEqual(["2026-01-01T00:15:00.000Z", "2026-01-01T00:30:00.000Z", "2026-01-01T00:45:00.000Z"]);
  });
});

describe("developer/web tool contracts", () => {
  it("registers all twenty local manifests with canonical routes", () => {
    expect(manifests).toHaveLength(20);
    for (const manifest of manifests) {
      expect(manifest.route).toBe(`/tools/${manifest.id}`);
      expect(manifest.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(manifest.implementation).toBe(`../tools/${manifest.id}/module.ts`);
    }
  });

  it("runs every module through the shared deterministic seam", async () => {
    for (const [id, input] of moduleInputs) {
      const result = await runDeveloperWebTool(id, input) as Record<string, unknown>;
      expect(result.valid, id).toBe(true);
      expect(result.engineVersion, id).toBe("developer-web-v1");
    }
  });

  it("has a route and component file for every manifest", async () => {
    for (const manifest of manifests) {
      const component = manifest.id.split("-").map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`).join("");
      const routePath = new URL(`../src/pages/tools/${manifest.id}.astro`, import.meta.url);
      const componentPath = new URL(`../src/components/tools/${component}Tool.tsx`, import.meta.url);
      await expect(readFile(routePath, "utf8")).resolves.toContain(`${component}Tool`);
      await expect(readFile(componentPath, "utf8")).resolves.toContain("DeveloperWebTool");
    }
  });
});
