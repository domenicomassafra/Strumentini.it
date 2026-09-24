import { useRef, useState } from "preact/hooks";
import { FileHashError, checksumMatches, parseExpectedChecksum } from "../../../engines/file-hash";
import { hashBlobInWorker } from "../../../engines/file-hash/worker-client";
import {
  InlineError,
  ToolActions,
  ToolCancelButton,
  ToolOperation,
  ToolProgress,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
} from "../shared";

interface CompletedHash {
  digestHex: string;
  bytesHashed: number;
  matchesExpected: boolean | null;
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Hashing cancelled.";
  if (error instanceof FileHashError) {
    if (error.code === "MALFORMED_CHECKSUM") return "Expected SHA-256 must be exactly 64 hexadecimal characters.";
    if (error.code === "UNSUPPORTED_ALGORITHM") return "This tool currently supports SHA-256 only.";
    if (error.code === "READ_FAILURE") return "The selected file could not be read. Choose it again and retry.";
    if (error.code === "WORKER_FAILURE") return "The local hashing worker failed. Retry the operation.";
  }
  return error instanceof Error ? error.message : "Hashing failed.";
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

export function FileHashTool() {
  const [file, setFile] = useState<File | null>(null);
  const [expectedChecksum, setExpectedChecksum] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompletedHash | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setProgress(0);
    if (file === null) {
      setError("Choose a file to hash.");
      return;
    }

    let normalizedExpected: string | null = null;
    try {
      normalizedExpected = expectedChecksum.trim() === "" ? null : parseExpectedChecksum(expectedChecksum);
    } catch (caught) {
      setError(friendlyError(caught));
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    try {
      const hashed = await hashBlobInWorker(file, {
        signal: controller.signal,
        onProgress(update) {
          setProgress(update.fraction);
        },
      });
      if (controller.signal.aborted) return;
      setResult({
        digestHex: hashed.digestHex,
        bytesHashed: hashed.bytesHashed,
        matchesExpected: normalizedExpected === null ? null : checksumMatches(hashed.digestHex, normalizedExpected),
      });
      setProgress(1);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  }

  function reset() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setFile(null);
    setExpectedChecksum("");
    setProgress(0);
    setResult(null);
    setError("");
    setRunning(false);
    const picker = document.getElementById("file-hash-picker") as HTMLInputElement | null;
    if (picker !== null) picker.value = "";
  }

  return (
    <ToolOperation busy={running}>
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>File</span>
          <input
            id="file-hash-picker"
            required
            type="file"
            disabled={running}
            onChange={(event) => {
              setFile(event.currentTarget.files?.item(0) ?? null);
              setResult(null);
              setError("");
              setProgress(0);
            }}
          />
          <small>{file === null ? "Any file type · processed locally" : `${file.name} · ${formatBytes(file.size)}`}</small>
        </label>

        <label class="field">
          <span>Expected SHA-256 <em>optional</em></span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
            value={expectedChecksum}
            disabled={running}
            placeholder="64 hexadecimal characters"
            onInput={(event) => {
              setExpectedChecksum(event.currentTarget.value);
              setResult(null);
            }}
            aria-describedby="checksum-help"
          />
          <small id="checksum-help">Only surrounding whitespace and hexadecimal letter case are normalized.</small>
        </label>

        <ToolProgress
          value={progress}
          label="Hashing progress"
          status={running ? `${Math.floor(progress * 100)}% hashed` : result === null ? "Not started" : "100% complete"}
        />

        <InlineError message={error} />

        <ToolActions>
          <ToolSubmitButton busy={running} busyLabel="Hashing…">Calculate SHA-256</ToolSubmitButton>
          {running && <ToolCancelButton onCancel={() => controllerRef.current?.abort()} />}
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>

      <ToolResultPanel eyebrow="Result" placeholder="Your SHA-256 digest appears here." busy={running}>
        {result !== null && (
          <>
            {result.matchesExpected !== null && (
              <strong class="result-value">{result.matchesExpected ? "Checksum matches" : "Checksum does not match"}</strong>
            )}
            <code style={{ overflowWrap: "anywhere" }}>{result.digestHex}</code>
            <dl class="assumptions">
              <div><dt>Algorithm</dt><dd>SHA-256</dd></div>
              <div><dt>Bytes hashed</dt><dd>{formatBytes(result.bytesHashed)}</dd></div>
              <div><dt>Processing</dt><dd>Local worker · bounded chunks</dd></div>
            </dl>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
