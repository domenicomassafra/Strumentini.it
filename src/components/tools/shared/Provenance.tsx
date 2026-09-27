import type { ComponentChildren } from "preact";
import type { DefaultProvenance } from "../../../runtime/types";

const PROVENANCE_LABELS: Readonly<Record<DefaultProvenance, string>> = {
  explicit: "Sovrascrittura per questa attività",
  profile: "Valore predefinito dal profilo",
  "tool-default": "Valore predefinito dello strumento",
  "system-derived": "Derivato dal sistema",
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
  profileLabel = "Valore predefinito dal profilo",
  overrideLabel = "Sovrascrittura per questa attività",
  loadingLabel = "Caricamento del profilo…",
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
  children = "Usa il valore del profilo",
}: ProfileResetButtonProps) {
  return (
    <button class="text-button" type="button" disabled={disabled} onClick={onReset}>
      {children}
    </button>
  );
}
