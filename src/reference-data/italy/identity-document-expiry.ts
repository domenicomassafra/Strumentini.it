import type { ItalyReferenceVersion } from "./types";

export type ItalianIdentityDocumentKind = "cie" | "cie-temporary-fingerprint" | "passport";

export interface ItalianIdentityDocumentRules {
  readonly cie: {
    readonly under3Years: 3;
    readonly minorYears: 5;
    readonly adultBaseYears: 9;
    readonly expiryBoundary: "first-birthday-strictly-after-term";
    readonly temporaryFingerprintMonths: 12;
  };
  readonly passport: {
    readonly under3Years: 3;
    readonly minorYears: 5;
    readonly adultYears: 10;
    readonly expiryBoundary: "issue-date-anniversary";
  };
}

export const ITALIAN_IDENTITY_DOCUMENT_RULES: ItalyReferenceVersion<ItalianIdentityDocumentRules> = {
  metadata: {
    datasetId: "italian-identity-document-expiry",
    domain: "administrative",
    version: "2026-10-06.1",
    validity: { from: "2026-10-06", to: null },
    checkedAt: "2026-10-06",
    snapshotHash: "sha256:6e63ad5081c6db307af6c36511718d0641bc9b56e759b631cc9f9732317feed3",
    sources: [
      {
        type: "official-authority",
        authority: "Ministero dell'Interno — Carta di Identità Elettronica",
        title: "Cos'è la carta — Validità e costo",
        url: "https://www.cartaidentita.interno.gov.it/la-carta/",
      },
      {
        type: "official-authority",
        authority: "Polizia di Stato — Questura di Matera",
        title: "Rilascio Passaporti",
        url: "https://questure.poliziadistato.it/it/Matera/articolo/5730dd56519d7672957443",
      },
    ],
  },
  data: {
    cie: {
      under3Years: 3,
      minorYears: 5,
      adultBaseYears: 9,
      expiryBoundary: "first-birthday-strictly-after-term",
      temporaryFingerprintMonths: 12,
    },
    passport: {
      under3Years: 3,
      minorYears: 5,
      adultYears: 10,
      expiryBoundary: "issue-date-anniversary",
    },
  },
};
