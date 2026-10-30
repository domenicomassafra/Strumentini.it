import { describe, expect, it } from "vitest";
import {
  htmlEntityOperation,
  runDeveloperWebTool,
} from "../src/engines/developer-web";

const value = async (text: string, mode: "encode" | "decode", numeric = false) =>
  String((await htmlEntityOperation(text, mode, numeric)).value);

describe("#301 he@2.0.0 HTML entity adapter", () => {
  it("decodes canonical named and numeric fixtures", async () => {
    const fixtures = [
      ["&amp; &lt; &gt; &quot; &#39;", "& < > \" '"],
      ["&nbsp; &copy; &reg; &trade; &hellip; &ndash; &mdash;", "\u00a0 © ® ™ … – —"],
      ["&laquo; &raquo; &eacute; &egrave; &uuml; &ouml; &auml; &szlig;", "« » é è ü ö ä ß"],
      ["&#169; &#xA9; &#x1F600; &unknown;", "© © 😀 &unknown;"],
      ["Plain text without entities", "Plain text without entities"],
    ] as const;
    for (const [fixture, expected] of fixtures) {
      expect(await value(fixture, "decode"), fixture).toBe(expected);
    }
  });

  it("retains decimal escaping for the five punctuation marks", async () => {
    expect(await value(`&<>"'`, "encode", true)).toBe("&#38;&#60;&#62;&#34;&#39;");
  });

  it("expands named entities per WHATWG, including multi-codepoint and semicolonless cases", async () => {
    expect(await value("&NotEqualTilde; &CounterClockwiseContourIntegral; &euro;", "decode")).toBe("≂̸ ∳ €");
    expect(await value("&copy without semicolon &ampersand &bogus;", "decode")).toBe("© without semicolon &ersand &bogus;");
    expect(await value("&#x80; &#128;", "decode")).toBe("€ €");
    expect(await value("𝄞 © €", "encode")).toBe("&#119070; &copy; &euro;");
    expect(await value("𝄞 © €", "encode", true)).toBe("&#119070; &#169; &#8364;");
  });

  it("round-trips named, numeric, astral and malformed unrecognized text", async () => {
    const fixtures = ["<b>Tom & Jerry's ©</b>", "É e € 𝄞 😀", "&unknown;", "\n\ttext"];
    for (const fixture of fixtures) {
      expect(await value(await value(fixture, "encode"), "decode")).toBe(fixture);
      expect(await value(await value(fixture, "encode", true), "decode")).toBe(fixture);
    }
  });

  it("keeps typed refusals, the million-character limit and abort propagation", async () => {
    for (const text of ["&#x110000;", "&#999999999999999999999;", "&#xD800;", "\uD800", "\uDC00"]) {
      await expect(runDeveloperWebTool("html-entity-codec", { text, mode: "decode" })).rejects.toMatchObject({ code: "INVALID_HTML_ENTITY" });
    }
    await expect(runDeveloperWebTool("html-entity-codec", { text: "x".repeat(1_000_001) })).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    const aborter = new AbortController();
    aborter.abort();
    await expect(runDeveloperWebTool("html-entity-codec", { text: "&copy;", mode: "decode" }, aborter.signal)).rejects.toMatchObject({ name: "AbortError" });
    const result = await runDeveloperWebTool("html-entity-codec", { text: "&copy;", mode: "decode" }) as Record<string, unknown>;
    expect(result).toMatchObject({ valid: true, value: "©", engineVersion: "developer-web-v1" });
    expect(result.warning).toMatch(/non esegue una sanificazione HTML/u);
  });
});
