export interface ResultStyleGovernanceIssue {
  readonly file: string;
  readonly rule: "stylesheet" | "inline-style" | "color-literal" | "token-authority";
  readonly message: string;
}

export function auditResultV2Source(file: string, source: string): readonly ResultStyleGovernanceIssue[] {
  const issues: ResultStyleGovernanceIssue[] = [];
  const push = (rule: ResultStyleGovernanceIssue["rule"], message: string): void => {
    issues.push({ file, rule, message });
  };

  if (/import\s+["'][^"']+\.css["']/u.test(source) || /<style(?:\s|>)/u.test(source)) {
    push("stylesheet", "Result v2 primitives must consume the existing shared stylesheets.");
  }
  if (/\bstyle\s*=/u.test(source)) {
    push("inline-style", "Result v2 primitives must not create inline visual authority.");
  }
  if (/(?:#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/iu.test(source)) {
    push("color-literal", "Result v2 primitives must use canonical semantic classes/tokens instead of color literals.");
  }
  if (/--[a-z0-9-]+\s*:/iu.test(source)) {
    push("token-authority", "Result v2 primitives must not declare CSS custom properties.");
  }
  return issues;
}
