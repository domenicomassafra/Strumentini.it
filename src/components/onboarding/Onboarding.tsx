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
import styles from "./Onboarding.module.css";

export interface OnboardingProps {
  readonly tools: readonly ToolSummary[];
  readonly quality: GoldQualityIndex;
}

type OnboardingStage = 1 | 2 | 3 | 4;

const DAYS: ReadonlyArray<{ code: DayCode; label: string }> = [
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
  { code: "SUN", label: "Sun" },
];

function serverSafeProfile(): WorkProfile {
  return createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" });
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "en-US",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

function stageLabel(stage: OnboardingStage): string {
  if (stage === 1) return "Work context";
  if (stage === 2) return "Recurring jobs";
  if (stage === 3) return "Safe defaults";
  return "Starter review";
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
    const ordered = DAYS.map(({ code }) => code).filter((code) => selected.has(code));
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
      setWarning(result.warning ?? "Your starter set is ready, but this browser could not save it.");
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
        <p class={styles.eyebrow}>Local setup · no account</p>
        <h1>Build your everyday tool set</h1>
        <p>Answer only what changes your tools or safe defaults. You can edit the result before saving it.</p>
        <a class={styles.skipLink} href="/library/">Skip — browse the Library</a>
      </header>

      {warning !== "" && (
        <div class={styles.warning} role="status">
          <strong>Setup is still usable.</strong>
          <span>{warning}</span>
        </div>
      )}

      <nav class={styles.steps} aria-label="Setup steps">
        {([1, 2, 3, 4] as const).map((number) => (
          <button
            key={number}
            type="button"
            class={number === stage ? styles.currentStep : undefined}
            aria-current={number === stage ? "step" : undefined}
            onClick={() => {
              if (number < stage) setStage(number);
            }}
            disabled={number > stage}
          >
            <span>{number}</span>{stageLabel(number)}
          </button>
        ))}
      </nav>

      {stage === 1 && (
        <section class={styles.stage} aria-labelledby="context-title">
          <div class={styles.stageHeading}>
            <div>
              <p class={styles.eyebrow}>Step 1 of 4</p>
              <h2 id="context-title">What kind of work do you do?</h2>
            </div>
            <span class={styles.counter}>{contextIds.length}/3 selected</span>
          </div>
          <p class={styles.muted}>Choose up to three contexts. The first choice shapes the starter pack most strongly.</p>
          <div class={styles.choiceGrid}>
            {WORK_CONTEXT_PACKS.map((pack) => (
              <label class={styles.choice} key={pack.id} data-context-id={pack.id}>
                <input type="checkbox" checked={contextIds.includes(pack.id)} onChange={() => toggleContext(pack.id)} />
                <span><strong>{pack.label}</strong><small>{pack.description}</small></span>
              </label>
            ))}
          </div>
          <div class={styles.actions}>
            <button class={styles.primary} type="button" disabled={!canContinue} onClick={() => setStage(2)}>Continue</button>
            <a href="/library/">Browse Library instead</a>
          </div>
        </section>
      )}

      {stage === 2 && (
        <section class={styles.stage} aria-labelledby="jobs-title">
          <div class={styles.stageHeading}>
            <div>
              <p class={styles.eyebrow}>Step 2 of 4</p>
              <h2 id="jobs-title">Which small jobs repeat?</h2>
            </div>
            <span class={styles.counter}>{jobIds.length} selected</span>
          </div>
          <p class={styles.muted}>Choose any that apply. These are structured task signals, not a promise that every tool is needed.</p>
          <div class={styles.choiceGrid}>
            {RECURRING_JOBS.map((job) => (
              <label class={styles.choice} key={job.id}>
                <input type="checkbox" checked={jobIds.includes(job.id)} onChange={() => toggleJob(job.id)} />
                <span><strong>{job.label}</strong><small>Used to add matching Gold tools to the review.</small></span>
              </label>
            ))}
          </div>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(1)}>Back</button>
            <button class={styles.primary} type="button" onClick={() => setStage(3)}>Continue</button>
          </div>
        </section>
      )}

      {stage === 3 && (
        <section class={styles.stage} aria-labelledby="defaults-title">
          <div class={styles.stageHeading}>
            <div>
              <p class={styles.eyebrow}>Step 3 of 4</p>
              <h2 id="defaults-title">Set safe defaults</h2>
            </div>
            <span class={styles.localBadge}>Stored locally</span>
          </div>
          <p class={styles.muted}>These values are reused only by tools that declare them. You can change them later in Work Profile.</p>
          <div class={styles.profileGrid}>
            <label><span>Locale</span><input value={profileDraft.locale} onInput={(event) => setProfile("locale", event.currentTarget.value)} /></label>
            <label><span>Timezone</span><input value={profileDraft.timezone} onInput={(event) => setProfile("timezone", event.currentTarget.value)} /></label>
            <label><span>Currency</span><input value={profileDraft.currency} onInput={(event) => setProfile("currency", event.currentTarget.value.toUpperCase())} /></label>
            <label><span>Date format</span><select value={profileDraft.dateFormat} onChange={(event) => setProfile("dateFormat", event.currentTarget.value as WorkProfile["dateFormat"])}><option value="system">System</option><option value="day-first">Day first</option><option value="month-first">Month first</option></select></label>
            <label><span>Number format</span><select value={profileDraft.numberFormat} onChange={(event) => setProfile("numberFormat", event.currentTarget.value as WorkProfile["numberFormat"])}><option value="system">System</option><option value="decimal-comma">Decimal comma</option><option value="decimal-point">Decimal point</option></select></label>
            <label><span>Preferred units</span><select value={profileDraft.preferredUnits} onChange={(event) => setProfile("preferredUnits", event.currentTarget.value as WorkProfile["preferredUnits"])}><option value="metric">Metric</option><option value="imperial">Imperial</option><option value="mixed">Mixed</option></select></label>
          </div>
          <fieldset class={styles.workweek}>
            <legend>Workweek</legend>
            <div>{DAYS.map(({ code, label }) => <label key={code}><input type="checkbox" checked={profileDraft.workweek.includes(code)} onChange={() => toggleDay(code)} /><span>{label}</span></label>)}</div>
          </fieldset>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(2)}>Back</button>
            <button class={styles.primary} type="button" onClick={beginReview}>Review starter tools</button>
          </div>
        </section>
      )}

      {stage === 4 && review !== null && (
        <section class={styles.stage} aria-labelledby="review-title" data-starter-selected={selectedCount}>
          <div class={styles.stageHeading}>
            <div>
              <p class={styles.eyebrow}>Step 4 of 4</p>
              <h2 id="review-title">Review your starter tools</h2>
              <p class={styles.muted}>{contextSummary || "Your work context"} · {selectedCount}/{MAX_STARTER_TOOLS} selected</p>
            </div>
            <span class={styles.localBadge}>{quality.tools.length} Gold-certified tools</span>
          </div>
          <p class={styles.muted}>Each reason comes from the selected context or job metadata. Remove anything that does not fit, or search the catalog for a deliberate addition.</p>
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
                      <span class={item.quality === "gold" ? styles.goldBadge : styles.manualBadge}>{item.quality === "gold" ? "Gold" : "Manual add"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <aside class={styles.alternativePanel} aria-labelledby="alternative-title">
              <h3 id="alternative-title">Add another tool</h3>
              <p class={styles.muted}>Search all 200 catalog tools. Only Gold-certified tools enter the generated set automatically.</p>
              <label class={styles.searchLabel}><span>Search the Library</span><input type="search" value={alternativeQuery} onInput={(event) => setAlternativeQuery(event.currentTarget.value)} placeholder="e.g. JSON, image, calendar" /></label>
              <ul class={styles.alternativeList}>
                {alternativeQuery.trim() === "" ? <li class={styles.noResults}>Type a task, tool, or format.</li> : alternatives.length === 0 ? <li class={styles.noResults}>No matching tool.</li> : alternatives.map((item) => <li key={item.tool.id}><span><strong>{item.tool.name}</strong><small>{item.reason}</small></span><button type="button" onClick={() => updateReview(addStarterAlternative(review, item.tool, quality))} disabled={review.selectedToolIds.length >= MAX_STARTER_TOOLS}>Add</button></li>)}
              </ul>
            </aside>
          </div>
          <div class={styles.actions}>
            <button type="button" onClick={() => setStage(3)}>Back</button>
            <button class={styles.primary} type="button" disabled={!ready || selectedCount === 0 || saving || completed} onClick={() => void acceptStarter()}>{saving ? "Saving locally…" : "Save starter set"}</button>
          </div>
          {completed && <p class={styles.success} role="status">Saved locally. Opening your Workbench…</p>}
        </section>
      )}

      <p class={styles.footnote}>No sign-in, upload, model inference, or account is required. Your task content is not part of this setup.</p>
    </div>
  );
}
