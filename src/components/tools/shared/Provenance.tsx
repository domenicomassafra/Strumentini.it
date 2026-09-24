import type { ComponentChildren } from "preact";
import type { DefaultProvenance } from "../../../runtime/types";

const PROVENANCE_LABELS: Readonly<Record<DefaultProvenance, string>> = {
  explicit: "Current task override",
  profile: "Work Profile default",
  "tool-default": "Tool default",
  "system-derived": "System derived",
};

export interface ProvenanceBadgeProps {
  provenance: DefaultProvenance;
  labels?: Partial<Record<DefaultProvenance, string>>;
}

export function ProvenanceBadge({ provenance, labels = {} }: ProvenanceBadgeProps) {
  return <span class="provenance">{labels[provenance] ?? PROVENANCE_LABELS[provenance]}</span>;
}

export interface ProfileOverrideHintProps {
  id?: string;
  ready: boolean;
  overridden: boolean;
  profileLabel?: string;
  overrideLabel?: string;
  loadingLabel?: string;
}

export function ProfileOverrideHint({
  id,
  ready,
  overridden,
  profileLabel = "Work Profile default",
  overrideLabel = "Current task override",
  loadingLabel = "Loading Work Profile…",
}: ProfileOverrideHintProps) {
  const label = !ready && !overridden
    ? loadingLabel
    : overridden
      ? overrideLabel
      : profileLabel;
  return <small id={id}>{label}</small>;
}

export interface ProfileResetButtonProps {
  onReset: () => void;
  disabled?: boolean;
  children?: ComponentChildren;
}

export function ProfileResetButton({
  onReset,
  disabled = false,
  children = "Use Work Profile default",
}: ProfileResetButtonProps) {
  return (
    <button class="text-button" type="button" disabled={disabled} onClick={onReset}>
      {children}
    </button>
  );
}
