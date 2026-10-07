import { useMemo, useState } from "preact/hooks";
import type { BridgeOptimizerResult, DayCode } from "../../engines/italy";
import type { ResultDeclaration } from "../../catalog/manifest";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ResultActions, ResultBreakdown, ResultExplanation, ResultInterpretation, ResultPrimaryAnswer, ResultProvenance, ToolActions, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation } from "./shared";

const DECLARATION: ResultDeclaration = { class: "calculator", capabilities: ["copy", "reset", "provenance"] };
const WEEKDAYS: readonly { code: DayCode; label: string }[] = [
  { code: "MON", label: "Lun" }, { code: "TUE", label: "Mar" }, { code: "WED", label: "Mer" }, { code: "THU", label: "Gio" }, { code: "FRI", label: "Ven" }, { code: "SAT", label: "Sab" }, { code: "SUN", label: "Dom" },
];

export function PontiFerieOptimizerTool() {
  const [budget, setBudget] = useState("4");
  const [workweek, setWorkweek] = useState<DayCode[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [copyStatus, setCopyStatus] = useState("");
  const operation = useToolOperation<BridgeOptimizerResult>(
    (signal) => toolRuntime.run("ponti-ferie-optimizer", { year: 2026, leaveDayBudget: budget, workweek, maxResults: 20 }, {}, signal),
    { formatError: () => "Controlla budget ferie e giorni della settimana lavorativa." },
  );
  function reset() { setBudget("4"); setWorkweek(["MON", "TUE", "WED", "THU", "FRI"]); setCopyStatus(""); operation.reset(); }
  const copyText = operation.result === null ? "" : operation.result.opportunities.map((item, index) => `${index + 1}. ${item.startDate} → ${item.endDate}: ${item.consecutiveDaysOff} giorni liberi con ${item.leaveDaysUsed} ferie (${item.leaveDates.join(", ") || "nessuna"})`).join("\n");
  const actions = useMemo(() => operation.result === null ? [] : resolveResultActions({ declaration: DECLARATION, primary: "copy", hasCopyPayload: copyText !== "", resetReady: true }), [operation.result, copyText]);
  async function copy() { if (navigator.clipboard === undefined) return setCopyStatus("Appunti non disponibili."); try { await navigator.clipboard.writeText(copyText); setCopyStatus("Opportunità copiate."); } catch { setCopyStatus("Il browser ha bloccato gli appunti."); } }
  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
      <label class="field" for="ponti-budget"><span>Giorni di ferie disponibili</span><input id="ponti-budget" type="number" min="0" max="60" step="1" value={budget} onInput={(event) => setBudget(event.currentTarget.value)} /></label>
      <fieldset class="field"><legend>Settimana lavorativa</legend><div class="actions" aria-label="Giorni lavorativi">{WEEKDAYS.map(({ code, label }) => <label class="check-field" key={code}><input type="checkbox" checked={workweek.includes(code)} onChange={(event) => setWorkweek(event.currentTarget.checked ? [...workweek, code] : workweek.filter((day) => day !== code))} /><span>{label}</span></label>)}</div><small>Le festività locali, compresa SS. Pietro e Paolo a Roma, non vengono aggiunte automaticamente.</small></fieldset>
      <InlineError message={operation.error} />
      <ToolActions><ToolSubmitButton busy={operation.isRunning}>Trova i ponti</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
    </form>
    <ToolResultPanel eyebrow="Ponti 2026" placeholder="Le opportunità sono ordinate per giorni consecutivi ottenuti rispetto alle ferie usate." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {operation.result !== null && <div data-result-class="calculator" data-oracle-entry="cand-258">
        <ResultExplanation
          primary={<ResultPrimaryAnswer label="Migliore opportunità">{operation.result.opportunities[0] === undefined ? "Nessuna" : `${operation.result.opportunities[0].consecutiveDaysOff} giorni`}</ResultPrimaryAnswer>}
          interpretation={<ResultInterpretation state="success">Festività nazionali 2026 e settimana lavorativa dichiarata sono applicate in locale. Gli anni non supportati non riusano questo calendario.</ResultInterpretation>}
          breakdown={<ResultBreakdown label="Opportunità" rows={operation.result.opportunities.slice(0, 10).map((item, index) => ({ label: `${index + 1}. ${item.startDate} → ${item.endDate}`, value: `${item.consecutiveDaysOff} giorni · ${item.leaveDaysUsed} ferie · ${item.leaveDates.join(", ") || "nessuna ferie"}` }))} />}
          provenance={<ResultProvenance>Normattiva · calendario nazionale 2026 · verificato {operation.result.provenance.checkedAt} · {operation.result.provenance.snapshotHash}</ResultProvenance>}
        />
        <ResultActions actions={actions} onAction={{ copy, reset }} />
        {copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
