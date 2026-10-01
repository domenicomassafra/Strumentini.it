import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import { InlineError, ToolActions, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";
import { CONTROL, it } from "../shared/controlLabels";

export interface ResearchToolField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select";
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
  options?: readonly string[];
}

export interface ResearchKnowledgeToolConfig {
  toolId: string;
  title: string;
  description: string;
  submitLabel: string;
  resultLabel: string;
  fields: readonly ResearchToolField[];
}

function outputText(value: unknown): string {
  if (typeof value !== "object" || value === null) return String(value ?? "");
  const record = value as Record<string, unknown>;
  for (const key of ["output", "bibtex", "ris", "csv", "citation"]) {
    if (typeof record[key] === "string") return record[key];
  }
  const keys: Readonly<Record<string, string>> = {
    valid: "valido",
    normalized: "normalizzato",
    kind: "tipo",
    input: "ingresso",
    records: "record",
    duplicates: "duplicati",
    removed: "rimossi",
    kept: "mantenuti",
    warnings: "avvisi",
    warning: "avviso",
    count: "quantità",
    total: "totale",
    domain: "dominio",
    domains: "domini",
    frequency: "frequenza",
    frequencies: "frequenze",
    terms: "termini",
    dates: "date",
    invalid: "non_validi",
    precision: "precisione",
    checksum: "checksum",
    tools: "strumenti",
    name: "nome",
    key: "chiave",
    keys: "chiavi",
  };
  const localize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(localize);
    if (entry === null || typeof entry !== "object") return entry;
    return Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, item]) => [keys[key] ?? key, localize(item)]));
  };
  return JSON.stringify(localize(value), null, 2) ?? "";
}

const OPTION_LABEL_IT: Readonly<Record<string, string>> = {
  identifier: "Identificatore",
  "title-author-year": "Titolo, autore e anno",
  exact: "Corrispondenza esatta",
  "ris-to-bibtex": "Da RIS a BibTeX",
  "bibtex-to-ris": "Da BibTeX a RIS",
  author: "Autore",
  year: "Anno",
  title: "Titolo",
  apa: "APA",
  mla: "MLA",
  chicago: "Chicago",
  ascending: "Crescente",
  descending: "Decrescente",
  false: "No",
  true: "Sì",
};

export function ResearchKnowledgeTool({ config }: { config: ResearchKnowledgeToolConfig }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue ?? ""])));
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: Event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const run = await toolRuntime.run(config.toolId, values);
    setBusy(false);
    if (!run.ok) {
      setError(friendlyToolErrorIt(run.message || run.code));
      return;
    }
    setResult(run.value);
  }

  function reset() {
    setValues(Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue ?? ""])));
    setResult(null);
    setError("");
  }

  return (
    <div class="tool-operation" data-tool-id={config.toolId}>
      <form onSubmit={submit}>
        {config.fields.map((field) => {
          const value = values[field.name] ?? "";
          const id = `${config.toolId}-${field.name}`;
          if (field.kind === "select") {
            return (
              <label class="field" for={id} key={field.name}>
                <span>{field.label}</span>
                <select id={id} value={value} onChange={(event) => update(field.name, event.currentTarget.value)}>
                  {(field.options ?? []).map((option) => <option value={option} key={option}>{OPTION_LABEL_IT[option] ?? option}</option>)}
                </select>
              </label>
            );
          }
          if (field.kind === "textarea") {
            return (
              <label class="field" for={id} key={field.name}>
                <span>{field.label}</span>
                <textarea id={id} rows={field.rows ?? 8} value={value} placeholder={field.placeholder} onInput={(event) => update(field.name, event.currentTarget.value)} />
              </label>
            );
          }
          return (
            <label class="field" for={id} key={field.name}>
              <span>{field.label}</span>
              <input id={id} type="text" value={value} placeholder={field.placeholder} onInput={(event) => update(field.name, event.currentTarget.value)} />
            </label>
          );
        })}
        <InlineError message={error} />
        <ToolActions>
          <ToolSubmitButton busy={busy} busyLabel={it(CONTROL.working)}>{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={busy} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.resultLabel} placeholder="Il risultato deterministico apparirà qui." className="research-result" busy={busy}>
        {result !== null && <pre class="research-output">{outputText(result)}</pre>}
      </ToolResultPanel>
      <p class="research-method">{config.description}</p>
    </div>
  );
}
