import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runDeveloperWebTool } from "../src/engines/developer-web";

const convert = async (text: string, mode: "encode" | "decode") =>
  String((await runDeveloperWebTool("html-entity-codec", { text, mode }) as { value: unknown }).value);

describe("STR-301 HTML text reference regressions", () => {
  it("matches an independent Python stdlib HTML5 decoding oracle", async () => {
    const cases = [
      "&NotEqualTilde; &euro; &copy", "&#x80; &#128; &#0;", "&#x1F642; &ampersand",
      "&#xZZ; &#; &#x; &madeupName;", "&notAnEntity; &CounterClockwiseContourIntegral;",
    ];
    const oracle = JSON.parse(execFileSync("python3", ["-c",
      "import html, json, sys; print(json.dumps([html.unescape(x) for x in json.load(sys.stdin)]))",
    ], { input: JSON.stringify(cases), encoding: "utf8" })) as string[];
    for (const [index, input] of cases.entries()) {
      expect(await convert(input, "decode"), `Python HTML5 oracle: ${input}`).toBe(oracle[index]);
    }
  });

  it("decodes legacy semicolonless names, C1 references and multi-codepoint HTML5 names", async () => {
    expect(await convert("&copy &amp &NotEqualTilde; &#x80; &#128; &#x1F642;", "decode"))
      .toBe("© & ≂̸ € € 🙂");
  });

  it("leaves malformed and unknown references literal instead of inventing entities", async () => {
    expect(await convert("&#xZZ; &#; &#x; &madeupName; &notAnEntity;", "decode"))
      .toBe("&#xZZ; &#; &#x; &madeupName; ¬AnEntity;");
  });

  it("encodes ampersands once per pass without recursively decoding input", async () => {
    const once = await convert("&copy; &amp;", "encode");
    const twice = await convert(once, "encode");
    expect(once).toBe("&amp;copy; &amp;amp;");
    expect(twice).toBe("&amp;amp;copy; &amp;amp;amp;");
    expect(await convert(once, "decode")).toBe("&copy; &amp;");
    expect(await convert(twice, "decode")).toBe(once);
  });

  it("bounds oversized requests even with a pre-aborted signal, and propagates cancellation in bounds", async () => {
    const aborter = new AbortController();
    aborter.abort();
    await expect(runDeveloperWebTool("html-entity-codec", { text: "x".repeat(1_000_001), mode: "decode" }, aborter.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    await expect(runDeveloperWebTool("html-entity-codec", { text: "x".repeat(1_000_001), mode: "decode" }))
      .rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    await expect(runDeveloperWebTool("html-entity-codec", { text: "x".repeat(1_000_000), mode: "decode" }, aborter.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
