import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import {
  gutterStateFor,
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { isResearchResultV2ToolId } from "../../../tools/research-result-v2";
import { ResearchResultV2 } from "./ResearchResultV2";
import { ViesVerificationPanel } from "./ViesVerificationPanel";

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
  if (!isResearchResultV2ToolId(config.toolId)) throw new Error(`${config.toolId}: missing Result v2 research definition.`);
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(config.toolId, values, {}, signal),
    { formatError: (run) => friendlyToolErrorIt(run.message || run.code) },
  );

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: Event) {
    event.preventDefault();
    await operation.run();
  }

  function reset() {
    setValues(Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue ?? ""])));
    operation.reset();
  }

  function reuseResult(field: string, text: string) {
    if (!config.fields.some((candidate) => candidate.name === field)) return;
    setValues((current) => ({
      ...current,
      [field]: text,
      ...(config.toolId === "ris-bibtex-converter"
        ? { direction: current.direction === "bibtex-to-ris" ? "ris-to-bibtex" : "bibtex-to-ris" }
        : {}),
    }));
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
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
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow={config.resultLabel}
        placeholder="Il risultato deterministico apparirà qui."
        className="research-result"
        busy={operation.isRunning}
        state={gutterStateFor(operation.status)}
      >
        {operation.result !== null && (
          <>
            <ResearchResultV2
              tool={config.toolId}
              value={operation.result}
              onReuse={reuseResult}
              onRetry={operation.retry}
              onReset={reset}
            />
            {config.toolId === "partita-iva-validator" ? <ViesVerificationPanel localResult={operation.result} /> : null}
          </>
        )}
      </ToolResultPanel>
      <p class="research-method">{config.description}</p>
    </ToolOperation>
  );
}
