import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";

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
  return JSON.stringify(value, null, 2) ?? "";
}

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
      setError(run.message);
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
                  {(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}
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
          <ToolSubmitButton busy={busy} busyLabel="Working…">{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={busy} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.resultLabel} placeholder="The deterministic result appears here." className="research-result" busy={busy}>
        {result !== null && <pre class="research-output" tabIndex={0} aria-label="Research result">{outputText(result)}</pre>}
      </ToolResultPanel>
      <p class="research-method">{config.description}</p>
    </div>
  );
}
