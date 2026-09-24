import { useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import {
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import type { DeveloperWebToolId } from "../../engines/developer-web";

type FieldKind = "text" | "textarea" | "number" | "select";

interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly defaultValue: string;
  readonly placeholder?: string;
  readonly rows?: number;
  readonly options?: readonly string[];
  readonly required?: boolean;
}

export interface DeveloperWebToolConfig {
  readonly id: DeveloperWebToolId;
  readonly title: string;
  readonly eyebrow: string;
  readonly submitLabel: string;
  readonly placeholder: string;
  readonly fields: readonly FieldDefinition[];
}

const text = (key: string, label: string, defaultValue = "", placeholder = ""): FieldDefinition => ({ key, label, kind: "text", defaultValue, placeholder, required: true });
const optionalText = (key: string, label: string, defaultValue = "", placeholder = ""): FieldDefinition => ({ key, label, kind: "text", defaultValue, placeholder, required: false });
const area = (key: string, label: string, defaultValue = "", rows = 10): FieldDefinition => ({ key, label, kind: "textarea", defaultValue, rows, required: true });
const number = (key: string, label: string, defaultValue: string): FieldDefinition => ({ key, label, kind: "number", defaultValue, required: true });
const select = (key: string, label: string, options: readonly string[], defaultValue: string): FieldDefinition => ({ key, label, kind: "select", defaultValue, options, required: true });

export const DEVELOPER_WEB_CONFIGS: Readonly<Record<DeveloperWebToolId, DeveloperWebToolConfig>> = {
  "json-formatter": { id: "json-formatter", title: "JSON Formatter & Validator", eyebrow: "JSON result", submitLabel: "Format JSON", placeholder: "Enter a JSON document.", fields: [area("text", "JSON", '{"name":"Ada","items":[1,true,null]}'), select("mode", "Operation", ["format", "validate"], "format"), number("indent", "Indent spaces", "2"), select("sortKeys", "Sort object keys", ["false", "true"], "false")] },
  "yaml-formatter": { id: "yaml-formatter", title: "YAML Formatter & Validator", eyebrow: "YAML result", submitLabel: "Format YAML", placeholder: "Enter a supported YAML document.", fields: [area("text", "YAML", "name: Ada\nitems:\n  - one\n  - two\n"), number("indent", "Indent spaces", "2")] },
  "toml-formatter": { id: "toml-formatter", title: "TOML Formatter & Validator", eyebrow: "TOML result", submitLabel: "Format TOML", placeholder: "Enter a supported TOML document.", fields: [area("text", "TOML", "name = \"Ada\"\nenabled = true\n", 10)] },
  "json-yaml-converter": { id: "json-yaml-converter", title: "JSON ↔ YAML Converter", eyebrow: "Converted value", submitLabel: "Convert value", placeholder: "Enter JSON or YAML according to the selected direction.", fields: [area("text", "Source", "name: Ada\nitems:\n  - one\n  - two\n"), select("direction", "Direction", ["json-to-yaml", "yaml-to-json"], "yaml-to-json"), number("indent", "Indent spaces", "2")] },
  "url-codec": { id: "url-codec", title: "URL Encode & Decode", eyebrow: "Percent-coded value", submitLabel: "Convert value", placeholder: "Enter text to encode or decode.", fields: [area("text", "Text", "Say what‽", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("set", "URL set", ["component", "query", "path", "userinfo"], "component")] },
  "html-entity-codec": { id: "html-entity-codec", title: "HTML Entity Encode & Decode", eyebrow: "Entity value", submitLabel: "Convert entities", placeholder: "Enter text or entity references.", fields: [area("text", "Text", "<hello & goodbye>", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("numeric", "Numeric output", ["false", "true"], "false")] },
  "base64-codec": { id: "base64-codec", title: "Base64 Encode & Decode", eyebrow: "Base64 value", submitLabel: "Convert Base64", placeholder: "Enter UTF-8 text or Base64.", fields: [area("text", "Text", "Caffè ☕", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("urlSafe", "Alphabet", ["standard", "url-safe"], "standard")] },
  "jwt-inspector": { id: "jwt-inspector", title: "JWT Inspector", eyebrow: "JWT inspection", submitLabel: "Inspect JWT", placeholder: "Paste a compact JWT.", fields: [area("token", "JWT", "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ.", 4)] },
  "uuid-generator": { id: "uuid-generator", title: "UUID Generator", eyebrow: "Generated UUIDs", submitLabel: "Generate UUIDs", placeholder: "Choose a version and count.", fields: [number("count", "How many", "1"), select("version", "UUID version", ["4", "7"], "4"), select("uppercase", "Letter case", ["false", "true"], "false")] },
  "hash-generator": { id: "hash-generator", title: "Hash Generator", eyebrow: "Digest", submitLabel: "Hash text", placeholder: "Enter UTF-8 text to hash.", fields: [area("text", "Text", "abc", 4), select("algorithm", "Algorithm", ["SHA-256", "SHA-384", "SHA-512"], "SHA-256")] },
  "hmac-generator": { id: "hmac-generator", title: "HMAC Generator", eyebrow: "Authentication tag", submitLabel: "Generate HMAC", placeholder: "Enter a message and a local key.", fields: [area("message", "Message", "The quick brown fox jumps over the lazy dog", 4), text("key", "Key", "key"), select("algorithm", "Algorithm", ["SHA-256", "SHA-384", "SHA-512"], "SHA-256")] },
  "regex-tester": { id: "regex-tester", title: "Regex Tester", eyebrow: "Matches", submitLabel: "Test expression", placeholder: "Enter a regular expression and subject text.", fields: [text("pattern", "Pattern", "(\\w+)@(\\w+)"), optionalText("flags", "Flags", "g"), area("text", "Subject", "ada@example and grace@example", 5), optionalText("replacement", "Replacement", "")] },
  "cron-explainer": { id: "cron-explainer", title: "Cron Explainer", eyebrow: "Schedule explanation", submitLabel: "Explain cron", placeholder: "Enter a five-field POSIX cron expression.", fields: [text("expression", "Cron expression", "*/15 9-17 * * 1-5")] },
  "cron-next-run": { id: "cron-next-run", title: "Cron Next-Run Calculator", eyebrow: "Upcoming UTC runs", submitLabel: "Calculate next runs", placeholder: "Enter a cron expression and an optional ISO start time.", fields: [text("expression", "Cron expression", "*/15 * * * *"), optionalText("from", "From (UTC ISO)", "2026-01-01T00:00:00.000Z"), number("count", "How many runs", "5")] },
  "unix-timestamp": { id: "unix-timestamp", title: "Unix Timestamp Converter", eyebrow: "UTC date-time", submitLabel: "Convert timestamp", placeholder: "Enter a Unix timestamp or an ISO date.", fields: [text("value", "Timestamp or date", "0"), select("unit", "Unit", ["seconds", "milliseconds"], "seconds"), select("direction", "Direction", ["to-date", "to-timestamp"], "to-date")] },
  "http-status-reference": { id: "http-status-reference", title: "HTTP Status Reference", eyebrow: "Status meaning", submitLabel: "Look up status", placeholder: "Enter an HTTP status code.", fields: [number("status", "HTTP status", "404")] },
  "mime-type-lookup": { id: "mime-type-lookup", title: "MIME Type Lookup", eyebrow: "Media type evidence", submitLabel: "Look up type", placeholder: "Enter an extension, filename, or signature hex.", fields: [text("lookup", "Extension or filename", "png"), select("mode", "Lookup mode", ["extension", "signature"], "extension"), optionalText("bytes", "Signature hex (optional)", "")] },
  "user-agent-parser": { id: "user-agent-parser", title: "User-Agent Parser", eyebrow: "Descriptive hints", submitLabel: "Parse user-agent", placeholder: "Paste a user-agent string.", fields: [area("userAgent", "User-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", 5)] },
  "query-string-editor": { id: "query-string-editor", title: "Query-String Editor", eyebrow: "Edited query", submitLabel: "Edit query", placeholder: "Enter a query string or full URL.", fields: [area("query", "Query or URL", "a=1&a=2&blank=&space=hello+world", 3), optionalText("baseUrl", "Base URL (optional)", ""), optionalText("setKey", "Set key (optional)", ""), optionalText("setValue", "Set value (optional)", ""), optionalText("removeKey", "Remove key (optional)", ""), select("sort", "Sort pairs", ["false", "true"], "false")] },
  "json-path-playground": { id: "json-path-playground", title: "JSON Path Playground", eyebrow: "Path matches", submitLabel: "Query JSON", placeholder: "Enter JSON and a bounded JSONPath expression.", fields: [area("json", "JSON", '{"users":[{"name":"Ada"},{"name":"Grace"}]}', 8), text("path", "JSONPath", "$.users[*].name")] },
};

function initialValues(config: DeveloperWebToolConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue]));
}

function resultText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function errorText(message: string): string {
  const known: Readonly<Record<string, string>> = {
    INVALID_JSON: "The JSON document is not valid under the RFC 8259 grammar.",
    INVALID_JSON_PATH: "The JSONPath expression is outside the supported bounded subset.",
    INVALID_CRON: "The cron expression is not a valid five-field POSIX schedule.",
    INVALID_BASE64: "The Base64 input is malformed. Remove whitespace or correct its padding.",
    INVALID_YAML: "The YAML document is outside the supported safe subset.",
    UNSUPPORTED_YAML: "This YAML feature is intentionally not executed by the local formatter.",
    INVALID_TOML: "The TOML document is outside the supported safe subset.",
    INVALID_JWT: "The JWT must be a three-part compact serialization with JSON header and payload.",
    INVALID_PERCENT_ENCODING: "The percent-encoded bytes are not valid UTF-8.",
    INVALID_UTF8_BASE64: "The decoded Base64 bytes are not valid UTF-8 text.",
  };
  const code = message.split(":", 1)[0] ?? message;
  return known[code] ?? message;
}

export interface DeveloperWebToolProps {
  readonly config: DeveloperWebToolConfig;
}

export function DeveloperWebTool({ config }: DeveloperWebToolProps) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config));
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(config.id, values, {}, signal),
    { formatError: (result) => errorText(result.message) },
  );
  const fieldIds = useMemo(() => Object.fromEntries(config.fields.map((field) => [field.key, `${config.id}-${field.key}`])), [config]);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setValues(initialValues(config));
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} aria-label={config.title}>
        {config.fields.map((field) => {
          const id = fieldIds[field.key];
          const value = values[field.key] ?? "";
          return (
            <label class="field" for={id} key={field.key}>
              <span>{field.label}</span>
              {field.kind === "textarea" && <textarea id={id} rows={field.rows ?? 8} value={value} placeholder={field.placeholder} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
              {field.kind === "text" && <input id={id} type="text" value={value} placeholder={field.placeholder} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
              {field.kind === "number" && <input id={id} type="number" value={value} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
              {field.kind === "select" && <select id={id} value={value} onChange={(event) => update(field.key, event.currentTarget.value)} required={field.required}>{field.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select>}
            </label>
          );
        })}
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Working…">{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.eyebrow} placeholder={config.placeholder} busy={operation.isRunning} atomic={false}>
        {operation.result !== null && <pre class="developer-result-json" tabIndex={0} aria-label={`${config.title} result`}>{resultText(operation.result)}</pre>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
