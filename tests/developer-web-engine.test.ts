import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  base64Operation,
  base64FileOperation,
  imageBase64Operation,
  decodeBase64Bytes,
  encodeBase64Bytes,
  formatJson,
  jsonFormatterOperation,
  jsonValidatorOperation,
  formatToml,
  formatYaml,
  generateUuids,
  hashText,
  hmacText,
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
const uuidVectors = JSON.parse(
  await readFile(new URL("../quality/fixtures/uuid-rfc9562/vectors.json", import.meta.url), "utf8"),
) as { vectors: Array<{ value: string; version?: number; unix_ts_ms?: number; source?: string }> };

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

  it("preserves structured JSON parser diagnostics without stack leakage", () => {
    const result = jsonValidatorOperation('{\n  "user": {\n    "name": "Ada",\n    "age" 42\n  }\n}') as Record<string, unknown>;
    expect(result).toMatchObject({
      valid: false,
      code: "INVALID_JSON",
      diagnostic: { line: 4, column: 11, character: 44, path: "$.user" },
    });
    expect(String(result.error)).not.toContain("at jsonFail");
    expect(JSON.stringify(result.diagnostic)).not.toContain("stack");
  });

  it("prettifies and minifies to the same value and reports encoded byte delta", () => {
    const source = '{ "b": 2, "a": [1, true] }';
    const pretty = jsonFormatterOperation(source, 2, true, "prettify") as Record<string, unknown>;
    const minified = jsonFormatterOperation(source, 2, true, "minify") as Record<string, unknown>;
    expect(JSON.parse(String(pretty.formatted))).toEqual(JSON.parse(String(minified.formatted)));
    expect(minified.formatted).toBe('{"a":[1,true],"b":2}');
    expect(minified.inputBytes).toBe(new TextEncoder().encode(source).length);
    expect(minified.outputBytes).toBe(new TextEncoder().encode(String(minified.formatted)).length);
    expect(minified.byteDelta).toBe((minified.outputBytes as number) - (minified.inputBytes as number));
    expect(() => jsonFormatterOperation("{bad", 2, false, "minify")).toThrow(/INVALID_JSON/u);
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
    expect(() => parseToml("a = 1\na = 2\n")).toThrow(/INVALID_TOML/u);
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
    expect(base64Operation("ÿ?", "encode", true)).toMatchObject({ alphabet: "base64url", paddingPolicy: expect.stringContaining("without-padding") });
    const raw = Uint8Array.from([0x00, 0xff, 0x10, 0x80, 0x41]);
    const encoded = base64FileOperation(raw, "encode-bytes") as Record<string, unknown>;
    expect(encoded).toMatchObject({ inputKind: "raw-bytes", outputKind: "base64-text", byteLength: 5, value: "AP8QgEE=" });
    expect(base64FileOperation(String(encoded.value), "decode-bytes")).toMatchObject({ bytes: [0, 255, 16, 128, 65], byteLength: 5 });
    const url = base64FileOperation(raw, "encode-bytes", true) as Record<string, unknown>;
    expect(url.value).toBe("AP8QgEE");
    expect(base64FileOperation(String(url.value), "decode-bytes", true)).toMatchObject({ bytes: [0, 255, 16, 128, 65] });
    expect(() => base64FileOperation("A===", "decode-bytes")).toThrow(/INVALID_BASE64/u);
  });

  it("round-trips signature-verified images through plain Base64 and data URLs", async () => {
    const png = new Uint8Array(await readFile(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url)));
    const plain = imageBase64Operation(png, "encode-image", "plain") as Record<string, unknown>;
    expect(plain).toMatchObject({ mime: "image/png", width: 2, height: 3, signatureVerified: true, envelope: "plain" });
    const decoded = imageBase64Operation(String(plain.value), "decode-image", "plain") as Record<string, unknown>;
    expect(decoded).toMatchObject({ mime: "image/png", bytes: Array.from(png), signatureVerified: true });

    const dataUrl = imageBase64Operation(png, "encode-image", "data-url") as Record<string, unknown>;
    expect(String(dataUrl.value)).toMatch(/^data:image\/png;base64,/u);
    expect(imageBase64Operation(String(dataUrl.value), "decode-image", "data-url")).toMatchObject({ mime: "image/png", width: 2, height: 3 });
    const wrongMime = String(dataUrl.value).replace("data:image/png", "data:image/jpeg");
    expect(() => imageBase64Operation(wrongMime, "decode-image", "data-url")).toThrow(/IMAGE_MIME_MISMATCH/u);
    expect(() => imageBase64Operation("aGVsbG8=", "decode-image", "plain")).toThrow(/INVALID_IMAGE_SIGNATURE/u);
  });

  it("uses percent and entity policies", () => {
    expect(urlCodecOperation("Say what‽", "encode", "userinfo").value).toBe("Say%20what%E2%80%BD");
    expect(urlCodecOperation("%25%s%1G", "decode", "userinfo").value).toBe("%%s%1G");
  });

  it("generates RFC-shaped UUIDs and known SHA/HMAC answers", async () => {
    const uuid = generateUuids({ bytes: new Array(16).fill(0), version: 4 });
    expect(uuid.uuids).toEqual(["00000000-0000-4000-8000-000000000000"]);
    expect(await hashText("abc", "SHA-256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect((await hmacText("The quick brown fox jumps over the lazy dog", "key", "SHA-256")).digestHex).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("encodes UUIDv7 with the RFC 9562 48-bit Unix-millisecond field", () => {
    const vector = uuidVectors.vectors.find(({ version, source }) => version === 7 && source === "RFC 9562 Appendix A.6");
    expect(vector).toBeDefined();
    const now = vector!.unix_ts_ms!;
    const bytes = vector!.value.replaceAll("-", "").match(/../gu)!.map((pair) => Number.parseInt(pair, 16));
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const result = generateUuids({ version: 7, bytes }) as unknown as {
        uuids: string[];
        randomness: string;
      };
      expect(result.uuids).toEqual([vector!.value]);
      const encodedMilliseconds = Number.parseInt(result.uuids[0]!.replaceAll("-", "").slice(0, 12), 16);
      expect(encodedMilliseconds).toBe(now);
      expect(result.randomness).toBe("explicit-test-input");
    } finally {
      clock.mockRestore();
    }
  });

  it("labels seeded UUID generation as explicit test input rather than secure randomness", () => {
    const result = generateUuids({ version: 7, seed: "fixture" }) as unknown as { randomness: string };
    expect(result.randomness).toBe("explicit-test-input");
  });

  it("inspects JWT structure and labels unsecured tokens", () => {
    const result = inspectJwt("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ.");
    expect(result.unsecured).toBe(true);
    expect(result.payload).toMatchObject({ sub: "123" });
    expect(() => inspectJwt("not.a.valid.token")).toThrow(/INVALID_JWT/u);
  });

  it("interprets JWT temporal claims against an explicit reference clock", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      exp: 1_767_229_200,
      nbf: 1_767_222_000,
      iat: 1_767_218_400,
    })).toString("base64url");
    const token = `${header}.${payload}.`;
    const before = inspectJwt(token, "2026-01-01T00:30:00.000Z") as Record<string, unknown>;
    expect(before.temporal).toMatchObject({
      referenceTime: "2026-01-01T00:30:00.000Z",
      expired: false,
      notYetValid: false,
      issuedInFuture: false,
      claimIssues: [],
    });
    const atExpiry = inspectJwt(token, "2026-01-01T02:00:00.000Z") as Record<string, unknown>;
    expect(atExpiry.temporal).toMatchObject({ expired: true });
  });

  it("explains malformed JWT temporal claims without treating them as verified", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ exp: "tomorrow", nbf: 1_900_000_000 })).toString("base64url");
    const result = inspectJwt(`${header}.${payload}.`, "2026-01-01T00:00:00.000Z") as Record<string, unknown>;
    expect(result.temporal).toMatchObject({
      expired: null,
      notYetValid: true,
      claimIssues: [{ claim: "exp", issue: "NON_NUMERIC" }],
    });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/non verifica firma/u), expect.stringMatching(/claim temporali/u)]));
    expect(() => inspectJwt(`${header}.${payload}.`, "not-a-date")).toThrow(/INVALID_JWT_REFERENCE_TIME/u);
  });

  it("tests regular expressions and bounds risky input", () => {
    expect(regexTestOperation("(\\w+)@(\\w+)", "g", "a@b c@d").matchCount).toBe(2);
    expect(() => regexTestOperation("(a+)+", "", "a".repeat(30))).toThrow(/REGEX_COMPLEXITY/u);
  });
});

describe("developer/web references and schedule operations", () => {
  it("returns local HTTP and MIME references", () => {
    expect(httpStatusOperation(404)).toMatchObject({ class: "client-error", reason: "Non trovato" });
    expect(mimeTypeOperation("png", "extension")).toMatchObject({ mime: "image/png" });
    expect(mimeTypeOperation("89504e470d0a1a0a", "signature")).toMatchObject({ mime: "image/png", confidence: "signature-hint" });
  });

  it("parses user agents descriptively without capability claims", () => {
    const result = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(result).toMatchObject({ browser: "Safari", os: "iOS", device: "mobile", mobile: true });
    expect(result.warnings[0]).toMatch(/funzionalità disponibili/u);
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

  it("applies deterministic Europe/Rome DST gap and overlap cron policy", () => {
    const spring = cronNextRunOperation("30 2 * * *", "2026-03-28T01:31:00.000Z", 1, "Europe/Rome") as Record<string, unknown>;
    expect(spring).toMatchObject({
      timezone: "Europe/Rome",
      runs: ["2026-03-30T00:30:00.000Z"],
      localRuns: [{ local: "2026-03-30T02:30", utc: "2026-03-30T00:30:00.000Z" }],
      dstPolicy: { gap: "skip-nonexistent-local-times", overlap: "include-each-distinct-utc-instant" },
    });
    const fall = cronNextRunOperation("30 2 * * *", "2026-10-24T01:31:00.000Z", 2, "Europe/Rome") as Record<string, unknown>;
    expect(fall).toMatchObject({
      runs: ["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"],
      localRuns: [
        { local: "2026-10-25T02:30", utc: "2026-10-25T00:30:00.000Z" },
        { local: "2026-10-25T02:30", utc: "2026-10-25T01:30:00.000Z" },
      ],
    });
    expect(() => cronNextRunOperation("0 9 * * *", "2026-01-01T00:00:00.000Z", 1, "Mars/Olympus")).toThrow(/INVALID_TIMEZONE/u);
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
