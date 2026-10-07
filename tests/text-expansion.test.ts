import { describe, expect, it } from "vitest";
import {
  chunkSemanticText,
  extractPhoneLinkHashtagMention,
  factSensitiveTextDiff,
  italianGulpeaseReadability,
  reflowPdfCopyText,
  repairMojibake,
  restoreSemanticChunks,
  stablePlaceholderTransform,
} from "../src/engines/text-writing";
import { buildTextResultPresentation } from "../src/components/tools/text-writing/TextFamilyResultV2";

describe("tickets 184-190 text expansion", () => {
  it("chunks Unicode text reversibly and keeps overlap outside canonical join semantics", () => {
    const source = "Prima frase con emoji 🧪. Seconda frase.\r\n\r\nTerzo paragrafo con accenti: perché è utile. ".repeat(30);
    const result = chunkSemanticText({ text: source, targetCharacters: 180, overlapCharacters: 24 });
    expect(result.chunkCount).toBeGreaterThan(2);
    expect(result.exactRoundTrip).toBe(true);
    expect(result.restored).toBe(source);
    expect(restoreSemanticChunks(result.chunks)).toBe(source);
    expect(result.newlinePolicy).toMatch(/preserved exactly/u);
    expect(result.chunks.slice(1).every((chunk) => chunk.overlapBefore !== null && chunk.overlapBefore!.end === chunk.start)).toBe(true);
    const broken = result.chunks.map((chunk) => ({ ...chunk }));
    broken[1] = { ...broken[1]!, start: broken[1]!.start - 1 };
    expect(() => restoreSemanticChunks(broken)).toThrow(/INVALID_CHUNK_SEQUENCE/u);
  });

  it("promotes changed lexical markers while separating whitespace-only edits", () => {
    const changed = factSensitiveTextDiff({
      before: "Report 2026-10-06: totale 1.250 euro. Vedi https://example.it/a e pratica AB-123.",
      after: "Report 2026-10-07: totale 1.350 euro. Vedi https://example.it/b e pratica AB-124.",
    });
    expect(changed.sensitiveChangeCount).toBeGreaterThanOrEqual(6);
    expect(changed.priorityChanges.removed.map((marker) => marker.kind)).toEqual(expect.arrayContaining(["date", "number", "url", "id"]));
    expect(changed.limitation).toMatch(/does not verify factual truth/u);
    const cosmetic = factSensitiveTextDiff({ before: "Valore 42\nqui", after: " Valore   42 qui " });
    expect(cosmetic.formattingOnly).toBe(true);
    expect(cosmetic.sensitiveChangeCount).toBe(0);
  });

  it("anonymizes explicit entities with stable placeholders and restores only exact mappings", () => {
    const text = "Mario Rossi scrive a mario@example.it. Mario Rossi risponde.";
    const first = stablePlaceholderTransform({ text, mode: "anonymize", entities: "Mario Rossi\nmario@example.it" });
    const second = stablePlaceholderTransform({ text, mode: "anonymize", entities: ["mario@example.it", "Mario Rossi"] });
    expect(first.output).toBe(second.output);
    expect(first.mapping).toEqual(second.mapping);
    expect(first.output).not.toContain("Mario Rossi");
    const restored = stablePlaceholderTransform({ text: first.output, mode: "restore", mapping: first.mapping });
    expect(restored.output).toBe(text);
    const missing = first.output.replace(first.mapping[0]!.placeholder, "[mutated]");
    expect(() => stablePlaceholderTransform({ text: missing, mode: "restore", mapping: first.mapping })).toThrow(/PLACEHOLDER_COUNT_MISMATCH/u);
    expect(first.persistence).toMatch(/local operation result/u);
  });

  it("computes visible Gulpease intermediates with deterministic Italian sentence policy", () => {
    const text = "Il gatto corre. Il cane dorme.";
    const result = italianGulpeaseReadability({ text });
    const letters = Array.from(text.matchAll(/\p{L}/gu)).length;
    const words = 6;
    const expected = Math.round((89 + (300 * 2 - 10 * letters) / words) * 10) / 10;
    expect(result).toMatchObject({ letters, words, sentences: 2, score: expected });
    expect(result.formula).toContain("89 +");
    expect(result.limitation).toMatch(/non è un giudizio assoluto/u);
    expect(result.limitation).toMatch(/100 parole/u);
    expect(result.publishedWorkedExamples).toEqual(expect.arrayContaining([
      expect.objectContaining({ score: 60 }),
      expect.objectContaining({ score: 72 }),
    ]));
    expect(italianGulpeaseReadability({ text: "Il sig. Rossi arriva. Poi parte." }).sentences).toBe(2);
  });

  it("repairs only unambiguous common Windows-1252/UTF-8 mojibake and is idempotent", () => {
    const result = repairMojibake({ text: "CafÃ¨ e l\u00e2\u20ac\u2122Italia" });
    expect(result).toMatchObject({ accepted: true, changed: true, output: "Cafè e l’Italia" });
    expect(result.transforms[0]).toMatch(/Windows-1252/u);
    const second = repairMojibake({ text: result.output });
    expect(second.output).toBe(result.output);
    expect(second.changed).toBe(false);
    const refused = repairMojibake({ text: "ÃO" });
    expect(refused.accepted).toBe(false);
    expect(refused.output).toBe("ÃO");
    expect(refused.warnings.length).toBeGreaterThan(0);
    const presentation = buildTextResultPresentation("mojibake-repair", result);
    expect(presentation.table?.rows.map((row) => row[0])).toEqual(["Prima", "Dopo"]);
  });

  it("reflows PDF-copy wraps conservatively and keeps visible hyphens as explicit ambiguity", () => {
    const source = "Questa riga continua\nsulla seconda riga.\n\nNuovo paragrafo.";
    const result = reflowPdfCopyText({ text: source });
    expect(result.output).toBe("Questa riga continua sulla seconda riga.\n\nNuovo paragrafo.");
    expect(result.joinedLineBreaks).toBe(1);
    expect(reflowPdfCopyText({ text: result.output }).output).toBe(result.output);
    const hyphen = reflowPdfCopyText({ text: "pre-\nfisso" });
    expect(hyphen.output).toBe("pre-fisso");
    expect(hyphen.hyphenationAmbiguities).toHaveLength(1);
    const soft = reflowPdfCopyText({ text: "pre\u00ad\nfisso" });
    expect(soft.output).toBe("prefisso");
    expect(soft.softHyphenRepairs).toBe(1);
    const presentation = buildTextResultPresentation("pdf-copy-text-reflow", result);
    expect(presentation.table?.rows.map((row) => row[0])).toEqual(["Prima", "Dopo"]);
  });

  it("extracts typed Unicode-safe spans with deterministic overlap and explicit normalization", () => {
    const text = "🧪 Chiama +39 080 123 4567, visita https://example.it/@mario#news. Scrivi a mail@example.it e cita @utente #città.";
    const result = extractPhoneLinkHashtagMention({ text });
    expect(result.matches.map((match) => match.kind)).toEqual(["phone", "url", "mention", "hashtag"]);
    const phone = result.matches[0]!;
    expect(text.slice(phone.start, phone.end)).toBe(phone.original);
    expect(phone.normalized).toBe("+390801234567");
    expect(phone.start).toBeGreaterThan(phone.codePointStart);
    expect(result.matches.some((match) => match.original === "@example.it")).toBe(false);
    expect(result.csv).toContain("start_codepoint");
  });
});
