import { getItalyReferenceProvenance, ITALIAN_IDENTITY_DOCUMENT_RULES, type ItalianIdentityDocumentKind } from "../../reference-data/italy";

export interface ItalianDocumentExpiryInput {
  readonly documentType: ItalianIdentityDocumentKind;
  readonly birthDate: string;
  readonly issueDate: string;
}

export interface ItalianDocumentExpiryResult {
  readonly documentType: ItalianIdentityDocumentKind;
  readonly birthDate: string;
  readonly issueDate: string;
  readonly ageAtIssue: number;
  readonly expiryDate: string;
  readonly rule: string;
  readonly ruleVersion: string;
  readonly checkedAt: string;
  readonly sources: readonly { readonly authority: string; readonly title: string; readonly url: string }[];
  readonly verification: "calculation-only-not-document-verification";
}

function parseIsoDate(value: string, code: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) throw new Error(code);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(code);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fullYearsAt(birth: { year: number; month: number; day: number }, issue: { year: number; month: number; day: number }): number {
  let years = issue.year - birth.year;
  if (issue.month < birth.month || (issue.month === birth.month && issue.day < birth.day)) years -= 1;
  return years;
}

function addYearsExact(date: { year: number; month: number; day: number }, years: number): { year: number; month: number; day: number } {
  if (date.month === 2 && date.day === 29) throw new Error("UNSUPPORTED_LEAP_DAY_BOUNDARY");
  return { year: date.year + years, month: date.month, day: date.day };
}

function firstBirthdayStrictlyAfter(
  birth: { year: number; month: number; day: number },
  threshold: { year: number; month: number; day: number },
): { year: number; month: number; day: number } {
  if (birth.month === 2 && birth.day === 29) throw new Error("UNSUPPORTED_LEAP_DAY_BOUNDARY");
  let year = threshold.year;
  if (birth.month < threshold.month || (birth.month === threshold.month && birth.day <= threshold.day)) year += 1;
  return { year, month: birth.month, day: birth.day };
}

export function calculateItalianDocumentExpiry(input: ItalianDocumentExpiryInput): ItalianDocumentExpiryResult {
  const birth = parseIsoDate(input.birthDate, "INVALID_BIRTH_DATE");
  const issue = parseIsoDate(input.issueDate, "INVALID_ISSUE_DATE");
  const birthKey = Number(`${String(birth.year).padStart(4, "0")}${String(birth.month).padStart(2, "0")}${String(birth.day).padStart(2, "0")}`);
  const issueKey = Number(`${String(issue.year).padStart(4, "0")}${String(issue.month).padStart(2, "0")}${String(issue.day).padStart(2, "0")}`);
  if (issueKey < birthKey) throw new Error("ISSUE_BEFORE_BIRTH");
  const ageAtIssue = fullYearsAt(birth, issue);
  if (ageAtIssue < 0 || ageAtIssue > 130) throw new Error("UNSUPPORTED_AGE");

  let expiry: { year: number; month: number; day: number };
  let rule: string;
  if (input.documentType === "cie-temporary-fingerprint") {
    expiry = addYearsExact(issue, 1);
    rule = "CIE temporanea per impossibilità al rilascio delle impronte: 12 mesi dalla data di emissione.";
  } else if (input.documentType === "cie") {
    const years = ageAtIssue < 3
      ? ITALIAN_IDENTITY_DOCUMENT_RULES.data.cie.under3Years
      : ageAtIssue < 18
        ? ITALIAN_IDENTITY_DOCUMENT_RULES.data.cie.minorYears
        : ITALIAN_IDENTITY_DOCUMENT_RULES.data.cie.adultBaseYears;
    const threshold = addYearsExact(issue, years);
    expiry = firstBirthdayStrictlyAfter(birth, threshold);
    rule = ageAtIssue < 3
      ? "CIE: primo compleanno dopo 3 anni dall'emissione per titolare con meno di 3 anni."
      : ageAtIssue < 18
        ? "CIE: primo compleanno dopo 5 anni dall'emissione per titolare da 3 a meno di 18 anni."
        : "CIE: primo compleanno dopo 9 anni dall'emissione per maggiorenni, entro il limite massimo di 10 anni.";
  } else if (input.documentType === "passport") {
    const years = ageAtIssue < 3
      ? ITALIAN_IDENTITY_DOCUMENT_RULES.data.passport.under3Years
      : ageAtIssue < 18
        ? ITALIAN_IDENTITY_DOCUMENT_RULES.data.passport.minorYears
        : ITALIAN_IDENTITY_DOCUMENT_RULES.data.passport.adultYears;
    expiry = addYearsExact(issue, years);
    rule = `Passaporto ordinario: validità di ${years} anni dalla data di emissione per la fascia di età al rilascio.`;
  } else {
    throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
  }

  const provenance = getItalyReferenceProvenance(ITALIAN_IDENTITY_DOCUMENT_RULES);
  return {
    documentType: input.documentType,
    birthDate: input.birthDate,
    issueDate: input.issueDate,
    ageAtIssue,
    expiryDate: formatDate(expiry.year, expiry.month, expiry.day),
    rule,
    ruleVersion: provenance.version,
    checkedAt: provenance.checkedAt,
    sources: provenance.sources.map(({ authority, title, url }) => ({ authority, title, url })),
    verification: "calculation-only-not-document-verification",
  };
}
