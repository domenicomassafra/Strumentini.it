import type { ToolModule } from "../../runtime/types";
import {
  DEVELOPER_WEB_ENGINE_VERSION,
  DeveloperWebError,
  asObject,
  booleanField,
  invalid,
  optionalNumberField,
  optionalStringField,
  stringField,
} from "./types";
import {
  jsonFormatterOperation,
  jsonPathOperation,
  jsonValidatorOperation,
  jsonYamlConverterOperation,
  tomlFormatterOperation,
  yamlFormatterOperation,
} from "./structured-data";
import {
  base64Operation,
  generateUuids,
  hashGeneratorOperation,
  hmacOperation,
  htmlEntityOperation,
  inspectJwt,
  regexTestOperation,
  urlCodecOperation,
} from "./encoding-crypto";
import {
  cronNextRunOperation,
  explainCronOperation,
  httpStatusOperation,
  mimeTypeOperation,
  queryStringOperation,
  unixTimestampOperation,
  userAgentOperation,
} from "./web-reference";

export * from "./types";
export * from "./structured-data";
export * from "./encoding-crypto";
export * from "./web-reference";

export type DeveloperWebToolId =
  | "json-formatter"
  | "yaml-formatter"
  | "toml-formatter"
  | "json-yaml-converter"
  | "url-codec"
  | "html-entity-codec"
  | "base64-codec"
  | "jwt-inspector"
  | "uuid-generator"
  | "hash-generator"
  | "hmac-generator"
  | "regex-tester"
  | "cron-explainer"
  | "cron-next-run"
  | "unix-timestamp"
  | "http-status-reference"
  | "mime-type-lookup"
  | "user-agent-parser"
  | "query-string-editor"
  | "json-path-playground";

function requireDirection(value: Record<string, unknown>): string {
  const direction = optionalStringField(value, "direction", "operation", "mode");
  return direction ?? "json-to-yaml";
}

function optionalCount(value: Record<string, unknown>, fallback: number): number {
  const count = optionalNumberField(value, "count", "runs", "numberOfResults");
  return count ?? fallback;
}

function runById(toolId: DeveloperWebToolId, value: Record<string, unknown>, signal?: AbortSignal): unknown {
  if (toolId === "json-formatter") {
    const text = stringField(value, "text", "input", "json");
    const indent = optionalNumberField(value, "indent", "spaces") ?? 2;
    const sortKeys = booleanField(value, false, "sortKeys", "sort");
    if (optionalStringField(value, "mode", "operation", "validateOnly", "action") === "validate") return jsonValidatorOperation(text);
    return jsonFormatterOperation(text, indent, sortKeys);
  }
  if (toolId === "yaml-formatter") return yamlFormatterOperation(stringField(value, "text", "input", "yaml"), optionalNumberField(value, "indent", "spaces") ?? 2);
  if (toolId === "toml-formatter") return tomlFormatterOperation(stringField(value, "text", "input", "toml"));
  if (toolId === "json-yaml-converter") return jsonYamlConverterOperation(stringField(value, "text", "input", "source"), requireDirection(value), optionalNumberField(value, "indent", "spaces") ?? 2);
  if (toolId === "url-codec") return urlCodecOperation(stringField(value, "text", "input", "value"), optionalStringField(value, "mode", "operation") ?? "encode", optionalStringField(value, "set", "encodingSet") ?? "component");
  if (toolId === "html-entity-codec") return htmlEntityOperation(stringField(value, "text", "input", "value"), optionalStringField(value, "mode", "operation") ?? "encode", booleanField(value, false, "numeric"));
  if (toolId === "base64-codec") {
    const urlSafeValue = optionalStringField(value, "urlSafe", "base64url");
    const urlSafe = urlSafeValue === "url-safe" || urlSafeValue === "base64url" || urlSafeValue === "true";
    return base64Operation(stringField(value, "text", "input", "value"), optionalStringField(value, "mode", "operation") ?? "encode", urlSafe);
  }
  if (toolId === "jwt-inspector") return inspectJwt(stringField(value, "token", "input", "text"));
  if (toolId === "uuid-generator") {
    const bytes = value.bytes;
    let parsedBytes: number[] | undefined;
    if (Array.isArray(bytes)) {
      if (bytes.some((entry) => typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > 255)) invalid("INVALID_UUID_BYTES", "UUID bytes must be integer values from 0 through 255.");
      parsedBytes = bytes as number[];
    }
    return generateUuids({
      count: optionalNumberField(value, "count", "numberOfUuids") ?? 1,
      version: optionalNumberField(value, "version") ?? 4,
      uppercase: booleanField(value, false, "uppercase"),
      ...(optionalStringField(value, "seed") === undefined ? {} : { seed: optionalStringField(value, "seed")! }),
      ...(parsedBytes === undefined ? {} : { bytes: parsedBytes }),
    });
  }
  if (toolId === "hash-generator") return hashGeneratorOperation(stringField(value, "text", "input", "message"), optionalStringField(value, "algorithm", "hashAlgorithm"), signal);
  if (toolId === "hmac-generator") return hmacOperation(stringField(value, "message", "text", "input"), stringField(value, "key", "secret"), optionalStringField(value, "algorithm", "hashAlgorithm"), signal);
  if (toolId === "regex-tester") return regexTestOperation(stringField(value, "pattern", "expression"), optionalStringField(value, "flags") ?? "", stringField(value, "text", "input", "subject"), optionalStringField(value, "replacement"));
  if (toolId === "cron-explainer") return explainCronOperation(stringField(value, "expression", "cron", "text", "input"));
  if (toolId === "cron-next-run") {
    const from = optionalStringField(value, "from", "fromDate");
    return cronNextRunOperation(stringField(value, "expression", "cron", "text", "input"), from === undefined || from.trim() === "" ? new Date().toISOString() : from, optionalCount(value, 5));
  }
  if (toolId === "unix-timestamp") return unixTimestampOperation(value.timestamp ?? value.value ?? value.input, optionalStringField(value, "unit") ?? "seconds", optionalStringField(value, "direction", "operation") ?? "to-date");
  if (toolId === "http-status-reference") return httpStatusOperation(value.status ?? value.input ?? value.value);
  if (toolId === "mime-type-lookup") {
    const signature = optionalStringField(value, "bytes", "hex", "signature");
    return mimeTypeOperation(stringField(value, "lookup", "extension", "filename", "input", "hex"), optionalStringField(value, "mode", "operation") ?? "extension", signature === undefined || signature.trim() === "" ? undefined : signature);
  }
  if (toolId === "user-agent-parser") return userAgentOperation(stringField(value, "userAgent", "ua", "input", "text"));
  if (toolId === "query-string-editor") return queryStringOperation(value);
  if (toolId === "json-path-playground") return jsonPathOperation(stringField(value, "json", "text", "input", "document"), stringField(value, "path", "query", "jsonPath"));
  return invalid("UNKNOWN_TOOL", `Unknown developer/web tool: ${String(toolId)}.`);
}

export async function runDeveloperWebTool(toolId: DeveloperWebToolId, rawInput: unknown, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const value = asObject(rawInput);
  const result = runById(toolId, value, signal);
  const finish = (output: unknown): unknown => {
    if (typeof output === "object" && output !== null && !Array.isArray(output) && !Object.hasOwn(output, "engineVersion")) {
      return { ...(output as Record<string, unknown>), engineVersion: DEVELOPER_WEB_ENGINE_VERSION };
    }
    return output;
  };
  if (result instanceof Promise) return result.then(finish);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return finish(result);
}

export function createDeveloperWebModule(toolId: DeveloperWebToolId): ToolModule {
  return {
    run(input, _context, signal) {
      return runDeveloperWebTool(toolId, input, signal);
    },
  };
}

export function developerWebErrorMessage(error: unknown): string {
  if (error instanceof DeveloperWebError) return error.message;
  return error instanceof Error ? error.message : "Developer/web operation failed.";
}

export const developerWebEngineVersion = DEVELOPER_WEB_ENGINE_VERSION;
