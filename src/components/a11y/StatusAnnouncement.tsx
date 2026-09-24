import { useId, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { normalizeAnnouncement, statusRegionAttributes, type AnnouncementPoliteness } from "./accessibility";
import styles from "./primitives.module.css";

export interface StatusAnnouncementProps {
  readonly message: string;
  readonly politeness?: AnnouncementPoliteness;
  readonly label?: string;
  readonly visible?: boolean;
  readonly id?: string;
}

export function StatusAnnouncement({
  message,
  politeness = "polite",
  label,
  visible = false,
  id,
}: StatusAnnouncementProps) {
  const generatedId = useId();
  const previousKey = useRef<string | null>(null);
  const normalized = normalizeAnnouncement(message);
  const key = normalized === "" ? "" : `${politeness}:${normalized}`;
  const announcement = key !== previousKey.current ? normalized : "";
  previousKey.current = key;
  const regionId = id !== undefined && id.trim() !== "" ? id : `a11y-status-${generatedId}`;
  const attributes = statusRegionAttributes(regionId, politeness);
  const accessibleLabel = label !== undefined && label.trim() !== "" ? label : undefined;
  return (
    <p
      id={attributes.id}
      class={visible ? styles.status : styles.srOnly}
      role={attributes.role}
      aria-live={attributes["aria-live"]}
       aria-atomic={attributes["aria-atomic"]}
       aria-relevant="additions text"
       aria-label={accessibleLabel}

    >
      {announcement}
    </p>
  );
}

export interface ResultPanelProps {
  readonly title: string;
  readonly titleId: string;
  readonly announcement?: string;
  readonly busy?: boolean;
  readonly children: ComponentChildren;
}

export function ResultPanel({ title, titleId, announcement = "", busy = false, children }: ResultPanelProps) {
  return (
    <section class={styles.result} aria-labelledby={titleId} aria-busy={busy ? "true" : "false"}>
      <h2 id={titleId}>{title}</h2>
      <StatusAnnouncement message={announcement} />
      {children}
    </section>
  );
}

export interface ErrorMessageProps {
  readonly children: ComponentChildren;
  readonly id?: string;
}

export function ErrorMessage({ children, id }: ErrorMessageProps) {
  return <p id={id} class={styles.error} role="alert" aria-atomic="true">{children}</p>;
}
