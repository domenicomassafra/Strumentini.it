import { describe, expect, it, vi } from "vitest";
import {
  codiceFiscaleChecksum121,
  generateCodiceFiscale121,
  validateCodiceFiscale121,
} from "../src/engines/italy/codice-fiscale-121";
import { decodeCodiceFiscale122 } from "../src/engines/italy/codice-fiscale-122";

const rome = { kind: "current" as const, istatCode: "058091" };
const basic = { surname: "Rossi", name: "Mario", sex: "M" as const, birthDate: "2026-02-21", birthPlace: rome };

describe("#121 formal checksum, bounded local generation, provenance and refusals", () => {
  it("matches independently published odd/even parity formula on historical formal fixture", () => {
    // Widely published illustrative CF string; checksum uses DM Finanze 23/12/1976 art. 7.
    expect(codiceFiscaleChecksum121("RSSMRA80A01H501")).toBe("U");
    expect(validateCodiceFiscale121("RSSMRA80A01H501U")).toMatchObject({
      status: "FORMALLY_VALID", normalizedCode: "RSSMRA80A01H501U", identityConfirmed: false,
    });
    expect(validateCodiceFiscale121("RSSMRA80A01H501A")).toMatchObject({
      status: "INVALID", reasonCode: "CHECKSUM_MISMATCH", identityConfirmed: false,
    });
  });

  it("generates a candidate for Roma with dated provenance and flags older birth dates", () => {
    expect(generateCodiceFiscale121(basic)).toMatchObject({
      status: "GENERATED_CANDIDATE", code: "RSSMRA26B21H501N",
      geography: { name: "Roma", belfiore: "H501", provenance: "ISTAT_CURRENT_2026_02_21" },
      identityConfirmed: false,
    });
    expect(generateCodiceFiscale121({ ...basic, birthDate: "1980-01-01" })).toMatchObject({
      status: "GENERATED_CANDIDATE", code: "RSSMRA80A01H501U",
      geographyAtBirth: "NOT_VERIFIED", identityConfirmed: false,
    });
  });

  it("uses name's 1st/3rd/4th consonants, surname's first three, accents and padding", () => {
    const input = { ...basic, surname: "D'Àe", name: "Cristiano" };
    const result = generateCodiceFiscale121(input);
    expect(result.status).toBe("GENERATED_CANDIDATE");
    if (result.status === "GENERATED_CANDIDATE") {
      expect(result.code.slice(0, 6)).toBe("DAECST");
      expect(result.code[15]).toBe(codiceFiscaleChecksum121(result.code.slice(0, 15)));
    }
  });

  it("refuses malformed names, invalid dates and forged future/source-unsupported identities", () => {
    expect(generateCodiceFiscale121({ ...basic, surname: "李" })).toMatchObject({ status: "REFUSED", reasonCode: "NAME_UNSUPPORTED" });
    expect(generateCodiceFiscale121({ ...basic, birthDate: "2026-02-29" })).toMatchObject({ status: "REFUSED", reasonCode: "INVALID_DATE" });
    expect(generateCodiceFiscale121({ ...basic, birthDate: "2026-2-21" })).toMatchObject({ status: "REFUSED", reasonCode: "INVALID_DATE" });
    expect(generateCodiceFiscale121({ ...basic, birthPlace: { kind: "current", istatCode: "999999" } })).toMatchObject({
      status: "REFUSED", reasonCode: "GEOGRAPHY_NOT_IN_SNAPSHOT",
    });
  });

  it("does not assign successor's code to suppressed municipality nor assert foreign lifetime", () => {
    expect(generateCodiceFiscale121({ ...basic, birthPlace: { kind: "suppressed", istatCode: "027810" } })).toMatchObject({
      status: "REFUSED", reasonCode: "GEOGRAPHY_CODE_UNAVAILABLE",
    });
    expect(generateCodiceFiscale121({ ...basic, birthPlace: { kind: "suppressed", istatCode: "024027" } })).toMatchObject({
      status: "GENERATED_CANDIDATE", geographyAtBirth: "NOT_VERIFIED",
    });
    expect(generateCodiceFiscale121({ ...basic, birthPlace: { kind: "foreign", istatCode: "201" } })).toMatchObject({
      status: "GENERATED_CANDIDATE", geographyAtBirth: "NOT_VERIFIED",
    });
  });

  it("refuses non-code checksum input, while checksum is recalculated for every legal omocode", () => {
    expect(() => codiceFiscaleChecksum121("ABC")).toThrow(/CF121_CHECKSUM_INPUT/u);
    const base15 = "RSSMRA80A01H50M";
    const full = base15 + codiceFiscaleChecksum121(base15);
    expect(validateCodiceFiscale121(full)).toMatchObject({ status: "FORMALLY_VALID", identityConfirmed: false });
    expect(full[15]).not.toBe("U");
  });
});

describe("#122 decoding, century/omocodia/source ambiguity", () => {
  it("decodes only encoded sex/month/day/year suffix, preserving plausible centuries", () => {
    const decoded = decodeCodiceFiscale122("RSSMRA80A01H501U");
    expect(decoded).toMatchObject({
      status: "DECODED_FORMALLY", sex: "M", yearSuffix: 80, month: 1, day: 1,
      possibleBirthDates: ["1980-01-01", "2080-01-01"], centuryAmbiguous: true,
      canonicalCode: "RSSMRA80A01H501U", identityConfirmed: false,
    });
    if (decoded.status === "DECODED_FORMALLY") {
      expect(decoded.geographyCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "Roma", belfiore: "H501", provenance: "ISTAT_CURRENT_2026_02_21" }),
      ]));
      expect(decoded.geographyDateValidity).toBe("NOT_PROVEN_FOR_BIRTH_DATE");
    }
  });

  it("only permits omocodia letters in the seven legal numeric slots, with exact inverse and recomputed checksum", () => {
    const base15 = "RSSMRA80A01H50M"; // last Belfiore digit 1 => M
    const omocode = base15 + codiceFiscaleChecksum121(base15);
    expect(decodeCodiceFiscale122(omocode)).toMatchObject({
      status: "DECODED_FORMALLY", canonicalCode: "RSSMRA80A01H501U",
      omocodia: [{ position: 15, letter: "M", digit: "1" }],
    });
    const forbiddenMonth = "RSSMRA80U01H501"; // U is an omocode letter, not an encoded month
    expect(validateCodiceFiscale121(forbiddenMonth + codiceFiscaleChecksum121(forbiddenMonth))).toMatchObject({
      status: "INVALID", reasonCode: "MONTH_INVALID",
    });
    const forbiddenYear = "RSSMRAK0A01H501";
    expect(validateCodiceFiscale121(forbiddenYear + codiceFiscaleChecksum121(forbiddenYear))).toMatchObject({
      status: "INVALID", reasonCode: "STRUCTURE_INVALID",
    });
  });

  it("reverses all 128 valid combinations across the seven numerical omocodia positions", () => {
    const base15 = "RSSMRA80A01H501";
    const positions = [6, 7, 9, 10, 12, 13, 14] as const;
    const alphabet = "LMNPQRSTUV";
    for (let mask = 0; mask < 128; mask += 1) {
      const altered = base15.split("");
      const substitutions = [];
      for (let slot = 0; slot < positions.length; slot += 1) {
        if ((mask & (1 << slot)) === 0) continue;
        const offset = positions[slot]!;
        const original = altered[offset]!;
        const letter = alphabet[Number(original)]!;
        altered[offset] = letter;
        substitutions.push({ position: offset + 1, digit: original, letter });
      }
      const altered15 = altered.join("");
      const decoded = decodeCodiceFiscale122(altered15 + codiceFiscaleChecksum121(altered15));
      expect(decoded.status, `mask ${mask}`).toBe("DECODED_FORMALLY");
      if (decoded.status === "DECODED_FORMALLY") {
        expect(decoded.canonicalCode, `mask ${mask}`).toBe("RSSMRA80A01H501U");
        expect(decoded.omocodia, `mask ${mask}`).toEqual(substitutions);
        expect(decoded.possibleBirthDates).toEqual(["1980-01-01", "2080-01-01"]);
      }
    }
  });

  it("keeps historical row multiplicity and source/version instead of guessing unique birth place", () => {
    const historic = "RSSMRA80A01C056";
    const decoded = decodeCodiceFiscale122(historic + codiceFiscaleChecksum121(historic));
    if (decoded.status !== "DECODED_FORMALLY") throw new Error("Expected formal historical row");
    expect(decoded.geographyCandidates.find((row) => row.name === "Castegnero")).toMatchObject({
      sourceVersion: expect.stringMatching(/^115-situas-/u),
      temporalValidity: "NOT_VERIFIED", sourceRow: 0,
    });
    expect(decoded.geographyCandidates.every((row) => row.belfiore === "C056")).toBe(true);
  });

  it("checks leap days in possible 1900/2000 centuries, refuses impossible dates and gender day gaps", () => {
    const leap15 = "RSSMRA00B29H501";
    expect(decodeCodiceFiscale122(leap15 + codiceFiscaleChecksum121(leap15))).toMatchObject({
      status: "DECODED_FORMALLY", possibleBirthDates: ["2000-02-29"], centuryAmbiguous: false,
    });
    for (const invalid of ["RSSMRA01B29H501", "RSSMRA00B30H501", "RSSMRA00A40H501", "RSSMRA00A00H501"]) {
      expect(validateCodiceFiscale121(invalid + codiceFiscaleChecksum121(invalid))).toMatchObject({
        status: "INVALID", reasonCode: "DATE_INVALID",
      });
    }
    const female15 = "RSSMRA00B61H501";
    expect(decodeCodiceFiscale122(female15 + codiceFiscaleChecksum121(female15))).toMatchObject({
      status: "DECODED_FORMALLY", sex: "F", day: 21,
    });
  });

  it("preserves uncertain historical and foreign place candidates without inventing identity", () => {
    const suppressed = "RSSMRA80A01C056";
    const historic = decodeCodiceFiscale122(suppressed + codiceFiscaleChecksum121(suppressed));
    expect(historic).toMatchObject({ status: "DECODED_FORMALLY", identityConfirmed: false });
    if (historic.status === "DECODED_FORMALLY") {
      expect(historic.geographyCandidates).toEqual(expect.arrayContaining([expect.objectContaining({
        name: "Castegnero", provenance: "SITUAS_SUPPRESSED_128", changeDate: "2026-02-21",
      })]));
    }
    const foreign = "RSSMRA80A01Z100";
    const foreignDecoded = decodeCodiceFiscale122(foreign + codiceFiscaleChecksum121(foreign));
    if (foreignDecoded.status !== "DECODED_FORMALLY") throw new Error("Expected formally decodable foreign fixture");
    expect(foreignDecoded.geographyCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Albania", provenance: "SITUAS_FOREIGN_469", belfiore: "Z100" }),
    ]));
    expect(foreignDecoded.geographyDateValidity).toBe("NOT_PROVEN_FOR_BIRTH_DATE");
    const unknown = "RSSMRA80A01Z999";
    expect(decodeCodiceFiscale122(unknown + codiceFiscaleChecksum121(unknown))).toMatchObject({
      status: "DECODED_FORMALLY", geographyCandidates: [], geographyDateValidity: "UNKNOWN_CODE",
    });
  });

  it("is entirely local: neither formal modes nor snapshot-driven generation make network calls", () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("NETWORK_FORBIDDEN"); });
    try {
      generateCodiceFiscale121(basic);
      validateCodiceFiscale121("RSSMRA80A01H501U");
      decodeCodiceFiscale122("RSSMRA80A01H501U");
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
