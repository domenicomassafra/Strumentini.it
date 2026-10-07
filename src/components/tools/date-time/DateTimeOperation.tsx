import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import { dateTimeResultDeclaration } from "../../../date-time/manifest";
import { profileValuesForTool } from "../../../profile/work-profile";
import { createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { useWorkProfile } from "../client-time-math/work-profile";
import { CONTROL, it } from "../shared/controlLabels";
import {
  BoundedTextResultPreview,
  InlineError,
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
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
import {
  DATE_TIME_UI_IT,
  dateTimeFieldHelpIt,
  dateTimeFieldLabelIt,
  dateTimeOptionLabelIt,
  dateTimeResultHeadlineIt,
  localizeDateTimeResultIt,
} from "../../../i18n/it/date-time";

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
  /**
   * Per-tool Italian error copy for a machine code the shared date/time
   * sentence cannot explain (for example an unsupported country). Returning
   * `undefined` keeps the shared sentence.
   */
  errorMessage?: (message: string) => string | undefined;
}

function initialValues(config: DateTimeToolConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

function fieldInput(field: DateTimeField, value: string, onInput: (value: string) => void) {
  if (field.type === "select") {
    return <select required={field.required} value={value} onChange={(event) => onInput(event.currentTarget.value)}>{(field.options ?? []).map((option) => <option value={option} key={option}>{dateTimeOptionLabelIt(option)}</option>)}</select>;
  }
  if (field.type === "textarea") {
    return <textarea required={field.required} rows={4} value={value} placeholder={field.placeholder} onInput={(event) => onInput(event.currentTarget.value)} />;
  }
  return <input required={field.required} type={field.type} step={field.step} value={value} placeholder={field.placeholder} onInput={(event) => onInput(event.currentTarget.value)} />;
}

function displayResultValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 }).format(value);
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (Array.isArray(value)) {
    return value.length <= 8
      ? value.map((entry) => displayResultValue(entry)).join(", ")
      : String(value.length) + " elementi";
  }
  return JSON.stringify(value);
}

function resultRows(value: unknown): Array<{ label: string; value: string }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ label: "Valore", value: displayResultValue(value) }];
  }
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "engineVersion")
    .map(([key, entry]) => ({ label: key, value: displayResultValue(entry) }));
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
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(
      config.tool.id,
      config.buildInput(values),
      { profile: profileValuesForTool(config.tool, profile) },
      signal,
    ),
    { formatError: (result) => config.errorMessage?.(result.message) ?? "Controlla i valori e le regole di data, ora e fuso orario, quindi riprova." },
  );
  const localizedResult = useMemo(
    () => operation.result === null ? null : localizeDateTimeResultIt(operation.result),
    [operation.result],
  );
  const resultText = useMemo(
    () => localizedResult === null ? "" : JSON.stringify(localizedResult, null, 2),
    [localizedResult],
  );

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
    setActionStatus("");
    operation.reset();
  }

  const gutterState = gutterStateFor(operation.status);
  // resultLabel reads a field off the result, so it must never see null — that
  // is the state before the tool has run, which is every page's first render.
  const resultHeadline = operation.result === null ? "" : dateTimeResultHeadlineIt(config.tool.id, operation.result);
  const declaration = dateTimeResultDeclaration(config.tool.id);
  const artifact = useMemo(() => {
    if (operation.result === null) return null;
    const download = config.download;
    const isDownload = download !== undefined;
    const fullText = download === undefined ? resultText : download.value(operation.result);
    const mime = download === undefined ? "application/json" : download.mimeType;
    return createOutputArtifactDescriptor({
      kind: isDownload ? "text" : "structured",
      name: download === undefined ? config.tool.id + "-risultato.json" : download.name,
      mime,
      bytes: new TextEncoder().encode(fullText),
      verification: {
        state: "verified",
        verifiedMime: mime,
        method: isDownload ? "serializer output from the local calendar engine" : "JSON serializer output from the local date/time result",
      },
      fidelity: "structural",
      fidelityNote: isDownload
        ? "Il file contiene il testo calendario completo prodotto dal motore."
        : "Il file in memoria conserva il risultato completo usato dall'anteprima.",
    });
  }, [config.download, config.tool.id, operation.result, resultText]);
  const preview = useMemo(
    () => artifact === null ? null : createBoundedTextPreview(artifact, 80, "code"),
    [artifact],
  );
  const copyPayload = useMemo(
    () => artifact === null ? "" : new TextDecoder().decode(artifact.bytes),
    [artifact],
  );
  const assumptions = useMemo(() => {
    const context = profileValuesForTool(config.tool, profile);
    return Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ({
        label: dateTimeFieldLabelIt(key, key),
        value: displayResultValue(value),
      }));
  }, [config.tool, profile]);
  const resultActions = operation.result === null || artifact === null
    ? []
    : resolveResultActions({
        declaration,
        primary: "copy",
        hasCopyPayload: copyPayload !== "",
        ...(config.download === undefined ? {} : { artifact }),
        retryReady: declaration.class === "validator",
        resetReady: true,
      });
  const uiCopy = DATE_TIME_UI_IT[config.tool.id] ?? {
    eyebrow: config.eyebrow,
    placeholder: config.placeholder,
    submit: config.submitLabel,
  };

  async function copyResult() {
    if (copyPayload === "" || navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyPayload);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("L'accesso agli appunti è stato bloccato; seleziona e copia manualmente.");
    }
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          {config.fields.map((field) => (
            <label class="field" key={field.key}>
              <span>{dateTimeFieldLabelIt(field.key, field.label)}{field.required === true ? "" : " · facoltativo"}</span>
              {fieldInput(field, values[field.key] ?? "", (value) => update(field.key, value))}
              {dateTimeFieldHelpIt(field.key) !== undefined && <small>{dateTimeFieldHelpIt(field.key)}</small>}
            </label>
          ))}
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{uiCopy.submit}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={uiCopy.eyebrow} placeholder={uiCopy.placeholder} busy={operation.isRunning} state={gutterState}>
        {(operation.result !== null || operation.isRunning) && (
          <div data-result-class={declaration.class}>
            <ResultExplanation
              primary={
                <div data-result-slot={declaration.class === "calculator" || declaration.class === "validator" ? "primary" : undefined}>
                  <ResultPrimaryAnswer label={uiCopy.eyebrow}>
                    <PreviousValue value={resultHeadline} className="" retain={operation.isRunning} />
                  </ResultPrimaryAnswer>
                </div>
              }
              interpretation={
                <div data-result-slot={declaration.class === "calculator" || declaration.class === "validator" ? "interpretation" : undefined}>
                  {operation.result === null
                    ? <ResultInterpretation>Elaborazione in corso.</ResultInterpretation>
                    : declaration.class === "validator"
                      ? <ResultInterpretation state="success">Il contenuto calendario è stato analizzato localmente.</ResultInterpretation>
                      : declaration.class === "text-code"
                        ? <ResultInterpretation state="success">Il testo calendario è pronto e resta nel browser.</ResultInterpretation>
                        : <ResultInterpretation state="success">Calcolo completato con le regole di data e fuso indicate.</ResultInterpretation>}
                </div>
              }
              breakdown={
                localizedResult === null
                  ? undefined
                  : <div data-result-slot={declaration.class === "validator" ? "checks" : declaration.class === "calculator" ? "breakdown" : undefined}>
                      <ResultBreakdown rows={resultRows(localizedResult)} />
                    </div>
              }
              assumptions={
                assumptions.length === 0
                  ? undefined
                  : <div data-result-slot={declaration.class === "calculator" ? "assumptions" : undefined}>
                      <ResultAssumptions items={assumptions} />
                    </div>
              }
              provenance={
                operation.result === null
                  ? undefined
                  : <div data-result-slot={declaration.class === "calculator" || declaration.class === "validator" ? "provenance" : undefined}>
                      <ResultProvenance>
                        Elaborazione locale. Date, fuso orario e calendario usano solo i valori mostrati o il profilo locale dichiarato.
                      </ResultProvenance>
                    </div>
              }
            />
            {operation.result !== null && preview !== null && (
              declaration.class === "text-code"
                ? <>
                    <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
                    <div data-result-slot="counts"><ResultBreakdown rows={[{ label: "Byte del calendario", value: String(artifact?.byteLength ?? 0) }]} /></div>
                  </>
                : <details data-result-secondary-raw>
                    <summary>Dati completi</summary>
                    <BoundedTextResultPreview preview={preview} />
                  </details>
            )}
            {operation.result !== null && (
              <ResultActions
                actions={resultActions}
                onAction={{
                  copy: copyResult,
                  download: () => downloadResult(config, operation.result),
                  retry: operation.retry,
                  reset,
                }}
              />
            )}
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
