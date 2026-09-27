import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { profileValuesForTool } from "../../../profile/work-profile";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { useWorkProfile } from "../client-time-math/work-profile";
import { CONTROL, it } from "../shared/controlLabels";
import {
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import type { ToolSummary } from "../../../catalog/manifest";
import { PreviousValue } from "../shared/PreviousValue";

export type DateTimeFieldType = "date" | "time" | "number" | "text" | "textarea" | "select";

export interface DateTimeField {
  key: string;
  label: string;
  type: DateTimeFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly string[];
  step?: string;
  defaultValue?: string;
}

export interface DateTimeToolConfig {
  tool: ToolSummary;
  fields: readonly DateTimeField[];
  buildInput: (values: Readonly<Record<string, string>>) => unknown;
  eyebrow: string;
  placeholder: string;
  submitLabel: string;
  resultLabel?: (result: unknown) => ComponentChildren;
  download?: { name: string; mimeType: string; value: (result: unknown) => string };
}

function initialValues(config: DateTimeToolConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

function fieldInput(field: DateTimeField, value: string, onInput: (value: string) => void) {
  if (field.type === "select") {
    return <select required={field.required} value={value} onChange={(event) => onInput(event.currentTarget.value)}>{(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}</select>;
  }
  if (field.type === "textarea") {
    return <textarea required={field.required} rows={4} value={value} placeholder={field.placeholder} onInput={(event) => onInput(event.currentTarget.value)} />;
  }
  return <input required={field.required} type={field.type} step={field.step} value={value} placeholder={field.placeholder} onInput={(event) => onInput(event.currentTarget.value)} />;
}

function downloadResult(config: DateTimeToolConfig, result: unknown): void {
  if (config.download === undefined || typeof document === "undefined") return;
  const value = config.download.value(result);
  const blob = new Blob([value], { type: config.download.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = config.download.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DateTimeOperation({ config }: { config: DateTimeToolConfig }) {
  const { profile } = useWorkProfile();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config));
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(
      config.tool.id,
      config.buildInput(values),
      { profile: profileValuesForTool(config.tool, profile) },
      signal,
    ),
    { formatError: (result) => result.message.startsWith("INVALID_") ? "Check the values and date/time rules, then try again." : result.message },
  );
  const resultText = useMemo(() => operation.result === null ? "" : JSON.stringify(operation.result, null, 2), [operation.result]);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    operation.reset();
  }

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setValues(initialValues(config));
    operation.reset();
  }

  const gutterState = gutterStateFor(operation.status);
  // resultLabel reads a field off the result, so it must never see null — that
  // is the state before the tool has run, which is every page's first render.
  const headline = operation.result === null ? undefined : config.resultLabel?.(operation.result);
  const resultHeadline = typeof headline === "string" ? headline : "";

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          {config.fields.map((field) => (
            <label class="field" key={field.key}>
              <span>{field.label}{field.required === true ? "" : " optional"}</span>
              {fieldInput(field, values[field.key] ?? "", (value) => update(field.key, value))}
              {field.help !== undefined && <small>{field.help}</small>}
            </label>
          ))}
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.eyebrow} placeholder={config.placeholder} busy={operation.isRunning} state={gutterState}>
        {config.resultLabel !== undefined && <PreviousValue value={resultHeadline} retain={operation.isRunning} />}
        {operation.result !== null && (
          <>
            <pre class="result-json">{resultText}</pre>
            {config.download !== undefined && <div class="actions"><button type="button" onClick={() => downloadResult(config, operation.result)}>{it(CONTROL.download)}</button></div>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
