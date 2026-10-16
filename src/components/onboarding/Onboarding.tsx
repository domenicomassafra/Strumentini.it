/**
 * Onboarding — four steps, one card.
 *
 * 1. Benvenuto: the mark, what happens next, one action.
 * 2. Cosa vuoi fare? — the work-context packs, at most three.
 * 3. Quali categorie usi di più? — the recurring jobs, unlimited.
 * 4. Ecco i tuoi strumenti consigliati! — the reviewable starter set.
 *
 * The work profile is no longer collected here: /impostazioni/ owns it under
 * Preferenze. The save still writes a complete profile, so a tool that declares
 * a field never asks the same question twice. The answers are drafted into the
 * same local database as the workbench, so re-entering the flow pre-fills
 * instead of starting over — and nothing in it ever leaves the device.
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { toneForCategory } from "../../catalog/groups";
import type { ToolSummary } from "../../catalog/manifest";
import {
  RECURRING_JOBS,
  RECURRING_JOB_IDS,
  WORK_CONTEXT_IDS,
  WORK_CONTEXT_PACKS,
  type RecurringJobId,
  type WorkContextId,
} from "../../onboarding/contexts";
import type { GoldQualityIndex } from "../../onboarding/quality";
import {
  addStarterAlternative,
  findStarterAlternatives,
  MAX_STARTER_TOOLS,
  resolveStarter,
  toggleStarterTool,
  type StarterReview,
} from "../../onboarding/recommendations";
import { createIndexedDbPersistence, type PersistenceAdapter } from "../../persistence/persistence";
import { createDefaultWorkProfile, type WorkProfile } from "../../profile/work-profile";
import { iconSvgMarkup, toolIconSvg, type ToolIconKey } from "../../ui/tool-icons";
import { createWorkbenchRepository } from "../../workbench/repository";
import { applyStarterSelection, createDefaultWorkbenchState, type WorkbenchState } from "../../workbench/state";
import { COPY } from "../workbench/copy";
import styles from "./Onboarding.module.css";

export interface OnboardingProps {
  readonly tools: readonly ToolSummary[];
  readonly quality: GoldQualityIndex;
}

type OnboardingStage = 1 | 2 | 3 | 4;

const STAGES = [1, 2, 3, 4] as const;

/** The packs are a signal, not a filing cabinet: three is the ceiling. */
const MAX_CONTEXTS = 3;

/** The draft key sits beside the workbench state in the same local database. */
const DRAFT_KEY = "onboarding/answers:v1";

/**
 * The glyph on a context card, keyed by what the pack actually covers. Icons
 * carry no claim: the label and the description next to them do.
 */
const CONTEXT_ICONS: Readonly<Record<WorkContextId, ToolIconKey>> = {
  "client-services": "calculator",
  "marketing-growth": "chart",
  "data-cleanup": "table",
  "research-evidence": "research",
  "file-asset-handoff": "archive",
};

const JOB_ICONS: Readonly<Record<RecurringJobId, ToolIconKey>> = {
  "clean-tables": "table",
  "compare-text": "compare",
  "plan-dates": "calendar",
  "build-links": "link",
  "calculate-client-work": "calculator",
  "prepare-handoffs": "folder",
  "research-citations": "research",
  "inspect-files": "hash",
};

interface OnboardingDraft {
  readonly version: 1;
  readonly contextIds: readonly WorkContextId[];
  readonly jobIds: readonly RecurringJobId[];
}

function serverSafeProfile(): WorkProfile {
  return createDefaultWorkProfile({ locale: "it-IT", timezone: "UTC" });
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "it-IT",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

/** The tile ink is the tone wheel, consumed from the token sheet. */
function tileStyle(tone: number): string {
  return `--tile-tone: var(--tone-${tone})`;
}

/**
 * A saved starter set records its work contexts as workbench pack tags, so the
 * context step can be pre-filled from state written before the draft existed.
 */
function contextIdsFromPacks(packs: readonly string[]): readonly WorkContextId[] {
  return WORK_CONTEXT_IDS.filter((id) => packs.includes(id)).slice(0, MAX_CONTEXTS);
}

/** Fail closed: only ids this build knows survive a stored draft. */
function normalizeDraft(value: unknown): OnboardingDraft | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const storedContexts = Array.isArray(record.contextIds) ? record.contextIds : [];
  const storedJobs = Array.isArray(record.jobIds) ? record.jobIds : [];
  return {
    version: 1,
    contextIds: WORK_CONTEXT_IDS.filter((id) => storedContexts.includes(id)).slice(0, MAX_CONTEXTS),
    jobIds: RECURRING_JOB_IDS.filter((id) => storedJobs.includes(id)),
  };
}

async function readDraft(persistence: PersistenceAdapter): Promise<OnboardingDraft | undefined> {
  try {
    return normalizeDraft(await persistence.get<unknown>(DRAFT_KEY));
  } catch {
    return undefined;
  }
}

async function writeDraft(persistence: PersistenceAdapter, draft: OnboardingDraft): Promise<void> {
  try {
    await persistence.put(DRAFT_KEY, draft);
  } catch {
    // A draft that cannot be written is not a saved answer: the save action is
    // the only write that reports success or failure to the user.
  }
}

export function Onboarding({ tools, quality }: OnboardingProps) {
  const [stage, setStage] = useState<OnboardingStage>(1);
  const [contextIds, setContextIds] = useState<readonly WorkContextId[]>([]);
  const [jobIds, setJobIds] = useState<readonly RecurringJobId[]>([]);
  const [profile, setProfile] = useState<WorkProfile>(serverSafeProfile);
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState>(() => createDefaultWorkbenchState(serverSafeProfile()));
  const [review, setReview] = useState<StarterReview | null>(null);
  const [alternativeQuery, setAlternativeQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [completed, setCompleted] = useState(false);
  const repositoryRef = useRef<ReturnType<typeof createWorkbenchRepository> | null>(null);
  const draftRef = useRef<PersistenceAdapter | null>(null);

  useEffect(() => {
    const initialProfile = browserProfile();
    const initial = createDefaultWorkbenchState(initialProfile);
    const repository = createWorkbenchRepository(createIndexedDbPersistence(), initial);
    const draftPersistence = createIndexedDbPersistence();
    repositoryRef.current = repository;
    draftRef.current = draftPersistence;
    let cancelled = false;
    void (async () => {
      const [loaded, draft] = await Promise.all([repository.load(), readDraft(draftPersistence)]);
      if (cancelled) return;
      setWorkbenchState(loaded.state);
      setProfile(loaded.state.profile);
      setContextIds(draft !== undefined && draft.contextIds.length > 0 ? draft.contextIds : contextIdsFromPacks(loaded.state.packs));
      setJobIds(draft?.jobIds ?? []);
      setWarning(loaded.warning ?? "");
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const persistence = draftRef.current;
    if (persistence === null) return;
    void writeDraft(persistence, { version: 1, contextIds, jobIds });
  }, [ready, contextIds, jobIds]);

  const generatedReview = useMemo(() => resolveStarter({ contextIds, recurringJobIds: jobIds }, tools, quality), [contextIds, jobIds, tools, quality]);
  const alternatives = useMemo(
    () => findStarterAlternatives(
      alternativeQuery,
      tools,
      quality,
      review?.selectedToolIds ?? [],
      8,
      review?.recommendations.map(({ tool }) => tool.id) ?? [],
    ),
    [alternativeQuery, tools, quality, review?.selectedToolIds, review?.recommendations],
  );

  function toggleContext(id: WorkContextId): void {
    setContextIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= MAX_CONTEXTS) return current;
      return [...current, id];
    });
  }

  function toggleJob(id: RecurringJobId): void {
    setJobIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function goTo(next: OnboardingStage): void {
    if (next === 4) setReview(generatedReview);
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateReview(next: StarterReview): void {
    setReview(next);
  }

  async function acceptStarter(): Promise<void> {
    if (review === null || review.selectedToolIds.length === 0 || repositoryRef.current === null) return;
    setSaving(true);
    const next = applyStarterSelection(workbenchState, review.selectedToolIds, profile, review.contextIds);
    const result = await repositoryRef.current.save(next);
    setSaving(false);
    if (!result.persisted) {
      setWarning(result.warning ?? "La configurazione iniziale è pronta, ma questo browser non è riuscito a salvarla.");
      return;
    }
    setCompleted(true);
    window.location.assign("/");
  }

  const selectedCount = review?.selectedToolIds.length ?? 0;
  const contextsFull = contextIds.length >= MAX_CONTEXTS;
  const contextSummary = WORK_CONTEXT_PACKS.filter(({ id }) => contextIds.includes(id)).map(({ label }) => label).join(" + ");

  return (
    <div class={styles.shell} data-ready={ready ? "true" : "false"} data-stage={stage} data-saving={saving ? "true" : "false"}>
      <div class={styles.column}>
        {warning !== "" && (
          <div class="warning" role="status">
            <strong>{COPY.onboarding.storageWarning}</strong> {warning}
          </div>
        )}

        <section class={`card ${styles.panel}`} aria-busy={saving}>
          {/*
            Progress is a real index: a track whose filled segments grow with the
            step, plus the count in plain words. Reached steps stay navigable.
          */}
          <div class={styles.progress}>
            <ol class={styles.steps} aria-label={COPY.onboarding.progressLabel}>
              {STAGES.map((number) => (
                <li key={number}>
                  <button
                    class={`${styles.step} ${number < stage ? styles.stepDone : ""} ${number === stage ? styles.stepCurrent : ""}`}
                    type="button"
                    aria-label={COPY.onboarding.steps[number]}
                    aria-current={number === stage ? "step" : undefined}
                    disabled={number > stage}
                    onClick={() => goTo(number)}
                  />
                </li>
              ))}
            </ol>
            <span class={styles.progressCount}>{COPY.onboarding.stepCount(stage)}</span>
          </div>

          {stage === 1 && (
            <div class={styles.welcome}>
              <span class={styles.mark}>
                <svg viewBox="0 0 32 32" width="56" height="56" role="presentation" aria-hidden="true" focusable="false">
                  <polygon class={styles.markTop} points="16 2.5 29 10 16 17.5 3 10" />
                  <polygon class={styles.markLeft} points="3 10 16 17.5 16 30.5 3 23" />
                  <polygon class={styles.markRight} points="16 17.5 29 10 29 23 16 30.5" />
                </svg>
              </span>
              <h1 id="welcome-title" class={styles.welcomeTitle}>{COPY.onboarding.title}</h1>
              <p class={styles.welcomeLede}>{COPY.onboarding.lede}</p>
              <p class={styles.muted}>In 4 passaggi scegli cosa fai, ricevi strumenti consigliati e salvi la selezione su questo dispositivo. Puoi cambiarla in seguito.</p>
              <div class={styles.actions}>
                <button class="btn btn-primary btn-lg" type="button" data-onboarding-action="start" onClick={() => goTo(2)}>
                  {COPY.onboarding.start}
                </button>
                <a class={styles.skipLink} href="/strumenti/">{COPY.onboarding.skip}</a>
              </div>
            </div>
          )}

          {stage === 2 && (
            <div class={styles.stepBody} aria-labelledby="context-title">
              <div class={styles.stepHead}>
                <h2 id="context-title">{COPY.onboarding.prompts[2]}</h2>
                <span class={styles.counter}>{COPY.onboarding.counters.context(contextIds.length)}</span>
              </div>
              <p class={styles.muted}>{COPY.onboarding.hints[2]}</p>
              <div class={styles.optionGrid}>
                {WORK_CONTEXT_PACKS.map((pack, index) => {
                  const selected = contextIds.includes(pack.id);
                  const blocked = !selected && contextsFull;
                  return (
                    <label
                      class={styles.option}
                      key={pack.id}
                      data-context-id={pack.id}
                      data-selected={selected ? "true" : "false"}
                      data-blocked={blocked ? "true" : "false"}
                    >
                      <input
                        class={styles.optionInput}
                        type="checkbox"
                        checked={selected}
                        disabled={blocked}
                        onChange={() => toggleContext(pack.id)}
                      />
                      <span
                        class="icon-tile"
                        style={tileStyle(index + 1)}
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: iconSvgMarkup(CONTEXT_ICONS[pack.id]) }}
                      />
                      <span class={styles.optionText}>
                        <strong>{pack.label}</strong>
                        <small>{pack.description}</small>
                      </span>
                      <span class={styles.check} aria-hidden="true" />
                    </label>
                  );
                })}
              </div>
              <div class={styles.actions}>
                <button class="btn btn-ghost" type="button" onClick={() => goTo(1)}>{COPY.onboarding.back}</button>
                <button
                  class="btn btn-primary"
                  type="button"
                  data-onboarding-action="continue-context"
                  disabled={contextIds.length === 0}
                  onClick={() => goTo(3)}
                >
                  {COPY.onboarding.nextJobs}
                </button>
              </div>
            </div>
          )}

          {stage === 3 && (
            <div class={styles.stepBody} aria-labelledby="jobs-title">
              <div class={styles.stepHead}>
                <h2 id="jobs-title">{COPY.onboarding.prompts[3]}</h2>
                <span class={styles.counter}>{COPY.onboarding.counters.jobs(jobIds.length)}</span>
              </div>
              <p class={styles.muted}>{COPY.onboarding.hints[3]}</p>
              <div class={styles.optionGrid}>
                {RECURRING_JOBS.map((job, index) => {
                  const selected = jobIds.includes(job.id);
                  return (
                    <label class={styles.option} key={job.id} data-job-id={job.id} data-selected={selected ? "true" : "false"}>
                      <input class={styles.optionInput} type="checkbox" checked={selected} onChange={() => toggleJob(job.id)} />
                      <span
                        class="icon-tile"
                        style={tileStyle(index + 1)}
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: iconSvgMarkup(JOB_ICONS[job.id]) }}
                      />
                      <span class={styles.optionText}>
                        <strong>{job.label}</strong>
                        <small>{COPY.onboarding.jobSignals(job.matchTerms.slice(0, 4).join(" · "))}</small>
                      </span>
                      <span class={styles.check} aria-hidden="true" />
                    </label>
                  );
                })}
              </div>
              <div class={styles.actions}>
                <button class="btn btn-ghost" type="button" onClick={() => goTo(2)}>{COPY.onboarding.back}</button>
                <button class="btn btn-primary" type="button" data-onboarding-action="continue-jobs" onClick={() => goTo(4)}>
                  {COPY.onboarding.nextReview}
                </button>
              </div>
            </div>
          )}

          {stage === 4 && review !== null && (
            <div class={styles.stepBody} aria-labelledby="review-title" data-starter-selected={selectedCount}>
              <div class={styles.stepHead}>
                <h2 id="review-title">{COPY.onboarding.prompts[4]}</h2>
                <span class={styles.counter}>{COPY.onboarding.verifiedCount(quality.tools.length)}</span>
              </div>
              <p class={styles.muted}>{contextSummary} · {selectedCount}/{MAX_STARTER_TOOLS}</p>
              <p class={styles.muted}>{COPY.onboarding.hints[4]}</p>
              <div class={styles.reviewLayout}>
                <ul class={styles.reviewList}>
                  {review.recommendations.map((item) => {
                    const selected = review.selectedToolIds.includes(item.tool.id);
                    return (
                      <li
                        key={item.tool.id}
                        class={styles.reviewRow}
                        data-starter-tool-id={item.tool.id}
                        data-reason-code={item.reasonCode}
                        data-pack-context={review.contextIds.join(" ")}
                        data-quality={item.quality}
                        data-selected={selected ? "true" : "false"}
                      >
                        <label class={styles.reviewCheck}>
                          <input
                            class={styles.optionInput}
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => updateReview(toggleStarterTool(review, item.tool.id, event.currentTarget.checked))}
                          />
                          <span class={styles.check} aria-hidden="true" />
                          <span
                            class={`icon-tile ${styles.rowTile}`}
                            style={tileStyle(toneForCategory(item.tool.category))}
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: toolIconSvg(item.tool) }}
                          />
                          <span class={styles.rowText}>
                            <strong>{item.tool.name}</strong>
                            <small>{item.tool.summary}</small>
                            <span class={styles.reason} data-starter-reason>{item.reason}</span>
                          </span>
                        </label>
                        <span class={item.quality === "gold" ? "pill pill-success" : "pill"}>
                          {item.quality === "gold" ? COPY.onboarding.verifiedBadge : COPY.onboarding.manualBadge}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <aside class={styles.alternativePanel} aria-labelledby="alternative-title">
                  <h3 id="alternative-title">{COPY.onboarding.alternativesTitle}</h3>
                  <p class={styles.muted}>{COPY.onboarding.searchHint}</p>
                  <label class={styles.searchLabel}>
                    <span>{COPY.onboarding.searchCatalog}</span>
                    <input
                      class={styles.searchInput}
                      type="search"
                      value={alternativeQuery}
                      onInput={(event) => setAlternativeQuery(event.currentTarget.value)}
                      placeholder={COPY.onboarding.searchPlaceholder}
                    />
                  </label>
                  <ul class={styles.alternativeList}>
                    {alternativeQuery.trim() === "" ? (
                      <li class={styles.noResults}>{COPY.onboarding.noResultsQuery}</li>
                    ) : alternatives.length === 0 ? (
                      <li class={styles.noResults}>{COPY.onboarding.noMatch}</li>
                    ) : alternatives.map((item) => (
                      <li key={item.tool.id}>
                        <span>
                          <strong>{item.tool.name}</strong>
                          <small>{item.reason}</small>
                        </span>
                        <button
                          class="btn"
                          type="button"
                          onClick={() => updateReview(addStarterAlternative(review, item.tool, quality))}
                          disabled={review.selectedToolIds.length >= MAX_STARTER_TOOLS}
                        >
                          {COPY.onboarding.add}
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
              <div class={styles.actions}>
                <button class="btn btn-ghost" type="button" onClick={() => goTo(3)}>{COPY.onboarding.back}</button>
                <button
                  class="btn btn-primary"
                  type="button"
                  data-onboarding-action="save"
                  disabled={!ready || selectedCount === 0 || saving || completed}
                  onClick={() => void acceptStarter()}
                >
                  {saving ? COPY.onboarding.saving : COPY.onboarding.save}
                </button>
              </div>
              {completed && <div class={styles.panel} role="status">
                <p class="success">{COPY.onboarding.saved}</p>
                <div class={styles.actions}>
                  <a class="btn btn-primary" href="/strumenti/">Apri gli strumenti</a>
                  <a class="btn btn-ghost" href="/impostazioni/#preferenze">Personalizza le preferenze</a>
                </div>
              </div>}
            </div>
          )}
        </section>

        <p class={styles.footnote}>{COPY.onboarding.footnote}</p>
      </div>
    </div>
  );
}
