import { useEffect, useRef, useState } from "preact/hooks";
import { isLocalToolRoute, type ToolSummary } from "../../catalog/manifest";
import { createIndexedDbPersistence } from "../../persistence/persistence";
import { publishSearchContext, sanitizeSearchContext } from "../../search/browser-context";
import {
  createDefaultWorkProfile,
  type DayCode,
  type WorkProfile,
  updateWorkProfile,
} from "../../profile/work-profile";
import {
  applyImportedConfig,
  exportWorkbenchConfig,
  previewWorkbenchImport,
  type ImportPreview,
} from "../../workbench/portability";
import { createWorkbenchRepository } from "../../workbench/repository";
import {
  clearRecent,
  createDefaultWorkbenchState,
  installPack,
  installTool,
  moveTool,
  recordRecentTool,
  removePack,
  removeTool,
  type WorkbenchState,
} from "../../workbench/state";
import { WORK_CONTEXT_PACKS, getRecurringJob } from "../../onboarding/contexts";
import { goldToolIds } from "../../onboarding/quality";
import { qualityIndex } from "../../generated/quality";
import { formatRecentActivity, getWorkbenchSuggestions } from "./ux";
import { COPY, WEEKDAYS } from "./copy";
import { LedgerRow, type LedgerValue } from "./LedgerRow";
import { readLastValues, subscribeLastValues, type ToolLastValue } from "./last-value";
import { getTelemetryAdapter, rememberToolEntrySource } from "../../telemetry/browser";
import {
  trackConfigExported,
  trackConfigImported,
  trackPackInstalled,
  trackPackRemoved,
  trackWorkspaceToolAdded,
  trackWorkspaceToolRemoved,
} from "../../telemetry/events";
import styles from "./Workbench.module.css";

export { formatRecentActivity, getWorkbenchSuggestions } from "./ux";
export type { WorkbenchSuggestion } from "./ux";

const DAYS = WEEKDAYS;

type Repository = ReturnType<typeof createWorkbenchRepository>;
const MAX_CONFIG_FILE_BYTES = 1024 * 1024;

function serverSafeInitialState(): WorkbenchState {
  return createDefaultWorkbenchState(
    createDefaultWorkProfile({ locale: "it-IT", timezone: "UTC" }),
  );
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "it-IT",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

function toolName(toolId: string, tools: readonly ToolSummary[]): string {
  return tools.find((tool) => tool.id === toolId)?.name ?? COPY.unavailableTool + toolId;
}

function runtimeLabel(tool: ToolSummary): string {
  if (tool.runtime.location === "LOCAL") return COPY.runtime.local;
  if (tool.runtime.location === "REFERENCE") return COPY.runtime.reference;
  return COPY.runtime.network;
}

function profileUsage(tool: ToolSummary | undefined, profile: WorkProfile): string {
  if (tool === undefined || tool.profileFields.length === 0) return "";
  const source = profile as unknown as Readonly<Record<string, unknown>>;
  return tool.profileFields
    .filter(({ key, sensitive }) => sensitive !== true && Object.prototype.hasOwnProperty.call(source, key))
    .map(({ key }) => {
      const value = source[key];
      return key + ": " + (Array.isArray(value) ? value.join(", ") : String(value));
    })
    .join(" · ");
}


export function Workbench({ tools }: { tools: readonly ToolSummary[] }) {
  const [state, setState] = useState<WorkbenchState>(serverSafeInitialState);
  const [profileDraft, setProfileDraft] = useState<WorkProfile>(state.profile);
  const [warning, setWarning] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [lastValues, setLastValues] = useState<Readonly<Record<string, ToolLastValue>>>({});
  const repositoryRef = useRef<Repository | null>(null);
  const pendingSavesRef = useRef(0);
  const currentTelemetry = () => getTelemetryAdapter();

  useEffect(() => {
    const initial = createDefaultWorkbenchState(browserProfile());
    const repository = createWorkbenchRepository(createIndexedDbPersistence(), initial);
    repositoryRef.current = repository;
    void repository.load().then((loaded) => {
      setState(loaded.state);
      setProfileDraft(loaded.state.profile);
      setWarning(loaded.warning ?? "");
      setReady(true);
    });
  }, []);

  // Read the gutter store in its own effect so its update is not entangled
  // with the asynchronous repository load above.
  useEffect(() => { setLastValues(readLastValues()); }, []);

  // The gutter is live: a value produced in a tool tab, or in this one, lands
  // in the column without a reload. The subscriber passes freshly-read
  // values, so this needs no dependency list.
  useEffect(() => subscribeLastValues(setLastValues), []);

  useEffect(() => {
    if (!ready) return;
    const context = sanitizeSearchContext({
      installedToolIds: state.installedTools,
      recentToolIds: state.recent.map(({ toolId }) => toolId),
      installedPackTags: state.packs,
    });
    publishSearchContext(context);
    try {
      window.sessionStorage.setItem("utilityos:workbench-context:v1", JSON.stringify(context));
    } catch (error) {
      void error;
    }
  }, [ready, state.installedTools, state.recent, state.packs]);

  async function persist(next: WorkbenchState) {
    setState(next);
    pendingSavesRef.current += 1;
    setSaving(true);
    try {
      const result = await repositoryRef.current?.save(next);
      setWarning(result?.warning ?? "");
    } finally {
      pendingSavesRef.current -= 1;
      setSaving(pendingSavesRef.current > 0);
    }
  }

  async function add(toolId: string) {
    if (state.installedTools.includes(toolId)) return;
    trackWorkspaceToolAdded(currentTelemetry(), toolId);
    await persist(installTool(state, toolId));
  }

  async function remove(toolId: string) {
    if (!state.installedTools.includes(toolId)) return;
    trackWorkspaceToolRemoved(currentTelemetry(), toolId);
    await persist(removeTool(state, toolId));
  }

  async function addPack(packId: string, toolIds: readonly string[]) {
    const next = installPack(state, packId, toolIds);
    if (next === state) return;
    if (!state.packs.includes(packId) && next.packs.includes(packId)) {
      trackPackInstalled(currentTelemetry(), packId);
    }
    for (const toolId of next.installedTools.filter((id) => !state.installedTools.includes(id))) {
      trackWorkspaceToolAdded(currentTelemetry(), toolId);
    }
    await persist(next);
  }

  async function forgetPack(packId: string) {
    const next = removePack(state, packId);
    if (next === state) return;
    trackPackRemoved(currentTelemetry(), packId);
    await persist(next);
  }

  async function move(toolId: string, direction: -1 | 1) {
    await persist(moveTool(state, toolId, direction));
  }

  async function openTool(tool: ToolSummary, event: MouseEvent) {
    event.preventDefault();
    rememberToolEntrySource(tool.id, "workbench");
    if (!isLocalToolRoute(tool.route)) return;
    const next = recordRecentTool(state, tool.id);
    await persist(next);
    window.location.assign(tool.route);
  }

  function setProfile<K extends keyof WorkProfile>(key: K, value: WorkProfile[K]) {
    setProfileDraft((current) => updateWorkProfile(current, { [key]: value }));
  }

  function toggleDay(day: DayCode) {
    const selected = new Set(profileDraft.workweek);
    if (selected.has(day)) selected.delete(day);
    else selected.add(day);
    const ordered = DAYS.map(({ code }) => code).filter((code) => selected.has(code));
    if (ordered.length > 0) setProfile("workweek", ordered);
  }

  async function saveProfile() {
    await persist({ ...state, profile: profileDraft });
  }

  function downloadConfig() {
    const config = exportWorkbenchConfig(state);
    trackConfigExported(currentTelemetry(), {
      toolCount: state.installedTools.length,
      packCount: state.packs.length,
    });
    const blob = new Blob([config], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workbench-config-v1.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewImport(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MAX_CONFIG_FILE_BYTES) {
      setImportPreview({ ok: false, error: "This configuration exceeds the local size limit." });
      return;
    }
    try {
      const preview = previewWorkbenchImport(await file.text(), state);
      if (!preview.ok) {
        trackConfigImported(currentTelemetry(), "rejected", {
          toolCount: state.installedTools.length,
          packCount: state.packs.length,
        });
      }
      setImportPreview(preview);
    } catch {
      trackConfigImported(currentTelemetry(), "failed", {
        toolCount: state.installedTools.length,
        packCount: state.packs.length,
      });
      setImportPreview({ ok: false, error: "This configuration could not be read. Try another file." });
    }
  }

  async function applyImport() {
    if (importPreview === null || !importPreview.ok) return;
    const next = applyImportedConfig(state, importPreview.config);
    for (const toolId of next.installedTools.filter((tool) => !state.installedTools.includes(tool))) {
      trackWorkspaceToolAdded(currentTelemetry(), toolId);
    }
    for (const toolId of state.installedTools.filter((tool) => !next.installedTools.includes(tool))) {
      trackWorkspaceToolRemoved(currentTelemetry(), toolId);
    }
    for (const packId of next.packs.filter((pack) => !state.packs.includes(pack))) {
      trackPackInstalled(currentTelemetry(), packId);
    }
    for (const packId of state.packs.filter((pack) => !next.packs.includes(pack))) {
      trackPackRemoved(currentTelemetry(), packId);
    }
    trackConfigImported(currentTelemetry(), "success", {
      toolCount: next.installedTools.length,
      packCount: next.packs.length,
    });
    setProfileDraft(next.profile);
    await persist(next);
    setImportPreview(null);
  }

  const installed = state.installedTools.map((id) => ({
    id,
    tool: tools.find((tool) => tool.id === id),
  }));
  const available = tools.filter((tool) => !state.installedTools.includes(tool.id));
  const suggestions = getWorkbenchSuggestions(tools, state);
  const gold = goldToolIds(qualityIndex);
  const packs = WORK_CONTEXT_PACKS.map((pack) => {
    const packTools = pack.toolIds
      .filter((id) => gold.has(id))
      .map((id) => tools.find((tool) => tool.id === id))
      .filter((tool): tool is ToolSummary => tool !== undefined);
    const installedCount = packTools.filter((tool) => state.installedTools.includes(tool.id)).length;
    return {
      pack,
      tools: packTools,
      installedCount,
      missingToolIds: packTools.filter((tool) => !state.installedTools.includes(tool.id)).map((tool) => tool.id),
      installed: state.packs.includes(pack.id),
    };
  });
  const firstTool = tools[0];

  /**
   * The gutter cell for one tool. A tool that has produced a value shows it;
   * one that has not shows the state it is in, so the column is populated
   * rather than blank and never changes width between rows.
   */
  function toolValue(toolId: string, tool: ToolSummary | undefined): LedgerValue {
    const record = lastValues[toolId];
    if (record !== undefined) return { produced: record.value, unit: record.unit };
    return { state: tool === undefined ? COPY.yourTools.unavailable : runtimeLabel(tool) };
  }

  return (
    <div
      class={styles.shell}
      data-ready={ready ? "true" : "false"}
      data-saving={saving ? "true" : "false"}
      aria-busy={saving}
    >
      {/*
       * The apertura del libro. The heading names a state, not the product,
       * and there is no eyebrow: the page does not introduce itself, it opens.
       */}
      <header class={styles.intro}>
        <h1>{COPY.home.title}</h1>
        <p class={styles.lede}>{COPY.home.lede}</p>
        <a class={styles.setupLink} href="/onboarding/">{COPY.home.setupLink}</a>
      </header>

      {warning !== "" && (
        <section class={styles.warning} role="status" aria-label="Storage warning">
          <strong>{COPY.storage.title}</strong>
          <span>{COPY.storage.body} {warning}</span>
          <button type="button" onClick={() => void persist(state)}>{COPY.storage.retry}</button>
        </section>
      )}

      <section id="your-tools" class={styles.section} aria-labelledby="your-tools-title">
        <div class={styles.sectionHeading}>
          <h2 id="your-tools-title">{COPY.yourTools.title}</h2>
          <span class={styles.count}>{COPY.yourTools.installedCount(state.installedTools.length)}</span>
        </div>

        {installed.length === 0 ? (
          <div class={styles.empty}>
            <p>{COPY.yourTools.emptyTitle}</p>
            <p class={styles.muted}>{COPY.yourTools.emptyBody}</p>
            <div class={styles.emptyActions}>
              {firstTool !== undefined && (
                <button class={styles.primary} type="button" onClick={() => void add(firstTool.id)}>
                  {COPY.yourTools.addFirst(firstTool.name)}
                </button>
              )}
              <a href="/onboarding/">{COPY.yourTools.setUpMine}</a>
              <a href="/library/">{COPY.yourTools.browseLibrary}</a>
            </div>
          </div>
        ) : (
          <ol class={styles.toolList + (state.preferences.compactRows ? " " + styles.compact : "")}>
            {installed.map(({ id, tool }, index) => {
              const usage = tool === undefined ? "" : profileUsage(tool, state.profile);
              const name = toolName(id, tools);
              return (
                <LedgerRow
                  key={id}
                  rowId={id}
                  installed
                  title={name}
                  task={tool === undefined ? undefined : tool.summary}
                  value={toolValue(id, tool)}
                  detail={tool === undefined
                    ? <small class={styles.rowMeta}>{COPY.yourTools.unavailable}</small>
                    : (
                      <>
                        <small class={styles.rowMeta}>{runtimeLabel(tool)}</small>
                        {usage !== "" && (
                          <small class={styles.rowMeta}>
                            {usage} <b>{COPY.provenance}</b>
                          </small>
                        )}
                      </>
                    )}
                  actions={(
                    <>
                      {tool !== undefined && (
                        <a class={styles.openLink} href={tool.route} onClick={(event) => void openTool(tool, event)}>
                          {COPY.yourTools.open}
                        </a>
                      )}
                      <details class={styles.manage}>
                        <summary aria-label={COPY.yourTools.manage + " " + name}>{COPY.yourTools.manage}</summary>
                        <div class={styles.manageActions}>
                          <button
                            type="button"
                            aria-label={COPY.yourTools.moveUp(name)}
                            disabled={index === 0}
                            onClick={() => void move(id, -1)}
                          >
                            {COPY.yourTools.moveUp(name)}
                          </button>
                          <button
                            type="button"
                            aria-label={COPY.yourTools.moveDown(name)}
                            disabled={index === installed.length - 1}
                            onClick={() => void move(id, 1)}
                          >
                            {COPY.yourTools.moveDown(name)}
                          </button>
                          <button class={styles.remove} type="button" onClick={() => void remove(id)}>
                            {COPY.yourTools.remove}
                          </button>
                        </div>
                      </details>
                    </>
                  )}
                />
              );
            })}
          </ol>
        )}

        {available.length > 0 && (
          <div class={styles.addTools}>
            <button
              type="button"
              aria-expanded={showAvailable}
              aria-controls="available-tools"
              onClick={() => setShowAvailable((visible) => !visible)}
            >
              {showAvailable ? COPY.yourTools.hideAvailable : COPY.yourTools.addTool}
            </button>
            {showAvailable && (
              <ul id="available-tools">
                {available.map((tool) => (
                  <li key={tool.id}>
                    <span><strong>{tool.name}</strong> — {tool.summary}</span>
                    <button type="button" onClick={() => void add(tool.id)}>{COPY.yourTools.add}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Recent: same rows, same gutter, directly beneath Your Tools. */}
      <section id="recent" class={styles.section} aria-labelledby="recent-title">
        <div class={styles.sectionHeading}>
          <h2 id="recent-title">{COPY.recent.title}</h2>
          {state.recent.length > 0 && (
            <button type="button" onClick={() => void persist(clearRecent(state))}>{COPY.recent.clear}</button>
          )}
        </div>
        {state.recent.length === 0 ? (
          <p class={styles.muted}>{COPY.recent.empty}</p>
        ) : (
          <ul class={styles.recentList}>
            {state.recent.map((entry) => {
              const tool = tools.find((item) => item.id === entry.toolId);
              return (
                <LedgerRow
                  key={entry.toolId}
                  rowId={entry.toolId}
                  dataset={{ "data-recent-tool-id": entry.toolId }}
                  title={toolName(entry.toolId, tools)}
                  task={COPY.recent.openedTimes(entry.useCount)}
                  // A tool with no produced value still reports its runtime
                  // state here, so the column is never blank.
                  value={toolValue(entry.toolId, tool)}
                  detail={tool === undefined
                    ? undefined
                    : (
                      <small class={styles.rowMeta}>
                        {formatRecentActivity(entry.lastUsedAt)} · {COPY.recent.title}
                      </small>
                    )}
                  actions={tool !== undefined && (
                    <a href={tool.route} onClick={(event) => void openTool(tool, event)}>{COPY.recent.runAgain}</a>
                  )}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Suggestions: at most four, each with one visible deterministic reason. */}
      <section id="suggestions" class={styles.section} aria-labelledby="suggestions-title">
        <div class={styles.sectionHeading}>
          <h2 id="suggestions-title">{COPY.suggestions.title}</h2>
          {suggestions.length > 0 && <span class={styles.count}>{COPY.suggestions.shown(suggestions.length)}</span>}
        </div>
        {suggestions.length === 0 ? (
          <p class={styles.muted}>{COPY.suggestions.empty}</p>
        ) : (
          <ul class={styles.suggestionList}>
            {suggestions.map(({ tool, reason }) => (
              <LedgerRow
                key={tool.id}
                rowId={tool.id}
                dataset={{ "data-suggestion-id": tool.id }}
                title={tool.name}
                task={tool.summary}
                value={{ state: runtimeLabel(tool) }}
                detail={<small class={styles.reason} data-suggestion-reason>{reason}</small>}
                actions={(
                  <button
                    type="button"
                    aria-label={COPY.suggestions.addLabel(tool.name)}
                    data-suggestion-action
                    onClick={() => void add(tool.id)}
                  >
                    {COPY.yourTools.add}
                  </button>
                )}
              />
            ))}
          </ul>
        )}
        {/* The Library is one link, and is never the first thing on the page. */}
        <a class={styles.libraryLink} href="/library/">
          {COPY.suggestions.browseFull}
          <span>{COPY.suggestions.toolsCount(tools.length)}</span>
        </a>
      </section>

      <section id="packs" class={styles.section} aria-labelledby="packs-title">
        <div class={styles.sectionHeading}>
          <h2 id="packs-title">{COPY.packs.title}</h2>
          <span class={styles.count}>{COPY.packs.installedCount(state.packs.length)}</span>
        </div>
        <p class={styles.muted}>{COPY.packs.lede}</p>
        <div class={styles.packList}>
          {packs.map(({ pack, tools: packTools, installedCount, missingToolIds, installed }) => (
            <details class={styles.pack} key={pack.id} data-pack-id={pack.id}>
              <summary>
                <span>
                  <strong>{pack.label}</strong>
                  <small>{pack.description}</small>
                </span>
                <span class={styles.packCount}>
                  {COPY.packs.progress(installedCount, packTools.length)}
                </span>
              </summary>
              <div class={styles.packBody}>
                <p class={styles.packJobs}>
                  <strong>{COPY.packs.jobs}</strong>{" "}
                  {pack.jobIds.map((jobId) => getRecurringJob(jobId).label).join(" · ")}
                </p>
                <ul class={styles.packChecklist}>
                  {packTools.map((tool) => (
                    <li key={tool.id} data-pack-tool-id={tool.id}>
                      <span aria-hidden="true">{state.installedTools.includes(tool.id) ? "✓" : "—"}</span>
                      <span>
                        <strong>{tool.name}</strong>
                        <small>{pack.reasons[tool.id] ?? COPY.packs.defaultReason(pack.label)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
                <div class={styles.packActions}>
                  <button
                    class={styles.primary}
                    type="button"
                    data-pack-add={pack.id}
                    disabled={missingToolIds.length === 0 && installed}
                    onClick={() => void addPack(pack.id, missingToolIds)}
                  >
                    {missingToolIds.length === 0 ? COPY.packs.complete : COPY.packs.addRecommended(missingToolIds.length)}
                  </button>
                  {installed && (
                    <button type="button" data-pack-remove={pack.id} onClick={() => void forgetPack(pack.id)}>
                      {COPY.packs.remove}
                    </button>
                  )}
                </div>
                <p class={styles.muted}>{COPY.packs.manualRemoval}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/*
       * Work Profile is a ruled block on a baseline grid, not a card. Six
       * fields in three columns, then the workweek as seven toggles in one
       * ruled strip.
       */}
      <section id="work-profile" class={styles.section} aria-labelledby="profile-title">
        <div class={styles.sectionHeading}>
          <h2 id="profile-title">{COPY.workProfile.title}</h2>
          <span class={styles.localBadge}>{COPY.workProfile.storedLocally}</span>
        </div>
        <p class={styles.muted}>{COPY.workProfile.lede}</p>

        <div class={styles.profileBlock}>
          <div class={styles.profileGrid}>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.locale}</span>
              <input value={profileDraft.locale} onInput={(event) => setProfile("locale", event.currentTarget.value)} />
            </label>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.timezone}</span>
              <input value={profileDraft.timezone} onInput={(event) => setProfile("timezone", event.currentTarget.value)} />
            </label>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.currency}</span>
              <input value={profileDraft.currency} onInput={(event) => setProfile("currency", event.currentTarget.value.toUpperCase())} />
            </label>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.dateFormat}</span>
              <select value={profileDraft.dateFormat} onChange={(event) => setProfile("dateFormat", event.currentTarget.value as WorkProfile["dateFormat"])}>
                <option value="system">{COPY.workProfile.options.system}</option>
                <option value="day-first">{COPY.workProfile.options.dayFirst}</option>
                <option value="month-first">{COPY.workProfile.options.monthFirst}</option>
              </select>
            </label>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.numberFormat}</span>
              <select value={profileDraft.numberFormat} onChange={(event) => setProfile("numberFormat", event.currentTarget.value as WorkProfile["numberFormat"])}>
                <option value="system">{COPY.workProfile.options.system}</option>
                <option value="decimal-comma">{COPY.workProfile.options.decimalComma}</option>
                <option value="decimal-point">{COPY.workProfile.options.decimalPoint}</option>
              </select>
            </label>
            <label class={styles.profileField}>
              <span>{COPY.workProfile.fields.preferredUnits}</span>
              <select value={profileDraft.preferredUnits} onChange={(event) => setProfile("preferredUnits", event.currentTarget.value as WorkProfile["preferredUnits"])}>
                <option value="metric">{COPY.workProfile.options.metric}</option>
                <option value="imperial">{COPY.workProfile.options.imperial}</option>
                <option value="mixed">{COPY.workProfile.options.mixed}</option>
              </select>
            </label>
          </div>

          <fieldset class={styles.workweek}>
            <legend>{COPY.workProfile.workweek}</legend>
            <div class={styles.weekdayStrip}>
              {DAYS.map(({ code, label }) => (
                <label key={code}>
                  <input type="checkbox" checked={profileDraft.workweek.includes(code)} onChange={() => toggleDay(code)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div class={styles.profileActions}>
          <button class={styles.primary} type="button" onClick={() => void saveProfile()}>
            {COPY.workProfile.save}
          </button>
          <label class={styles.checkboxLine}>
            <input
              type="checkbox"
              checked={state.preferences.compactRows}
              onChange={(event) => void persist({
                ...state,
                preferences: { ...state.preferences, compactRows: event.currentTarget.checked },
              })}
            />
            {COPY.workProfile.compactRows}
          </label>
        </div>
      </section>

      <section class={styles.section} aria-labelledby="portable-title">
        <div class={styles.sectionHeading}>
          <h2 id="portable-title">{COPY.portability.title}</h2>
        </div>
        <p class={styles.muted}>{COPY.portability.lede}</p>
        <div class={styles.portableActions}>
          <button type="button" onClick={downloadConfig}>{COPY.portability.export}</button>
          <label class={styles.importFile}>
            <span>{COPY.portability.import}</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void previewImport(event.currentTarget.files?.[0])}
            />
          </label>
        </div>

        {importPreview !== null && (
          <div class={importPreview.ok ? styles.preview : "error"} role={importPreview.ok ? "status" : "alert"}>
            {importPreview.ok ? (
              <>
                <strong>{COPY.portability.importPreview}</strong>
                <ul>
                  <li>{COPY.portability.addedTools(importPreview.summary.addedTools.length)}</li>
                  <li>{COPY.portability.removedTools(importPreview.summary.removedTools.length)}</li>
                  <li>{COPY.workProfile.title} {importPreview.summary.profileChanged ? COPY.portability.profileWillChange : COPY.portability.unchanged}</li>
                  <li>{COPY.workProfile.compactRows} {importPreview.summary.preferencesChanged ? COPY.portability.preferencesWillChange : COPY.portability.unchanged}</li>
                  <li>{COPY.portability.title} {importPreview.summary.packsChanged ? COPY.portability.packsWillChange : COPY.portability.unchanged}</li>
                </ul>
                <div class={styles.previewActions}>
                  <button class={styles.primary} type="button" onClick={() => void applyImport()}>
                    {COPY.portability.applyImport}
                  </button>
                  <button type="button" onClick={() => setImportPreview(null)}>{COPY.portability.cancel}</button>
                </div>
              </>
            ) : (
              <>
                <strong>{COPY.portability.importRejected}</strong>
                <span>{importPreview.error}</span>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
