import { useEffect, useRef, useState } from "preact/hooks";
import type { ToolSummary } from "../../catalog/manifest";
import { createIndexedDbPersistence } from "../../persistence/persistence";
import { publishSearchContext } from "../../search/browser-context";
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
  installTool,
  moveTool,
  recordRecentTool,
  removeTool,
  type WorkbenchState,
} from "../../workbench/state";
import { formatRecentActivity, getWorkbenchSuggestions } from "./ux";
import styles from "./Workbench.module.css";

export { formatRecentActivity, getWorkbenchSuggestions } from "./ux";
export type { WorkbenchSuggestion } from "./ux";

const DAYS: ReadonlyArray<{ code: DayCode; label: string }> = [
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
  { code: "SUN", label: "Sun" },
];

type Repository = ReturnType<typeof createWorkbenchRepository>;

function serverSafeInitialState(): WorkbenchState {
  return createDefaultWorkbenchState(
    createDefaultWorkProfile({ locale: "en-US", timezone: "UTC" }),
  );
}

function browserProfile(): WorkProfile {
  return createDefaultWorkProfile({
    locale: navigator.language || "en-US",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

function toolName(toolId: string, tools: readonly ToolSummary[]): string {
  return tools.find((tool) => tool.id === toolId)?.name ?? "Unavailable tool — " + toolId;
}

function runtimeLabel(tool: ToolSummary): string {
  if (tool.runtime.location === "LOCAL") return "On this device";
  if (tool.runtime.location === "REFERENCE") return "Reference only";
  return "Uses network";
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
  const repositoryRef = useRef<Repository | null>(null);
  const pendingSavesRef = useRef(0);

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

  useEffect(() => {
    if (!ready) return;
    const context = {
      installedToolIds: state.installedTools,
      recentToolIds: state.recent.map(({ toolId }) => toolId),
      installedPackTags: state.packs,
    };
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
    await persist(installTool(state, toolId));
  }

  async function remove(toolId: string) {
    await persist(removeTool(state, toolId));
  }

  async function move(toolId: string, direction: -1 | 1) {
    await persist(moveTool(state, toolId, direction));
  }

  async function openTool(tool: ToolSummary, event: MouseEvent) {
    event.preventDefault();
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
    const blob = new Blob([exportWorkbenchConfig(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workbench-config-v1.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function previewImport(file: File | undefined) {
    if (file === undefined) return;
    try {
      setImportPreview(previewWorkbenchImport(await file.text(), state));
    } catch {
      setImportPreview({ ok: false, error: "This configuration could not be read. Try another file." });
    }
  }

  async function applyImport() {
    if (importPreview === null || !importPreview.ok) return;
    const next = applyImportedConfig(state, importPreview.config);
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
  const firstTool = tools[0];

  return (
    <div
      class={styles.shell}
      data-ready={ready ? "true" : "false"}
      data-saving={saving ? "true" : "false"}
      aria-busy={saving}
    >
      <header class={styles.intro}>
        <p class={styles.eyebrow}>Local personal workspace</p>
        <h1>Workbench</h1>
        <p class={styles.lede}>The small set of utilities you use most, ready with your local defaults.</p>
        <a class={styles.setupLink} href="/onboarding/">Set up a starter set</a>
      </header>

      {warning !== "" && (
        <section class={styles.warning} role="status" aria-label="Storage warning">
          <strong>Storage is unavailable.</strong>
          <span>Changes still work in this tab but may be lost on reload. {warning}</span>
          <button type="button" onClick={() => void persist(state)}>Retry save</button>
        </section>
      )}

      <section id="your-tools" class={styles.section} aria-labelledby="your-tools-title">
        <div class={styles.sectionHeading}>
          <div>
            <p class={styles.eyebrow}>Start here</p>
            <h2 id="your-tools-title">Your Tools</h2>
          </div>
          <span class={styles.count}>{state.installedTools.length} installed · 10–15 target</span>
        </div>

        {installed.length === 0 ? (
          <div class={styles.empty}>
            <p>No tools installed yet.</p>
            <p class={styles.muted}>Start with one utility. Suggestions and the full Library stay out of the way until you ask for them.</p>
            <div class={styles.emptyActions}>
              {firstTool !== undefined && (
                <button class={styles.primary} type="button" onClick={() => void add(firstTool.id)}>
                  Add {firstTool.name}
                </button>
              )}
              <a href="/onboarding/">Set up my tools</a>
              <a href="/library/">Browse Library</a>
            </div>
          </div>
        ) : (
          <ol class={styles.toolList + (state.preferences.compactRows ? " " + styles.compact : "")}>
            {installed.map(({ id, tool }, index) => {
              const usage = tool === undefined ? "" : profileUsage(tool, state.profile);
              const name = toolName(id, tools);
              return (
                <li class={styles.toolRow} key={id} data-tool-id={id}>
                  <div class={styles.toolIdentity}>
                    <strong>{name}</strong>
                    {tool === undefined ? (
                      <small>Saved here, but unavailable in the current catalog.</small>
                    ) : (
                      <>
                        <span class={styles.task}>{tool.summary}</span>
                        <small class={styles.rowMeta}>{runtimeLabel(tool)}</small>
                        {usage !== "" && (
                          <small class={styles.rowMeta}>
                            {usage} <b>from Work Profile</b>
                          </small>
                        )}
                      </>
                    )}
                  </div>
                  <div class={styles.rowActions}>
                    {tool !== undefined && (
                      <a class={styles.openLink} href={tool.route} onClick={(event) => void openTool(tool, event)}>
                        Open
                      </a>
                    )}
                    <details class={styles.manage}>
                      <summary aria-label={"Manage " + name}>Manage</summary>
                      <div class={styles.manageActions}>
                        <button
                          type="button"
                          aria-label={"Move " + name + " up"}
                          disabled={index === 0}
                          onClick={() => void move(id, -1)}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          aria-label={"Move " + name + " down"}
                          disabled={index === installed.length - 1}
                          onClick={() => void move(id, 1)}
                        >
                          Move down
                        </button>
                        <button class={styles.remove} type="button" onClick={() => void remove(id)}>
                          Remove
                        </button>
                      </div>
                    </details>
                  </div>
                </li>
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
              {showAvailable ? "Hide available tools" : "Add a tool"}
            </button>
            {showAvailable && (
              <ul id="available-tools">
                {available.map((tool) => (
                  <li key={tool.id}>
                    <span><strong>{tool.name}</strong> — {tool.summary}</span>
                    <button type="button" onClick={() => void add(tool.id)}>Add</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section id="recent" class={styles.section} aria-labelledby="recent-title">
        <div class={styles.sectionHeading}>
          <div>
            <p class={styles.eyebrow}>Tool-level activity only</p>
            <h2 id="recent-title">Recent</h2>
          </div>
          {state.recent.length > 0 && (
            <button type="button" onClick={() => void persist(clearRecent(state))}>Clear recent</button>
          )}
        </div>
        {state.recent.length === 0 ? (
          <p class={styles.muted}>No recent tool activity. Inputs, outputs, URLs and files are not stored here.</p>
        ) : (
          <ul class={styles.recentList}>
            {state.recent.map((entry) => {
              const tool = tools.find((item) => item.id === entry.toolId);
              return (
                <li key={entry.toolId} data-recent-tool-id={entry.toolId}>
                  <div>
                    <strong>{toolName(entry.toolId, tools)}</strong>
                    <span>{formatRecentActivity(entry.lastUsedAt)} · opened {entry.useCount}×</span>
                  </div>
                  {tool !== undefined && (
                    <a href={tool.route} onClick={(event) => void openTool(tool, event)}>Run again</a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="suggestions" class={styles.section} aria-labelledby="suggestions-title">
        <div class={styles.sectionHeading}>
          <div>
            <p class={styles.eyebrow}>Deterministic local signals</p>
            <h2 id="suggestions-title">Suggestions</h2>
          </div>
          {suggestions.length > 0 && <span class={styles.count}>{suggestions.length} shown</span>}
        </div>
        {suggestions.length === 0 ? (
          <p class={styles.muted}>
            Suggestions appear when an available tool shares a task, input, Work Profile default, or handoff with your installed tools.
          </p>
        ) : (
          <ul class={styles.suggestionList}>
            {suggestions.map(({ tool, reason }) => (
              <li key={tool.id} data-suggestion-id={tool.id}>
                <div>
                  <strong>{tool.name}</strong>
                  <span>{tool.summary}</span>
                  <small data-suggestion-reason>{reason}</small>
                </div>
                <button
                  type="button"
                  aria-label={"Add " + tool.name + " to Workbench"}
                  data-suggestion-action
                  onClick={() => void add(tool.id)}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
        <a class={styles.libraryLink} href="/library/">Browse the full Library <span>{tools.length} tools</span></a>
      </section>

      <section id="work-profile" class={styles.section} aria-labelledby="profile-title">
        <div class={styles.sectionHeading}>
          <div>
            <p class={styles.eyebrow}>Safe reusable defaults</p>
            <h2 id="profile-title">Work Profile</h2>
          </div>
          <span class={styles.localBadge}>Stored locally</span>
        </div>
        <p class={styles.muted}>
          Compatible tools receive only the fields they declare. A value changed for one task remains the current-task override.
        </p>

        <div class="field-grid">
          <label class="field">
            <span>Locale</span>
            <input value={profileDraft.locale} onInput={(event) => setProfile("locale", event.currentTarget.value)} />
          </label>
          <label class="field">
            <span>Timezone</span>
            <input value={profileDraft.timezone} onInput={(event) => setProfile("timezone", event.currentTarget.value)} />
          </label>
          <label class="field">
            <span>Currency</span>
            <input value={profileDraft.currency} onInput={(event) => setProfile("currency", event.currentTarget.value.toUpperCase())} />
          </label>
          <label class="field">
            <span>Date format</span>
            <select value={profileDraft.dateFormat} onChange={(event) => setProfile("dateFormat", event.currentTarget.value as WorkProfile["dateFormat"])}>
              <option value="system">System</option>
              <option value="day-first">Day first</option>
              <option value="month-first">Month first</option>
            </select>
          </label>
          <label class="field">
            <span>Number format</span>
            <select value={profileDraft.numberFormat} onChange={(event) => setProfile("numberFormat", event.currentTarget.value as WorkProfile["numberFormat"])}>
              <option value="system">System</option>
              <option value="decimal-comma">Decimal comma</option>
              <option value="decimal-point">Decimal point</option>
            </select>
          </label>
          <label class="field">
            <span>Preferred units</span>
            <select value={profileDraft.preferredUnits} onChange={(event) => setProfile("preferredUnits", event.currentTarget.value as WorkProfile["preferredUnits"])}>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
        </div>

        <fieldset class="workweek-fieldset">
          <legend>Workweek</legend>
          <div class="weekday-row">
            {DAYS.map(({ code, label }) => (
              <label key={code}>
                <input type="checkbox" checked={profileDraft.workweek.includes(code)} onChange={() => toggleDay(code)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="actions">
          <button class={styles.primary} type="button" onClick={() => void saveProfile()}>Save Work Profile</button>
          <label class={styles.checkboxLine}>
            <input
              type="checkbox"
              checked={state.preferences.compactRows}
              onChange={(event) => void persist({
                ...state,
                preferences: { ...state.preferences, compactRows: event.currentTarget.checked },
              })}
            />
            Compact tool rows
          </label>
        </div>
      </section>

      <section class={styles.section} aria-labelledby="portable-title">
        <div class={styles.sectionHeading}>
          <div>
            <p class={styles.eyebrow}>No cloud sync required</p>
            <h2 id="portable-title">Portable configuration</h2>
          </div>
        </div>
        <p class={styles.muted}>
          Export includes installed tools, packs, layout, safe Work Profile fields and preferences. It excludes Recent and task content.
        </p>
        <div class="actions">
          <button type="button" onClick={downloadConfig}>Export configuration</button>
          <label class={styles.importFile}>
            <span>Choose configuration to import</span>
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
                <strong>Import preview</strong>
                <ul>
                  <li>{importPreview.summary.addedTools.length} tool(s) added</li>
                  <li>{importPreview.summary.removedTools.length} tool(s) removed</li>
                  <li>Work Profile {importPreview.summary.profileChanged ? "will change" : "unchanged"}</li>
                  <li>Preferences {importPreview.summary.preferencesChanged ? "will change" : "unchanged"}</li>
                  <li>Packs {importPreview.summary.packsChanged ? "will change" : "unchanged"}</li>
                </ul>
                <div class="actions">
                  <button class={styles.primary} type="button" onClick={() => void applyImport()}>Apply import</button>
                  <button type="button" onClick={() => setImportPreview(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <strong>Import not applied.</strong>
                <span>{importPreview.error}</span>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
