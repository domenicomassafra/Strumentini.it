import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DeveloperWebError, runDeveloperWebTool, yamlFormatterOperation } from "../src/engines/developer-web";
import { formatYaml, parseYaml } from "../src/engines/developer-web/structured-data";

interface Fixture {
  readonly id: string;
  readonly source: string;
}

const corpus = (JSON.parse(readFileSync(new URL("../quality/fixtures/yaml-275/corpus.json", import.meta.url), "utf8")) as {
  fixtures: Fixture[];
}).fixtures;

/** Fixtures where the historical formatter refuses a document the YAML 1.2 core grammar accepts. */
const DONOR_IMPROVEMENTS = new Set(["anchors-and-aliases", "block-scalar-literal"]);
/** Fixtures whose stored bytes differ by construction but keep an identical parsed value. */
const IDENTICAL_VALUE_DIFFERENT_BYTES = new Set(["quoted-scalars", "numeric-keys", "numbers-core"]);
/** Fixtures both engines must refuse instead of guessing a merge/constructor semantics. */
const REFUSED_BY_DESIGN = new Set(["merge-keys-refused"]);
/** PyYAML 6 implements YAML 1.1, so it is not an oracle for 1.2-only numeric forms, timestamps or merge keys. */
const PYYAML_INCOMPATIBLE = new Set(["numbers-core", "date-strings", "merge-keys-refused"]);

function errorCode(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof DeveloperWebError ? error.code : String(error);
  }
}

describe("#275 — yaml@2.9.1 formatter parity", () => {
  it("keeps every previously accepted fixture value identical and re-parses its own output", async () => {
    for (const fixture of corpus) {
      if (REFUSED_BY_DESIGN.has(fixture.id)) {
        await expect(yamlFormatterOperation(fixture.source), fixture.id).rejects.toMatchObject({ code: "UNSUPPORTED_YAML" });
        expect(errorCode(() => parseYaml(fixture.source)), `${fixture.id} historical refusal`).toBe("INVALID_YAML");
        continue;
      }
      const legacyCode = errorCode(() => parseYaml(fixture.source));
      const donor = (await yamlFormatterOperation(fixture.source)) as Record<string, unknown>;
      expect(donor.valid, fixture.id).toBe(true);
      expect(donor.formatted, fixture.id).toEqual(expect.any(String));
      const roundTrip = (await yamlFormatterOperation(String(donor.formatted))) as Record<string, unknown>;
      expect(roundTrip.value, `${fixture.id} round-trip`).toEqual(donor.value);
      expect(roundTrip.formatted, `${fixture.id} idempotent formatting`).toBe(donor.formatted);
      if (legacyCode === null) {
        const legacy = parseYaml(fixture.source).value;
        if (!IDENTICAL_VALUE_DIFFERENT_BYTES.has(fixture.id)) expect(donor.value, fixture.id).toEqual(legacy);
        const legacyOutput = formatYaml(legacy);
        if (legacyOutput !== donor.formatted) expect(IDENTICAL_VALUE_DIFFERENT_BYTES.has(fixture.id), `${fixture.id} output drift`).toBe(true);
      } else {
        expect(DONOR_IMPROVEMENTS.has(fixture.id), `${fixture.id} was refused by the historical parser`).toBe(true);
        expect(legacyCode).toBe("INVALID_YAML");
      }
    }
  });

  it("matches an independent PyYAML oracle on the YAML 1.2 compatible fixtures", async () => {
    const compatible = corpus.filter((fixture) => !PYYAML_INCOMPATIBLE.has(fixture.id));
    const script = [
      "import json, sys, yaml",
      "for item in json.load(sys.stdin):",
      "    print(json.dumps({'id': item['id'], 'value': yaml.safe_load(item['source'])}, ensure_ascii=False, default=str))",
    ].join("\n");
    const lines = execFileSync("python3", ["-c", script], {
      input: JSON.stringify(compatible.map(({ id, source }) => ({ id, source }))),
      encoding: "utf8",
    }).trim().split("\n");
    for (const line of lines) {
      const oracle = JSON.parse(line) as { id: string; value: unknown };
      const donor = (await yamlFormatterOperation(compatible.find((fixture) => fixture.id === oracle.id)!.source)) as Record<string, unknown>;
      expect(donor.value, oracle.id).toEqual(oracle.value);
    }
    expect(lines).toHaveLength(compatible.length);
  });

  it("refuses tags, merge keys, complex keys, infinity and duplicate keys explicitly", async () => {
    const refusals: Array<[string, string]> = [
      ["custom tag", "a: !custom 3\n"],
      ["binary tag", "a: !!binary aGk=\n"],
      ["timestamp tag", "a: !!timestamp 2020-01-01\n"],
      ["merge key", "base: &b {a: 1}\nmerge:\n  <<: *b\n"],
      ["complex key", "? [a, b]\n: value\n"],
      ["infinity", "a: .inf\n"],
      ["not-a-number", "a: .nan\n"],
      ["duplicate key", "a: 1\na: 2\n"],
      ["two documents", "a: 1\n---\nb: 2\n"],
    ];
    for (const [name, source] of refusals) {
      await expect(yamlFormatterOperation(source), name).rejects.toBeInstanceOf(DeveloperWebError);
    }
    await expect(yamlFormatterOperation("a: !custom 3\n")).rejects.toMatchObject({ code: "UNSUPPORTED_YAML" });
    await expect(yamlFormatterOperation("a: 1\na: 2\n")).rejects.toMatchObject({ code: "INVALID_YAML" });
    await expect(yamlFormatterOperation("a: 1\n---\nb: 2\n")).rejects.toMatchObject({ code: "INVALID_YAML" });
  });

  it("preserves the bounded input, depth, tab, indent and alias limits", async () => {
    await expect(yamlFormatterOperation("a:\n\t- tab-indent\n")).rejects.toMatchObject({ code: "INVALID_YAML" });
    await expect(yamlFormatterOperation("a: 1\n", 9)).rejects.toMatchObject({ code: "INVALID_INDENT" });
    await expect(yamlFormatterOperation("a: 1\n", 2.5)).rejects.toMatchObject({ code: "INVALID_INDENT" });
    await expect(yamlFormatterOperation("a: " + "x".repeat(1_000_000) + "\n")).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    const flow = "a: " + "[".repeat(40) + "1" + "]".repeat(40) + "\n";
    await expect(yamlFormatterOperation(flow)).rejects.toMatchObject({ code: "YAML_TOO_DEEP" });
    const block = Array.from({ length: 40 }, (_, depth) => " ".repeat(depth * 2) + `k${depth}:`).join("\n") + "\n";
    await expect(yamlFormatterOperation(block)).rejects.toMatchObject({ code: "YAML_TOO_DEEP" });
    const aliasBomb = "a: &a [1,2]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]\ne: [*d,*d,*d,*d,*d,*d,*d,*d,*d,*d]\n";
    await expect(yamlFormatterOperation(aliasBomb)).rejects.toBeInstanceOf(DeveloperWebError);
  });

  it("keeps prototype keys inert and honors cancellation", async () => {
    const prototype = Object.prototype as Record<string, unknown>;
    delete prototype.polluted;
    const parsed = (await yamlFormatterOperation("__proto__:\n  polluted: true\n")) as Record<string, unknown>;
    expect(Object.hasOwn(parsed.value as object, "__proto__")).toBe(true);
    expect(prototype.polluted).toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await expect(yamlFormatterOperation("a: 1\n", 2, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("routes through the lazy adapter and keeps the historical formatter for indent 0", async () => {
    const routed = await runDeveloperWebTool("yaml-formatter", { text: "a: 1\nb: true\n" }) as Record<string, unknown>;
    expect(routed).toMatchObject({ valid: true, formatted: "a: 1\nb: true\n", value: { a: 1, b: true }, engineVersion: "developer-web-v1" });
    const zero = await yamlFormatterOperation("a:\n  b: 1\n", 0) as Record<string, unknown>;
    expect(zero.warnings).toContain("Con rientro 0 resta attivo il formattatore storico.");
    expect(zero.formatted).toBe(formatYaml({ a: { b: 1 } }, 0));
  });
});
