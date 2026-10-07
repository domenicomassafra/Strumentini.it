// The tool surface vocabulary: one stylesheet, imported once, consumed by all
// 13 family renderers and the bespoke tools. Imported here so no renderer has
// to remember it, and so there is exactly one tool-surface CSS import in the
// codebase.
import "../tool-surface.css";

export { CONTROL, it } from "./controlLabels";
export type { ControlLabel } from "./controlLabels";
export { BoundedTableResultPreview, BoundedTextResultPreview } from "./BoundedResultPreview";
export { BatchResult } from "./BatchResult";
export { FileResultRow, FileResultWorkspace } from "./FileResultWorkspace";
export type { FileResultRowProps, FileResultWorkspaceProps } from "./FileResultWorkspace";
export { InlineError } from "./InlineError";
export { JsonResult } from "./JsonResult";
export { PreviousValue } from "./PreviousValue";
export type { PreviousValueProps } from "./PreviousValue";
export { focusToolOperationRecovery, resultAccessibilityFor, ResultStateCue } from "./ResultAccessibility";
export type {
  AccessibleResultStatus,
  RecoveryFocusRoot,
  RecoveryFocusStatus,
  ResultAccessibilityDescriptor,
  ResultAnnouncementPriority,
  ResultStateCueProps,
} from "./ResultAccessibility";
export { ProfileOverrideHint, ProfileResetButton, ProvenanceBadge } from "./Provenance";
export {
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "./ResultPrimitives";
export type {
  ResultAssumption,
  ResultAssumptionsProps,
  ResultBreakdownProps,
  ResultDetailRow,
  ResultExplanationProps,
  ResultInterpretationProps,
  ResultPrimaryAnswerProps,
  ResultProvenanceProps,
} from "./ResultPrimitives";
export { ResultActions } from "./ResultActions";
export type { ResultActionsProps } from "./ResultActions";
export { ReferenceResultProvenance } from "./ReferenceResultProvenance";
export { StructuredTextResultV2 } from "./StructuredTextResultV2";
export type { StructuredTextMetric, StructuredTextResultV2Props } from "./StructuredTextResultV2";
export {
  CalculatorResultV2Exemplar,
  TransformResultV2Exemplar,
  ValidatorResultV2Exemplar,
} from "./ResultV2Exemplars";
export { CaretMark, RangeMark, StatusMark, statusMarkLabel } from "./StatusMark";
export type {
  CaretDirection,
  CaretMarkProps,
  RangeMarkProps,
  StatusMarkKind,
  StatusMarkProps,
} from "./StatusMark";
export { ToolActions, ToolCancelButton, ToolResetButton, ToolSubmitButton } from "./ToolActions";
export { GUTTER_PREVIOUS_MS, gutterStateFor, gutterStateFromResult, ToolGutter } from "./ToolGutter";
export type { GutterEntry, GutterState, ToolGutterProps } from "./ToolGutter";
export { ToolFormCard, ToolOperation } from "./ToolOperation";
export { ToolProgress, ToolStatus } from "./ToolProgress";
export { ToolResultPanel } from "./ToolResultPanel";
export { ToolSurface } from "./ToolSurface";
export type { ToolSurfaceProps } from "./ToolSurface";
export {
  cancelToolOperation,
  idleToolOperation,
  partialToolOperation,
  settleToolOperation,
  shouldCommitToolOperation,
  startToolOperation,
  useToolOperation,
  warningToolOperation,
} from "./useToolOperation";
export type {
  ToolOperationController,
  ToolOperationExecutor,
  ToolOperationOptions,
  ToolOperationState,
  ToolOperationStatus,
} from "./useToolOperation";
