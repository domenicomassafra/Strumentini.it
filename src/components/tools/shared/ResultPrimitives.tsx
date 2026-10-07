import type { ComponentChildren } from "preact";

export interface ResultPrimaryAnswerProps {
  readonly label?: string;
  readonly children: ComponentChildren;
  readonly unit?: ComponentChildren;
}

export function ResultPrimaryAnswer({ label = "Risultato", children, unit }: ResultPrimaryAnswerProps) {
  return (
    <div class="result-primary-answer" data-result-primary-answer>
      <p class="gutter-label">{label}</p>
      <output class="gutter-value">
        {children}
        {unit === undefined ? null : <> <span class="gutter-unit">{unit}</span></>}
      </output>
    </div>
  );
}

export interface ResultInterpretationProps {
  readonly children: ComponentChildren;
  readonly state?: "success" | "warning" | "error" | "info";
}

export function ResultInterpretation({ children, state = "info" }: ResultInterpretationProps) {
  return <p class="gutter-note" data-state={state}>{children}</p>;
}

export interface ResultDetailRow {
  readonly label: ComponentChildren;
  readonly value: ComponentChildren;
}

export interface ResultBreakdownProps {
  readonly rows: readonly ResultDetailRow[];
  readonly label?: string;
}

export function ResultBreakdown({ rows, label = "Dettaglio" }: ResultBreakdownProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={label}>
      <dl class="gutter-rows">
        {rows.map((row, index) => (
          <div key={index}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export interface ResultAssumption {
  readonly label: ComponentChildren;
  readonly value: ComponentChildren;
}

export interface ResultAssumptionsProps {
  readonly items: readonly ResultAssumption[];
  readonly label?: string;
}

export function ResultAssumptions({ items, label = "Ipotesi usate" }: ResultAssumptionsProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label}>
      <dl class="assumptions">
        {items.map((item, index) => (
          <div key={index}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export interface ResultProvenanceProps {
  readonly children: ComponentChildren;
  readonly label?: string;
}

export function ResultProvenance({ children, label = "Provenienza" }: ResultProvenanceProps) {
  return <p class="provenance"><span class="visually-hidden">{label}: </span>{children}</p>;
}

export interface ResultExplanationProps {
  readonly primary: ComponentChildren;
  readonly interpretation?: ComponentChildren;
  readonly breakdown?: ComponentChildren;
  readonly assumptions?: ComponentChildren;
  readonly provenance?: ComponentChildren;
}

/** Keeps the primary answer first in semantic reading order on every viewport. */
export function ResultExplanation({
  primary,
  interpretation,
  breakdown,
  assumptions,
  provenance,
}: ResultExplanationProps) {
  return (
    <div class="result-explanation">
      {primary}
      {interpretation}
      {breakdown}
      {assumptions}
      {provenance}
    </div>
  );
}
