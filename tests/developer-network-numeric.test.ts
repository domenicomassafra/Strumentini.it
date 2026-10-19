import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  MAX_BASE_INTEGER_DIGITS,
  baseConversionOperation,
  chmodPermissionOperation,
  cidrOperation,
  formatRadixInteger,
  parseBoundedRadixInteger,
  runDeveloperWebTool,
  DeveloperWebError,
} from "../src/engines/developer-web";
import cidrManifest from "../src/tools/cidr-calculator/manifest";
import baseManifest from "../src/tools/base-converter/manifest";
import chmodManifest from "../src/tools/chmod-permission-helper/manifest";
import { createToolRuntime } from "../src/runtime/tool-runtime";

interface CidrFixture {
  readonly input: string;
  readonly expected: Readonly<Record<string, string>>;
}

interface BaseFixture {
  readonly value: string;
  readonly fromBase: string;
  readonly toBase: string;
  readonly expected: string;
}

interface ChmodFixture {
  readonly input: string;
  readonly expectedOctal: string;
  readonly expectedSymbolic: string;
}

const fixtures = JSON.parse(await readFile(
  new URL("../quality/fixtures/developer-network-numeric/vectors.json", import.meta.url),
  "utf8",
)) as {
  readonly cidr: readonly CidrFixture[];
  readonly baseConversion: readonly BaseFixture[];
  readonly chmod: readonly ChmodFixture[];
};

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();
  return value as Record<string, unknown>;
}

describe("ticket 173 — IPv4/IPv6 CIDR calculator", () => {
  it("matches the hand-worked IPv4/IPv6 fixture boundaries", async () => {
    for (const vector of fixtures.cidr) {
      const output = record(await cidrOperation(vector.input));
      if (vector.expected.family !== undefined) expect(output.family, vector.input).toBe(vector.expected.family);
      if (vector.expected.network !== undefined) expect(output.network, vector.input).toBe(vector.expected.network);
      if (vector.expected.broadcast !== undefined) expect(output.broadcast, vector.input).toBe(vector.expected.broadcast);
      if (vector.expected.addressCount !== undefined) expect(output.addressCount, vector.input).toBe(vector.expected.addressCount);
      if (vector.expected.last !== undefined) expect(record(output.range).last, vector.input).toBe(vector.expected.last);
      if (vector.expected.usableHosts !== undefined) expect(record(output.hostRange).count, vector.input).toBe(vector.expected.usableHosts);
    }
  });

  it("defines IPv4 /0, /31 and /32 semantics explicitly", async () => {
    const zero = record(await cidrOperation("203.0.113.9/0"));
    expect(zero.network).toBe("0.0.0.0/0");
    expect(zero.broadcast).toBe("255.255.255.255");
    expect(zero.addressCount).toBe("4294967296");
    expect(record(zero.hostRange)).toMatchObject({ first: "0.0.0.1", last: "255.255.255.254", count: "4294967294" });

    const pointToPoint = record(await cidrOperation("192.0.2.10/31"));
    expect(record(pointToPoint.hostRange)).toMatchObject({ first: "192.0.2.10", last: "192.0.2.11", count: "2", semantics: "RFC 3021 point-to-point endpoints" });

    const host = record(await cidrOperation("192.0.2.10/32"));
    expect(host.network).toBe("192.0.2.10/32");
    expect(host.broadcast).toBe("192.0.2.10");
    expect(record(host.hostRange)).toMatchObject({ first: "192.0.2.10", last: "192.0.2.10", count: "1", semantics: "single host route" });
  });

  it("keeps 128-bit IPv6 ranges exact at /0, /127 and /128 without inventing broadcast", async () => {
    const zero = record(await cidrOperation("2001:db8::1/0"));
    expect(zero.network).toBe("::/0");
    expect(zero.addressCount).toBe("340282366920938463463374607431768211456");
    expect(record(zero.range)).toEqual({ first: "::", last: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" });
    expect(Object.hasOwn(zero, "broadcast")).toBe(false);
    expect(zero.broadcastSemantics).toBe("not applicable to IPv6");

    const pair = record(await cidrOperation("2001:db8::5/127"));
    expect(pair.network).toBe("2001:db8::4/127");
    expect(record(pair.range)).toEqual({ first: "2001:db8::4", last: "2001:db8::5" });
    expect(pair.addressCount).toBe("2");

    const single = record(await cidrOperation("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128"));
    expect(single.network).toBe("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128");
    expect(single.addressCount).toBe("1");
    expect(Object.hasOwn(single, "broadcast")).toBe(false);
  });
});

describe("ticket 174 — exact base 2–36 integer conversion", () => {
  it("matches known literals including a 128-bit value", () => {
    for (const vector of fixtures.baseConversion) {
      expect(record(baseConversionOperation(vector.value, vector.fromBase, vector.toBase)).output, JSON.stringify(vector)).toBe(vector.expected);
    }
  });

  it("round-trips signed values exactly across every supported base", () => {
    const values = [
      0n,
      1n,
      -1n,
      9007199254740993n,
      -340282366920938463463374607431768211455n,
      (1n << 511n) - 1n,
    ];
    for (let base = 2; base <= 36; base += 1) {
      for (const value of values) {
        const encoded = formatRadixInteger(value, base);
        expect(parseBoundedRadixInteger(encoded, base).value, `base ${base} ${encoded}`).toBe(value);
      }
    }
  });

  it("locates an invalid digit and exposes the large-value bound", () => {
    try {
      baseConversionOperation("1z", "16", "10");
      throw new Error("expected invalid digit error");
    } catch (error) {
      expect(error).toBeInstanceOf(DeveloperWebError);
      const typed = error as DeveloperWebError;
      expect(typed.code).toBe("INVALID_INPUT");
      expect(typed.diagnostic).toMatchObject({ character: 2 });
      expect(typed.diagnostic?.context).toContain("base 16");
    }

    try {
      baseConversionOperation("10", "37", "10");
      throw new Error("expected invalid base error");
    } catch (error) {
      expect(error).toBeInstanceOf(DeveloperWebError);
      const typed = error as DeveloperWebError;
      expect(typed.code).toBe("INVALID_INPUT");
      expect(typed.diagnostic).toMatchObject({ character: 1, context: "Source base: 37" });
    }

    try {
      baseConversionOperation("1".repeat(MAX_BASE_INTEGER_DIGITS + 1), "2", "10");
      throw new Error("expected bounded-input error");
    } catch (error) {
      expect(error).toBeInstanceOf(DeveloperWebError);
      expect((error as DeveloperWebError).diagnostic?.context).toBe(`maximum digits: ${MAX_BASE_INTEGER_DIGITS}`);
    }
  });

  it("documents sign normalization in the result", () => {
    expect(record(baseConversionOperation("+000", "10", "36"))).toMatchObject({ output: "0", decimal: "0", exact: true });
    expect(record(baseConversionOperation("-ff", "16", "10"))).toMatchObject({ output: "-255", decimal: "-255" });
  });
});

describe("ticket 175 — chmod symbolic/octal helper", () => {
  it("round-trips known ordinary and special-bit modes", () => {
    for (const vector of fixtures.chmod) {
      const output = record(chmodPermissionOperation(vector.input));
      expect(output.octal, vector.input).toBe(vector.expectedOctal);
      expect(output.symbolic, vector.input).toBe(vector.expectedSymbolic);
      const reverse = record(chmodPermissionOperation(vector.expectedSymbolic));
      expect(reverse.octal, vector.expectedSymbolic).toBe(vector.expectedOctal);
      expect(reverse.symbolic, vector.expectedSymbolic).toBe(vector.expectedSymbolic);
    }
  });

  it("represents uppercase S/T when a special bit is set without execute", () => {
    expect(record(chmodPermissionOperation("4644"))).toMatchObject({ octal: "4644", symbolic: "rwSr--r--" });
    expect(record(chmodPermissionOperation("1700"))).toMatchObject({ octal: "1700", symbolic: "rwx-----T" });
  });

  it("labels owner, group and other permissions and never exposes filesystem mutation", () => {
    const result = record(chmodPermissionOperation("754"));
    const permissions = record(result.permissions);
    expect(permissions.owner).toEqual({ symbolic: "rwx", read: true, write: true, execute: true });
    expect(permissions.group).toEqual({ symbolic: "r-x", read: true, write: false, execute: true });
    expect(permissions.other).toEqual({ symbolic: "r--", read: true, write: false, execute: false });
    expect(result.machine).toEqual({ octal: "754", symbolic: "rwxr-xr--" });
  });

  it("rejects invalid octal and symbolic positions", () => {
    expect(() => chmodPermissionOperation("888")).toThrow(DeveloperWebError);
    expect(() => chmodPermissionOperation("rwxrwxrwq")).toThrow(DeveloperWebError);
  });
});

describe("developer routes for tickets 173–175", () => {
  it("stay local and expose Result v2 text-code actions", () => {
    for (const manifest of [cidrManifest, baseManifest, chmodManifest]) {
      expect(manifest.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(manifest.result).toMatchObject({ class: "text-code" });
      expect(manifest.result?.capabilities).toEqual(expect.arrayContaining(["copy", "download", "reset"]));
    }
  });

  it("executes all three routes through the shared developer runtime", async () => {
    const cidr = record(await runDeveloperWebTool("cidr-calculator", { cidr: "192.0.2.1/24" }));
    const base = record(await runDeveloperWebTool("base-converter", { value: "ff", fromBase: "16", toBase: "10" }));
    const chmod = record(await runDeveloperWebTool("chmod-permission-helper", { permissions: "755" }));
    expect(cidr).toMatchObject({ network: "192.0.2.0/24", engineVersion: "developer-web-v1" });
    expect(base).toMatchObject({ output: "255", engineVersion: "developer-web-v1" });
    expect(chmod).toMatchObject({ symbolic: "rwxr-xr-x", engineVersion: "developer-web-v1" });
  });

  it("loads all three generated modules through the public runtime registry", async () => {
    const runtime = createToolRuntime(undefined, { track: () => ({ status: "disabled", accepted: false }) });
    const cidr = await runtime.run("cidr-calculator", { cidr: "2001:db8::1/128" });
    const base = await runtime.run("base-converter", { value: "101", fromBase: "2", toBase: "10" });
    const chmod = await runtime.run("chmod-permission-helper", { permissions: "rwxr-xr-x" });
    expect(cidr).toMatchObject({ ok: true, value: { network: "2001:db8::1/128" } });
    expect(base).toMatchObject({ ok: true, value: { output: "5" } });
    expect(chmod).toMatchObject({ ok: true, value: { octal: "755" } });
  });
});
