import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ToolSummary } from "../../catalog/manifest";
import { createIndexedDbPersistence } from "../../persistence/persistence";
import {
  createDefaultWorkProfile,
  type DayCode,
  type WorkProfile,
  updateWorkProfile,
} from "../../profile/work-profile";
import { createWorkbenchRepository } from "../../workbench/repository";
import { applyStarterSelection, createDefaultWorkbenchState, type WorkbenchState } from "../../workbench/state";
import {
  RECURRING_JOBS,
  WORK_CONTEXT_PACKS,
  type RecurringJobId,
  type WorkContextId,
} from "../../onboarding/contexts";
import {
  addStarterAlternative,
  findStarterAlternatives,
  MAX_STARTER_TOOLS,
  resolveStarter,
  toggleStarterTool,
  type StarterReview,
} from "../../onboarding/recommendations";
import type { GoldQualityIndex } from "../../onboarding/quality";
import { COPY, WEEKDAYS, stageIndexLabel } from "../workbench/copy";
import styles from "./Onboarding.module.css";

export interface OnboardingProps {
  readonly tools: readonly ToolSummary[];
  readonly quality: GoldQualityIndex;
}

type OnboardingStage = 1 | 2 | 3 | 4;

const DAYS: ReadonlyArray<DayCode> = WEEKDAYS.map(({ code }) => code);

function serverSafeProfile(): WorkProfile {
  return createDefaultWorkProfile({ locale: "it-IT", timezone: "UTC" });
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "it-IT",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

export function Onboarding({ tools, quality }: OnboardingProps) {
  const [stage, setStage] = useState<OnboardingStage>(1);
  const [contextIds, setContextIds] = useState<readonly WorkContextId[]>([]);
  const [jobIds, setJobIds] = useState<readonly RecurringJobId[]>([]);
  const [profileDraft, setProfileDraft] = useState<WorkProfile>(serverSafeProfile);
  const [workbenchState, setWorkbenchState] = useState<WorkbenchState>(() => createDefaultWorkbenchState(serverSafeProfile()));
  const [review, setReview] = useState<StarterReview | null>(null);
  const [alternativeQuery, setAlternativeQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [completed, setCompleted] = useState(false);
  const repositoryRef = useRef<ReturnType<typeof createWorkbenchRepository> | null>(null);

  useEffect(() => {
    const initialProfile = browserProfile();
    const initial = createDefaultWorkbenchState(initialProfile);
    const repository = createWorkbenchRepository(createIndexedDbPersistence(), initial);
    repositoryRef.current = repository;
    void repository.load().then((loaded) => {
      setWorkbenchState(loaded.state);
      setProfileDraft(loaded.state.profile);
      setWarning(loaded.warning ?? "");
      setReady(true);
    });
  }, []);

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
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  function toggleJob(id: RecurringJobId): void {
    setJobIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function setProfile<K extends keyof WorkProfile>(key: K, value: WorkProfile[K]): void {
    setProfileDraft((current) => updateWorkProfile(current, { [key]: value }));
  }

  function toggleDay(day: DayCode): void {
    const selected = new Set(profileDraft.workweek);
    if (selected.has(day)) selected.delete(day);
    else selected.add(day);
    const ordered = DAYS.filter((code) => selected.has(code));
    if (ordered.length > 0) setProfile("workweek", ordered);
  }

  function beginReview(): void {
    setReview(generatedReview);
    setStage(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateReview(next: StarterReview): void {
    setReview(next);
  }

  async function acceptStarter(): Promise<void> {
    if (review === null || review.selectedToolIds.length === 0 || repositoryRef.current === null) return;
    setSaving(true);
    const next = applyStarterSelection(workbenchState, review.selectedToolIds, profileDraft, review.contextIds);
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
  const contextSummary = WORK_CONTEXT_PACKS.filter(({ id }) => contextIds.includes(id)).map(({ label }) => label).join(" + ");
  const canContinue = stage === 1 ? contextIds.length > 0 : true;

  return (
    <div class={styles.shell} data-ready={ready ? "true" : "false"} data-saving={saving ? "true" : "false"} aria-busy={saving}>
      <header class={styles.intro}>
        <h1>{COPY.onboarding.title}</h1>
        <p>{COPY.onboarding.lede}</p>
        <a class={styles.skipLink} href="/library/">{COPY.onboarding.skip}</a>
      </header>

      {warning !== "" && (
        <div class={styles.warning} role="status">
          <strong>{COPY.onboarding.storageWarning}</strong>
          <span>{warning}</span>
        </div>
      )}

      {/*
        The stage counter is a real index: a numbered ruled strip, not an
        uppercase eyebrow repeated above every heading. Position is readable
        at a glance, and reached stages are navigable.
      */}
      <ol class={styles.stageIndex} aria-label={COPY.onboarding.title}>
        {([1, 2, 3, 4] as const).map((number) => (
          <li key={number}>
            <button
              type="button"
              aria-current={number === stage ? "step" : undefined}
              onClick={() => {
                if (number < stage) setStage(number);
              }}
              disabled={number > stage}
            >
              <span class={styles.index}>{stageIndexLabel(number)}</span>
              {COPY.onboarding.stages[number]}
            </button>
          </li>
        ))}
      </ol>

      {stage === 1 && (
        <section class={styles.stage} aria-labelledby="context-title">
          <div class={styles.stageHeading}>
            <h2 id="context-title">{COPY.onboarding.prompts[1]}</h2>
            <span class={styles.counter}>{COPY.onboarding.counters.context(contextIds.length)}</span>
          </div>
          <p class={styles.muted}>{COPY.onboarding.hints[1]}</p>
          <div class={styles.choiceGrid}>
            {WORK_CONTEXT_PACKS.map((pack) => (
              <label class={styles.choice} key={pack.id} data-context-id={pack.id}>
                <input type="checkbox" checked={contextIds.includes(pack.id)} onChange={() => toggleContext(pack.id)} />
                <span><strong>{pack.label}</strong><small>{pack.description}</small></span>
              </label>
            ))}
          </div>
          <div class={styles.actions}>
            <button class={styles.primary} type="button" data-onboarding-action="continue-context" disabled={!canContinue} onClick={() => setStage(2)}>
              {COPY.onboarding.continue}
            </button>
            <a href="/library/">{COPY.yourTools.browseLibrary}</a>
          </div>
        </section>
      )}

      {stage === 2 && (
        <section class={styles.stage} aria-labelledby="jobs-title">
          <div class={styles.stageHeading}>
            <h2 id="jobs-title">{COPY.onboarding.prompts[2]}</h2>
            <span class={styles.counter}>{COPY.onboarding.counters.jobs(jobIds.length)}</span>
          </div>
          <p class={styles.muted}>{COPY.onboarding.hints[2]}</p>
          <div class={styles.choiceGrid}>
            {RECURRING_JOBS.map((job) => (
              <label class={styles.choice} key={job.id}>
                <input type="checkbox" checked={jobIds.includes(job.id)} onChange={() => toggleJob(job.id)} />
                <span><strong>{job.label}</strong><small>{COPY.onboarding.jobLabel}</small></span>
              </label>
            ))}
          </div>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(1)}>{COPY.onboarding.back}</button>
            <button class={styles.primary} type="button" data-onboarding-action="continue-jobs" onClick={() => setStage(3)}>{COPY.onboarding.continue}</button>
          </div>
        </section>
      )}

      {stage === 3 && (
        <section class={styles.stage} aria-labelledby="defaults-title">
          <div class={styles.stageHeading}>
            <h2 id="defaults-title">{COPY.onboarding.prompts[3]}</h2>
            <span class={styles.localBadge}>{COPY.workProfile.storedLocally}</span>
          </div>
          <p class={styles.muted}>{COPY.onboarding.hints[3]}</p>
          <div class={styles.profileGrid}>
            <label><span>{COPY.workProfile.fields.locale}</span><input name="locale" value={profileDraft.locale} onInput={(event) => setProfile("locale", event.currentTarget.value)} /></label>
            <label><span>{COPY.workProfile.fields.timezone}</span><input name="timezone" value={profileDraft.timezone} onInput={(event) => setProfile("timezone", event.currentTarget.value)} /></label>
            <label><span>{COPY.workProfile.fields.currency}</span><input name="currency" value={profileDraft.currency} onInput={(event) => setProfile("currency", event.currentTarget.value.toUpperCase())} /></label>
            <label><span>{COPY.workProfile.fields.dateFormat}</span><select name="dateFormat" value={profileDraft.dateFormat} onChange={(event) => setProfile("dateFormat", event.currentTarget.value as WorkProfile["dateFormat"])}><option value="system">{COPY.workProfile.options.system}</option><option value="day-first">{COPY.workProfile.options.dayFirst}</option><option value="month-first">{COPY.workProfile.options.monthFirst}</option></select></label>
            <label><span>{COPY.workProfile.fields.numberFormat}</span><select value={profileDraft.numberFormat} onChange={(event) => setProfile("numberFormat", event.currentTarget.value as WorkProfile["numberFormat"])}><option value="system">{COPY.workProfile.options.system}</option><option value="decimal-comma">{COPY.workProfile.options.decimalComma}</option><option value="decimal-point">{COPY.workProfile.options.decimalPoint}</option></select></label>
            <label><span>{COPY.workProfile.fields.preferredUnits}</span><select value={profileDraft.preferredUnits} onChange={(event) => setProfile("preferredUnits", event.currentTarget.value as WorkProfile["preferredUnits"])}><option value="metric">{COPY.workProfile.options.metric}</option><option value="imperial">{COPY.workProfile.options.imperial}</option><option value="mixed">{COPY.workProfile.options.mixed}</option></select></label>
          </div>
          <fieldset class={styles.workweek}>
            <legend>{COPY.workProfile.workweek}</legend>
            <div>{WEEKDAYS.map(({ code, label }) => <label key={code}><input type="checkbox" checked={profileDraft.workweek.includes(code)} onChange={() => toggleDay(code)} /><span>{label}</span></label>)}</div>
          </fieldset>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(2)}>{COPY.onboarding.back}</button>
            <button class={styles.primary} type="button" data-onboarding-action="review" onClick={beginReview}>{COPY.onboarding.review}</button>
          </div>
        </section>
      )}

      {stage === 4 && review !== null && (
        <section class={styles.stage} aria-labelledby="review-title" data-starter-selected={selectedCount}>
          <div class={styles.stageHeading}>
            <h2 id="review-title">{COPY.onboarding.prompts[4]}</h2>
            <span class={styles.localBadge}>{COPY.onboarding.goldCount(quality.tools.length)}</span>
          </div>
          <p class={styles.muted}>
            {contextSummary} · {selectedCount}/{MAX_STARTER_TOOLS}
          </p>
          <p class={styles.muted}>{COPY.onboarding.hints[4]}</p>
          <div class={styles.reviewLayout}>
            <div>
              <ul class={styles.reviewList}>
                {review.recommendations.map((item) => {
                  const selected = review.selectedToolIds.includes(item.tool.id);
                  return (
                    <li key={item.tool.id} class={styles.reviewRow} data-starter-tool-id={item.tool.id} data-reason-code={item.reasonCode} data-pack-context={review.contextIds.join(" ")} data-quality={item.quality}>
                      <label class={styles.reviewCheck}>
                        <input type="checkbox" checked={selected} onChange={(event) => updateReview(toggleStarterTool(review, item.tool.id, event.currentTarget.checked))} />
                        <span><strong>{item.tool.name}</strong><small>{item.tool.summary}</small><em data-starter-reason>{item.reason}</em></span>
                      </label>
                      <span class={item.quality === "gold" ? styles.goldBadge : styles.manualBadge}>{item.quality === "gold" ? "Gold" : "Aggiunto manualmente"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <aside class={styles.alternativePanel} aria-labelledby="alternative-title">
              <h3 id="alternative-title">{COPY.suggestions.title}</h3>
              <p class={styles.muted}>{COPY.onboarding.searchHint}</p>
              <label class={styles.searchLabel}><span>{COPY.onboarding.searchLibrary}</span><input type="search" value={alternativeQuery} onInput={(event) => setAlternativeQuery(event.currentTarget.value)} placeholder={COPY.onboarding.searchPlaceholder} /></label>
              <ul class={styles.alternativeList}>
                {alternativeQuery.trim() === "" ? <li class={styles.noResults}>{COPY.onboarding.noResultsQuery}</li> : alternatives.length === 0 ? <li class={styles.noResults}>{COPY.onboarding.noMatch}</li> : alternatives.map((item) => <li key={item.tool.id}><span><strong>{item.tool.name}</strong><small>{item.reason}</small></span><button type="button" onClick={() => updateReview(addStarterAlternative(review, item.tool, quality))} disabled={review.selectedToolIds.length >= MAX_STARTER_TOOLS}>{COPY.yourTools.add}</button></li>)}
              </ul>
            </aside>
          </div>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(3)}>{COPY.onboarding.back}</button>
            <button class={styles.primary} type="button" data-onboarding-action="save" disabled={!ready || selectedCount === 0 || saving || completed} onClick={() => void acceptStarter()}>{saving ? COPY.onboarding.saving : COPY.onboarding.save}</button>
          </div>
          {completed && <p class={styles.success} role="status">{COPY.onboarding.saved}</p>}
        </section>
      )}

      <p class={styles.footnote}>{COPY.onboarding.footnote}</p>
    </div>
  );
}
