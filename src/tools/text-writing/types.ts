import type {
  CaseConversionResult,
  CaseMode,
  CsvColumnListResult,
  FindReplaceResult,
  InvisibleCharacterOutput,
  LanguageStatisticsResult,
  LineDedupeResult,
  LineSortResult,
  ListDifferenceResult,
  ListIntersectionResult,
  MarkdownPreviewResult,
  MarkdownTableResult,
  QuoteDirection,
  ReadingTimeResult,
  SampleDataResult,
  SlugResult,
  TextInspectionResult,
  TextToCsvResult,
  UnicodeForm,
  UnicodeNormalizationResult,
  WhitespaceResult,
} from "../../engines/text-writing";
import type { EqualityMode } from "../../engines/text-list";

export type { CaseMode, EqualityMode, QuoteDirection, UnicodeForm };
export type { CaseConversionResult, CsvColumnListResult, FindReplaceResult, InvisibleCharacterOutput, LanguageStatisticsResult, LineDedupeResult, LineSortResult, ListDifferenceResult, ListIntersectionResult, MarkdownPreviewResult, MarkdownTableResult, ReadingTimeResult, SampleDataResult, SlugResult, TextInspectionResult, TextToCsvResult, UnicodeNormalizationResult, WhitespaceResult };

export interface WordCharacterLineCounterInput { text: string }
export type WordCharacterLineCounterOutput = TextInspectionResult;
export type WordCounterInput = WordCharacterLineCounterInput;
export type WordCounterOutput = TextInspectionResult;

export interface ReadingTimeEstimatorInput { text: string; wordsPerMinute?: number | string; wpm?: number | string }
export type ReadingTimeEstimatorOutput = ReadingTimeResult;

export interface CaseConverterInput { text: string; mode?: CaseMode }
export type CaseConverterOutput = CaseConversionResult;

export interface WhitespaceNormalizerInput { text: string; preserveBlankLines?: boolean }
export type WhitespaceNormalizerOutput = WhitespaceResult;

export interface InvisibleCharacterDetectorInput { text: string }
export type InvisibleCharacterDetectorOutput = InvisibleCharacterOutput;

export interface UnicodeNormalizerInput { text: string; form?: UnicodeForm }
export type UnicodeNormalizerOutput = UnicodeNormalizationResult;

export interface SmartQuoteNormalizerInput { text: string; direction?: QuoteDirection }
export type SmartQuoteNormalizerOutput = import("../../engines/text-writing").QuoteNormalizationResult;

export interface LineSorterInput { text?: string | readonly string[]; lines?: readonly string[]; descending?: boolean; caseSensitive?: boolean }
export type LineSorterOutput = LineSortResult;

export interface LineDeduplicatorInput { text?: string | readonly string[]; lines?: readonly string[]; equality?: EqualityMode; mode?: EqualityMode }
export type LineDeduplicatorOutput = LineDedupeResult;

export interface ListIntersectionInput { left: string | readonly string[]; right: string | readonly string[]; equality?: EqualityMode }
export type ListIntersectionOutput = ListIntersectionResult;

export interface ListDifferenceInput { left: string | readonly string[]; right: string | readonly string[]; equality?: EqualityMode }
export type ListDifferenceOutput = ListDifferenceResult;

export interface FindReplacePreviewInput { text: string; find: string; replace: string; regex?: boolean; caseSensitive?: boolean; all?: boolean }
export type FindReplacePreviewOutput = FindReplaceResult;

export interface MarkdownPreviewInput { text: string; markdown?: string }
export type MarkdownPreviewOutput = MarkdownPreviewResult;

export interface MarkdownTableFormatterInput { text: string; markdown?: string }
export type MarkdownTableFormatterOutput = MarkdownTableResult;

export interface SlugGeneratorInput { text: string; separator?: "-" | "_"; lowercase?: boolean; maxLength?: number }
export type SlugGeneratorOutput = SlugResult;

export interface TextToCsvRowsInput { text: string; delimiter?: string; headers?: string[]; columns?: number; includeHeaders?: boolean }
export type TextToCsvRowsOutput = TextToCsvResult;

export interface CsvColumnToListInput { csv: string; delimiter?: string; column?: number | string; hasHeader?: boolean; header?: boolean }
export type CsvColumnToListOutput = CsvColumnListResult;

export interface LoremSampleDataGeneratorInput { type?: "lorem" | "words" | "sentences" | "paragraphs" | "names" | "emails" | "numbers" | "rows"; count?: number | string; seed?: number | string }
export type LoremSampleDataGeneratorOutput = SampleDataResult;

export interface LanguageAwareTextStatisticsInput { text: string; locale?: string }
export type LanguageAwareTextStatisticsOutput = LanguageStatisticsResult;
