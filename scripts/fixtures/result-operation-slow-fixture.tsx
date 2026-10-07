import { render } from "preact";
import { useState } from "preact/hooks";
import { InlineError } from "../../src/components/tools/shared/InlineError";
import { ToolCancelButton, ToolSubmitButton } from "../../src/components/tools/shared/ToolActions";
import { ToolOperation } from "../../src/components/tools/shared/ToolOperation";
import { ToolResultPanel } from "../../src/components/tools/shared/ToolResultPanel";
import { useToolOperation } from "../../src/components/tools/shared/useToolOperation";
import type { ToolRunResult } from "../../src/runtime/types";

interface PendingRun {
  readonly id: number;
  readonly input: string;
  readonly signal: AbortSignal;
  readonly resolve: (result: ToolRunResult) => void;
}

interface SlowFixtureController {
  ids(): readonly number[];
  inputFor(id: number): string | null;
  resolve(id: number): void;
  fail(id: number): void;
}

const pending = new Map<number, PendingRun>();
let nextId = 1;

function controlledExecute(input: string, signal: AbortSignal): Promise<ToolRunResult> {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve) => {
    pending.set(id, { id, input, signal, resolve });
  });
}

function settle(id: number, result: ToolRunResult): void {
  const run = pending.get(id);
  if (run === undefined) throw new Error("Unknown controlled run id " + String(id));
  pending.delete(id);
  run.resolve(result);
}

const fixtureController: SlowFixtureController = {
  ids: () => [...pending.keys()],
  inputFor: (id) => pending.get(id)?.input ?? null,
  resolve: (id) => {
    const run = pending.get(id);
    if (run === undefined) throw new Error("Unknown controlled run id " + String(id));
    settle(id, {
      ok: true,
      tool: {} as never,
      value: { value: run.input + ":" + String(id) },
      defaults: [],
    });
  },
  fail: (id) => settle(id, {
    ok: false,
    code: "INVALID_INPUT",
    message: "Controlled failure.",
  }),
};

(window as unknown as { __slowFixture: SlowFixtureController }).__slowFixture = fixtureController;

function SlowOperationFixture() {
  const [input, setInput] = useState("dato-preservato");
  const operation = useToolOperation<{ value: string }>(
    (signal) => controlledExecute(input, signal),
    { formatError: () => "Errore controllato. Correggi o riprova." },
  );

  return (
    <ToolOperation busy={operation.isRunning}>
      <form
        data-fixture-form
        data-fixture-status={operation.status}
        onSubmit={(event) => {
          event.preventDefault();
          void operation.run();
        }}
      >
        <label>
          Valore
          <input
            aria-label="Valore"
            value={input}
            onInput={(event) => setInput(event.currentTarget.value)}
          />
        </label>
        <InlineError message={operation.status === "error" ? operation.error : ""} />
        <div class="actions">
          <ToolSubmitButton busy={operation.isRunning} busyLabel="In corso">
            {operation.canRetry ? "Riprova" : "Esegui"}
          </ToolSubmitButton>
          {operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : null}
        </div>
      </form>
      <ToolResultPanel
        eyebrow="Risultato"
        placeholder="Nessun risultato."
        state={operation.status}
        busy={operation.isRunning}
      >
        {operation.status === "success"
          ? <output data-fixture-result>{operation.result.value}</output>
          : null}
      </ToolResultPanel>
    </ToolOperation>
  );
}

const root = document.getElementById("app");
if (root === null) throw new Error("Missing acceptance fixture root.");
render(<SlowOperationFixture />, root);
