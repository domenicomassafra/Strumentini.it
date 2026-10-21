export {
  ItalyReferenceDataError,
  createItalyReferenceRegistry,
  getItalyReferenceProvenance,
  loadItalyReferenceBoundaryFixtures,
} from "./registry";
export type { ItalyReferenceErrorCode, ItalyReferenceRegistry } from "./registry";
export {
  getItalySourcePackDecision,
  ITALY_SOURCE_PACK_DECISIONS,
  listItalySourcePackDecisions,
  validateItalySourcePackDecisions,
} from "./source-packs";
export type {
  ItalyCandidateOfficialSource,
  ItalySourceEvidenceSnapshot,
  ItalySourceFreshnessMode,
  ItalySourceFreshnessPolicy,
  ItalySourcePackDecision,
  ItalySourcePackStatus,
} from "./source-packs";
export type {
  ItalyBoundaryKind,
  ItalyBoundaryPosition,
  ItalyOfficialSource,
  ItalyReferenceBoundaryCase,
  ItalyReferenceBoundaryFixture,
  ItalyReferenceDomain,
  ItalyReferenceMetadata,
  ItalyReferenceProvenance,
  ItalyReferenceValidity,
  ItalyReferenceVersion,
} from "./types";
export { ITALIAN_IDENTITY_DOCUMENT_RULES } from "./identity-document-expiry";
export type { ItalianIdentityDocumentKind, ItalianIdentityDocumentRules } from "./identity-document-expiry";
export {
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  OFFICIAL_FISCAL_SOURCE_HOSTS_117,
  assertAnnualFiscalSourceReview117,
  assertOfficialFiscalSource117,
  buildAnnualFiscalSourceReview117,
  getAnnualFiscalSourceRows117,
  isOfficialFiscalSourceUrl117,
  listAnnualFiscalSourceYears117,
} from "./annual-source-registry-117";
export type {
  AnnualFiscalCoverage117,
  AnnualFiscalSourceReview117,
  AnnualFiscalSourceRow117,
} from "./annual-source-registry-117";
export {
  FATTURAPA_TECHNICAL_CURRENT,
  INPS_CONTRIBUTIONS_2026,
  ITALY_NATIONAL_HOLIDAYS_2026,
} from "./annual-2026";
export type {
  FatturaPaSchemaIdentity,
  FatturaPaTechnicalData,
  GestioneSeparataProfessionalProfile,
  InpsAutonomousProfile,
  InpsContributionSeniority,
  InpsEmployeeProfile,
  InpsContributions2026Data,
  ItalyNationalHoliday2026,
  ItalyNationalHolidays2026Data,
} from "./annual-2026";
