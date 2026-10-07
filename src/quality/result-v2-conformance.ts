import { RESULT_CLASSES, type ResultClass } from "../catalog/manifest";
import { resultAccessibilityFor, type AccessibleResultStatus } from "../components/tools/shared/ResultAccessibility";
import { resolveResultActions, type ResultActionContext, type ResultActionId } from "../runtime/result-actions";

export const RESULT_V2_CONFORMANCE_STATES = [
  "running",
  "success",
  "warning",
  "partial",
  "error",
  "cancelled",
] as const satisfies readonly AccessibleResultStatus[];

export type ResultV2ConformanceState = (typeof RESULT_V2_CONFORMANCE_STATES)[number];

export type ResultV2A11yRequirement =
  | "concise-announcement"
  | "focusable-preview"
  | "image-alt"
  | "item-state-text"
  | "keyboard-actions"
  | "labelled-region"
  | "non-color-state-cue"
  | "page-control"
  | "primary-answer-first"
  | "progress-labelled"
  | "reference-time"
  | "summary-status";

export interface ResultV2ClassContract {
  readonly requiredSlots: readonly string[];
  readonly requiredActions: readonly ResultActionId[];
  readonly requiredStates: readonly ResultV2ConformanceState[];
  readonly requiredA11y: readonly ResultV2A11yRequirement[];
  readonly requiredVariantStates?: readonly string[];
}

const BASE_A11Y = [
  "concise-announcement",
  "non-color-state-cue",
  "keyboard-actions",
] as const satisfies readonly ResultV2A11yRequirement[];

export const RESULT_V2_CLASS_CONTRACTS = {
  calculator: {
    requiredSlots: ["primary", "interpretation", "breakdown", "assumptions", "provenance"],
    requiredActions: ["copy", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "primary-answer-first"],
  },
  validator: {
    requiredSlots: ["primary", "interpretation", "checks", "provenance"],
    requiredActions: ["copy", "retry", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "primary-answer-first"],
  },
  "text-code": {
    requiredSlots: ["selectable-output", "counts"],
    requiredActions: ["copy", "download", "reuse", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "focusable-preview", "labelled-region"],
  },
  table: {
    requiredSlots: ["summary", "issue-counts", "table-preview"],
    requiredActions: ["copy", "download", "handoff", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "focusable-preview", "labelled-region"],
  },
  file: {
    requiredSlots: ["file-workspace"],
    requiredActions: ["download", "retry", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "progress-labelled", "item-state-text", "labelled-region"],
    requiredVariantStates: ["running", "success", "error", "cancelled"],
  },
  image: {
    requiredSlots: ["visual-preview", "media-metrics", "file-workspace"],
    requiredActions: ["download", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "image-alt", "item-state-text", "labelled-region"],
    requiredVariantStates: ["success", "warning"],
  },
  pdf: {
    requiredSlots: ["page-preview", "operation-summary", "file-workspace"],
    requiredActions: ["download", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "page-control", "item-state-text", "labelled-region"],
    requiredVariantStates: ["success", "partial"],
  },
  batch: {
    requiredSlots: ["batch-summary"],
    requiredActions: ["download-all", "retry", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "summary-status", "item-state-text", "labelled-region"],
    requiredVariantStates: ["success", "error", "cancelled", "unsupported"],
  },
  "reference-network": {
    requiredSlots: ["reference-provenance"],
    requiredActions: ["copy", "retry", "reset"],
    requiredStates: RESULT_V2_CONFORMANCE_STATES,
    requiredA11y: [...BASE_A11Y, "reference-time", "labelled-region"],
    requiredVariantStates: ["local-valid", "remote-valid", "remote-invalid", "stale", "unavailable"],
  },
} as const satisfies Record<ResultClass, ResultV2ClassContract>;

export interface ResultV2SemanticFixture {
  readonly class: ResultClass;
  readonly actionContext: ResultActionContext;
  readonly render: () => unknown;
}

export interface ResultV2ClassConformanceResult {
  readonly class: string;
  readonly slots: readonly string[];
  readonly actions: readonly ResultActionId[];
  readonly states: readonly ResultV2ConformanceState[];
  readonly a11y: readonly ResultV2A11yRequirement[];
}

export interface ResultV2ConformanceReport {
  readonly ok: true;
  readonly classes: readonly ResultV2ClassConformanceResult[];
}

interface ResolvedElement {
  readonly tag: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly ResolvedNode[];
}

type ResolvedNode = string | ResolvedElement;

interface RenderObservation {
  readonly slots: readonly string[];
  readonly actions: readonly ResultActionId[];
  readonly primaryActions: readonly ResultActionId[];
  readonly classMarkers: readonly string[];
  readonly resultPanelHasLiveRegion: boolean;
  readonly announcementKinds: readonly string[];
  readonly visibleStateCue: boolean;
  readonly hasStatusMark: boolean;
  readonly actionsKeyboardNamed: boolean;
  readonly hasFocusablePreview: boolean;
  readonly hasLabelledRegion: boolean;
  readonly hasImageAlt: boolean;
  readonly hasPageControl: boolean;
  readonly hasLabelledProgress: boolean;
  readonly hasItemStateText: boolean;
  readonly hasReferenceTime: boolean;
  readonly hasSummaryStatus: boolean;
  readonly primaryActionNamed: boolean;
  readonly variantStates: readonly string[];
}

function isVNode(value: unknown): value is { readonly type: unknown; readonly props: Readonly<Record<string, unknown>> } {
  return typeof value === "object" && value !== null && "type" in value && "props" in value;
}

function resolveNode(value: unknown): readonly ResolvedNode[] {
  if (value === null || value === undefined || value === false || value === true) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((entry) => resolveNode(entry));
  if (!isVNode(value)) return [];

  if (typeof value.type === "function") {
    const component = value.type as (props: Readonly<Record<string, unknown>>) => unknown;
    return resolveNode(component(value.props));
  }
  if (typeof value.type !== "string") return resolveNode(value.props.children);
  return [{
    tag: value.type,
    props: value.props,
    children: resolveNode(value.props.children),
  }];
}

function classesOf(element: ResolvedElement): readonly string[] {
  const value = element.props.class;
  return typeof value === "string" ? value.split(/\s+/u).filter(Boolean) : [];
}

function textOf(node: ResolvedNode): string {
  if (typeof node === "string") return node;
  return node.children.map((child) => textOf(child)).join("");
}

function descendants(nodes: readonly ResolvedNode[]): readonly ResolvedElement[] {
  const result: ResolvedElement[] = [];
  const visit = (node: ResolvedNode): void => {
    if (typeof node === "string") return;
    result.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

function observeRenderedFixture(rendered: unknown): RenderObservation {
  const roots = resolveNode(rendered);
  const elements = descendants(roots);
  const slots = elements
    .map((element) => element.props["data-result-slot"])
    .filter((value): value is string => typeof value === "string");
  const actions = elements
    .map((element) => element.props["data-result-action"])
    .filter((value): value is ResultActionId => typeof value === "string");
  const primaryActions = elements
    .filter((element) => element.props["data-primary-action"] === "true")
    .map((element) => element.props["data-result-action"])
    .filter((value): value is ResultActionId => typeof value === "string");
  const classMarkers = elements
    .map((element) => element.props["data-result-class"])
    .filter((value): value is string => typeof value === "string");
  const announcementKinds = elements
    .map((element) => element.props["data-result-announcement"])
    .filter((value): value is string => typeof value === "string");
  const resultPanels = elements.filter((element) => classesOf(element).includes("result-panel"));
  const stateCues = elements.filter((element) => typeof element.props["data-result-state"] === "string");
  const actionButtons = elements.filter((element) => typeof element.props["data-result-action"] === "string");
  const stateItems = elements.filter((element) => element.tag === "li" && typeof element.props["data-state"] === "string");
  const variantStates = [
    ...stateItems.map((element) => element.props["data-state"]),
    ...elements.map((element) => element.props["data-result-variant-state"]),
  ].filter((value): value is string => typeof value === "string");

  return {
    slots,
    actions,
    primaryActions,
    classMarkers,
    resultPanelHasLiveRegion: resultPanels.some((element) => element.props["aria-live"] !== undefined),
    announcementKinds,
    visibleStateCue: stateCues.some((element) => /Stato:/u.test(textOf(element))),
    hasStatusMark: elements.some((element) => element.tag === "svg" && typeof element.props["data-mark"] === "string"),
    actionsKeyboardNamed: actionButtons.every((element) => element.tag === "button"
      && element.props.type === "button"
      && typeof element.props["aria-label"] === "string"
      && (element.props["aria-label"] as string).trim() !== ""),
    hasFocusablePreview: elements.some((element) => element.props.tabIndex === 0),
    hasLabelledRegion: elements.some((element) => typeof element.props["aria-label"] === "string"
      && (element.tag === "section" || element.props.role === "region")),
    hasImageAlt: elements.some((element) => element.tag === "img"
      && typeof element.props.alt === "string"
      && (element.props.alt as string).trim() !== ""),
    hasPageControl: elements.some((element) => element.tag === "button"
      && element.props.type === "button"
      && element.props["data-page-preview-control"] === true),
    hasLabelledProgress: elements.some((element) => element.tag === "progress"
      && typeof element.props["aria-label"] === "string"
      && (element.props["aria-label"] as string).trim() !== ""),
    hasItemStateText: stateItems.some((element) => textOf(element).trim() !== ""),
    hasReferenceTime: elements.some((element) => element.tag === "time"
      && typeof element.props.dateTime === "string"
      && (element.props.dateTime as string).trim() !== ""),
    hasSummaryStatus: elements.some((element) => element.props.role === "status" && !classesOf(element).includes("visually-hidden")),
    primaryActionNamed: actionButtons
      .filter((element) => element.props["data-primary-action"] === "true")
      .every((element) => typeof element.props["aria-label"] === "string"
        && (element.props["aria-label"] as string).includes("azione principale")),
    variantStates,
  };
}

function hasOrderedSlots(observed: readonly string[], required: readonly string[]): boolean {
  let cursor = -1;
  for (const slot of required) {
    const index = observed.indexOf(slot, cursor + 1);
    if (index < 0) return false;
    cursor = index;
  }
  return true;
}

function checkA11y(requirement: ResultV2A11yRequirement, observation: RenderObservation): boolean {
  switch (requirement) {
    case "concise-announcement":
      return !observation.resultPanelHasLiveRegion
        && observation.announcementKinds.includes("polite")
        && observation.announcementKinds.includes("assertive");
    case "non-color-state-cue":
      return observation.visibleStateCue && observation.hasStatusMark;
    case "keyboard-actions":
      return observation.actions.length > 0 && observation.actionsKeyboardNamed && observation.primaryActionNamed;
    case "primary-answer-first":
      return observation.slots[0] === "primary";
    case "focusable-preview":
      return observation.hasFocusablePreview;
    case "labelled-region":
      return observation.hasLabelledRegion;
    case "image-alt":
      return observation.hasImageAlt;
    case "page-control":
      return observation.hasPageControl;
    case "progress-labelled":
      return observation.hasLabelledProgress;
    case "item-state-text":
      return observation.hasItemStateText;
    case "reference-time":
      return observation.hasReferenceTime;
    case "summary-status":
      return observation.hasSummaryStatus;
  }
}

export function assertResultV2SemanticConformance(
  fixtures: readonly ResultV2SemanticFixture[],
  declaredClasses: readonly string[] = RESULT_CLASSES,
): ResultV2ConformanceReport {
  const failures: string[] = [];
  const declared = [...declaredClasses];
  const declaredSet = new Set(declared);
  if (declaredSet.size !== declared.length) failures.push("manifest result classes contain duplicates");

  const fixtureMap = new Map<string, ResultV2SemanticFixture>();
  for (const fixture of fixtures) {
    if (fixtureMap.has(fixture.class)) failures.push(`${fixture.class}: duplicate semantic fixture`);
    fixtureMap.set(fixture.class, fixture);
  }
  for (const resultClass of declared) {
    if (!fixtureMap.has(resultClass)) failures.push(`${resultClass}: missing semantic fixture`);
    if (!(resultClass in RESULT_V2_CLASS_CONTRACTS)) failures.push(`${resultClass}: missing semantic contract`);
  }
  for (const fixtureClass of fixtureMap.keys()) {
    if (!declaredSet.has(fixtureClass)) failures.push(`${fixtureClass}: fixture is not declared by the manifest`);
  }

  const classes: ResultV2ClassConformanceResult[] = [];
  for (const resultClass of declared) {
    const fixture = fixtureMap.get(resultClass);
    const contract = RESULT_V2_CLASS_CONTRACTS[resultClass as ResultClass] as ResultV2ClassContract | undefined;
    if (fixture === undefined || contract === undefined) continue;
    if (fixture.actionContext.declaration.class !== resultClass) {
      failures.push(`${resultClass}: action declaration class does not match fixture class`);
    }

    const observation = observeRenderedFixture(fixture.render());
    if (observation.classMarkers.length !== 1 || observation.classMarkers[0] !== resultClass) {
      failures.push(`${resultClass}: rendered semantic class marker must appear exactly once`);
    }
    if (!hasOrderedSlots(observation.slots, contract.requiredSlots)) {
      failures.push(`${resultClass}: required semantic slots/order missing; expected ${contract.requiredSlots.join(" -> ")}, observed ${observation.slots.join(" -> ")}`);
    }

    let resolvedActions: readonly ResultActionId[] = [];
    try {
      resolvedActions = resolveResultActions(fixture.actionContext).map((action) => action.id);
    } catch (error) {
      failures.push(`${resultClass}: action resolution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (JSON.stringify(observation.actions) !== JSON.stringify(resolvedActions)) {
      failures.push(`${resultClass}: rendered actions do not match runtime resolution`);
    }
    for (const action of contract.requiredActions) {
      if (!resolvedActions.includes(action)) failures.push(`${resultClass}: required action ${action} is unavailable`);
    }
    if (resolvedActions.length > 0 && observation.primaryActions.length !== 1) {
      failures.push(`${resultClass}: representative fixture must expose exactly one explicit primary action`);
    }

    const stateLabels = new Set<string>();
    const stateAnnouncements = new Set<string>();
    for (const state of contract.requiredStates) {
      const descriptor = resultAccessibilityFor(state);
      if (descriptor === null || descriptor.label.trim() === "" || descriptor.announcement.trim() === "") {
        failures.push(`${resultClass}: state ${state} lacks shared accessible semantics`);
      } else {
        stateLabels.add(descriptor.label);
        stateAnnouncements.add(descriptor.announcement);
      }
      if (state === "error" && descriptor?.priority !== "assertive") {
        failures.push(`${resultClass}: error state must remain assertive`);
      }
    }
    if (stateLabels.size !== contract.requiredStates.length || stateAnnouncements.size !== contract.requiredStates.length) {
      failures.push(`${resultClass}: required operation states must have distinct accessible labels and announcements`);
    }

    for (const requirement of contract.requiredA11y) {
      if (!checkA11y(requirement, observation)) {
        failures.push(`${resultClass}: accessibility requirement ${requirement} is not observable`);
      }
    }

    for (const variant of contract.requiredVariantStates ?? []) {
      if (!observation.variantStates.includes(variant)) {
        failures.push(`${resultClass}: required semantic variant state ${variant} is not covered`);
      }
    }

    classes.push({
      class: resultClass,
      slots: observation.slots,
      actions: resolvedActions,
      states: contract.requiredStates,
      a11y: contract.requiredA11y,
    });
  }

  if (failures.length > 0) {
    throw new Error(`Result v2 semantic conformance failed:\n- ${failures.join("\n- ")}`);
  }
  return { ok: true, classes };
}
