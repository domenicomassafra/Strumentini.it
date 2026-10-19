import { useState } from "preact/hooks";
import type { PercentageMode } from "../../../engines/business-math";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolRunResult } from "../../../runtime/types";
import type { PercentageHelperOutput } from "../../../tools/percentage-helper/types";
import {
  InlineError, ResultAssumptions, ResultBreakdown, ResultExplanation,
  ResultInterpretation, ResultPrimaryAnswer, ResultProvenance, ToolActions,
  ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton,
  gutterStateFor, useToolOperation,
} from "../shared";
import { percentageJobs } from "./percentage-jobs";

type InputValues = Record<string, string>;

function defaults(mode: PercentageMode): InputValues {
  const job = percentageJobs.find((item) => item.mode === mode)!;
  return Object.fromEntries(job.fields.map((field) => [field.name, field.value]));
}

function numberIt(value: string): string {
  return value.replace(".", ",");
}

function errorIt(run: Extract<ToolRunResult, { ok: false }>): string {
  if (/INVALID_BASE|INVALID_AMOUNT/u.test(run.message)) {
    return "Controlla i valori: la base di un rapporto o di una variazione deve essere diversa da zero.";
  }
  if (/INVALID_RATE/u.test(run.message)) {
    return "Percentuale non valida: per invertire uno sconto serve un valore da 0% a meno di 100%. Negli sconti successivi usa valori da 0% a 100%.";
  }
  return "Impossibile calcolare: inserisci numeri decimali validi, senza separatori delle migliaia.";
}

export function PercentageHelperTool() {
  const [mode, setMode] = useState<PercentageMode>("of");
  const [values, setValues] = useState<InputValues>(() => defaults("of"));
  const job = percentageJobs.find((item) => item.mode === mode)!;
  const operation = useToolOperation<PercentageHelperOutput>(
    (signal) => toolRuntime.run("percentage-helper", { mode, ...values }, {}, signal),
    { formatError: errorIt },
  );
  const result = operation.result;
  const isRateAnswer = mode === "what-percent" || mode === "variation";
  const primary = result === null ? "" : numberIt(result.result)
    + (isRateAnswer ? "%" : "");
  const signedPrimary = mode === "variation" && result !== null && Number(result.result) > 0
    ? "+" + primary : primary;

  function changeMode(nextMode: PercentageMode) {
    setMode(nextMode);
    setValues(defaults(nextMode));
    operation.reset();
  }

  function changeValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    operation.reset();
  }

  function invert() {
    if (result === null) return;
    const nextMode = job.inverse;
    const next = defaults(nextMode);
    if (mode === "variation") {
      next.base = values.amount ?? "";
      next.amount = values.base ?? "";
    } else if (mode === "of") {
      next.base = values.base ?? "";
      next.amount = result.result;
    } else if (mode === "what-percent") {
      next.base = values.base ?? "";
      next.ratePercent = result.result;
    } else {
      next.base = result.result;
      if (values.ratePercent !== undefined) next.ratePercent = values.ratePercent;
      if (values.rates !== undefined) next.rates = values.rates;
    }
    setMode(nextMode);
    setValues(next);
    operation.reset();
  }

  function reset() {
    changeMode("of");
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
        <div class="field-grid">
          <label class="field" htmlFor="percentage-job-mode">
            <span>Che cosa vuoi calcolare?</span>
            <select id="percentage-job-mode" value={mode}
              onChange={(event) => changeMode(event.currentTarget.value as PercentageMode)}>
              {percentageJobs.map((item) => <option key={item.mode} value={item.mode}>{item.label}</option>)}
            </select>
          </label>
          {job.fields.map((field) => (
            <label class="field" key={field.name} htmlFor={"percentage-job-" + field.name}>
              <span>{field.label}</span>
              <input id={"percentage-job-" + field.name} type="text" inputMode="decimal"
                value={values[field.name] ?? ""}
                onInput={(event) => changeValue(field.name, event.currentTarget.value)} />
            </label>
          ))}
        </div>
        <p><strong>Esempio:</strong> {job.example}</p>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning}>Calcola</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>Ripristina</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="Scegli il calcolo e inserisci i valori."
        busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && (
          <>
            <ResultExplanation
              primary={<ResultPrimaryAnswer label={job.answerLabel}>{signedPrimary}</ResultPrimaryAnswer>}
              interpretation={<ResultInterpretation state="success">
                Risposta calcolata con i valori inseriti. La formula è riportata sotto.
              </ResultInterpretation>}
              breakdown={<ResultBreakdown rows={job.fields.map((field) => ({
                label: field.label, value: values[field.name] ?? "",
              }))} />}
              assumptions={<ResultAssumptions label="Formula" items={[
                { label: job.label, value: job.formula },
                { label: "Arrotondamento", value: "Due decimali, metà verso l'alto; calcolo esatto prima dell'arrotondamento finale." },
              ]} />}
              provenance={<ResultProvenance>Calcolo aritmetico locale; per gli sconti le percentuali si applicano in sequenza.</ResultProvenance>}
            />
            <button type="button" onClick={invert}>Imposta il calcolo inverso</button>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
