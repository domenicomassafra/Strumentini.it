export const JOB_ROUTE_DIFFERENCE_KINDS = ["job", "default", "result"] as const;

export type JobRouteDifferenceKind = (typeof JOB_ROUTE_DIFFERENCE_KINDS)[number];

export interface JobRouteDifference {
  readonly kind: JobRouteDifferenceKind;
  readonly description: string;
}

export interface JobIdentityCandidate {
  readonly id: string;
  readonly route: string;
  readonly engine: string;
  readonly intent: string;
  readonly jobs: readonly string[];
  readonly aliases: readonly string[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly routeDifferences?: readonly JobRouteDifference[];
}

export interface JobIdentityIssue {
  readonly leftId: string;
  readonly rightId: string;
  readonly reason: string;
}

export interface JobIdentityReport {
  readonly ok: boolean;
  readonly issues: readonly JobIdentityIssue[];
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("it-IT")
    .replace(/\s+/gu, " ");
}

function normalizedSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalize).filter(Boolean));
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = normalizedSet(left);
  const rightSet = normalizedSet(right);
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) if (!rightSet.has(value)) return false;
  return true;
}

function intersection(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = normalizedSet(right);
  return [...normalizedSet(left)].filter((value) => rightSet.has(value)).toSorted();
}

function documentedDifference(candidate: JobIdentityCandidate): readonly JobRouteDifference[] {
  return (candidate.routeDifferences ?? []).filter((difference) => difference.description.trim().length > 0);
}

function pairIssues(left: JobIdentityCandidate, right: JobIdentityCandidate): JobIdentityIssue[] {
  const issues: JobIdentityIssue[] = [];
  const sameIntent = normalize(left.intent) === normalize(right.intent);
  const sharedJobs = intersection(left.jobs, right.jobs);
  const sharedAliases = intersection(left.aliases, right.aliases);
  const sameInputs = sameSet(left.inputs, right.inputs);
  const sameOutputs = sameSet(left.outputs, right.outputs);
  const leftDifferences = documentedDifference(left);
  const rightDifferences = documentedDifference(right);
  const hasMaterialDifference = leftDifferences.length > 0 || rightDifferences.length > 0;

  if (sharedJobs.length > 0 && sameInputs && sameOutputs && !hasMaterialDifference) {
    issues.push({
      leftId: left.id,
      rightId: right.id,
      reason: `shared job ${JSON.stringify(sharedJobs[0])} has the same input/output contract without a documented job/default/result difference`,
    });
  }

  if (sameIntent && sameInputs && sameOutputs && !hasMaterialDifference) {
    issues.push({
      leftId: left.id,
      rightId: right.id,
      reason: "equivalent intent has the same input/output contract without a documented job/default/result difference",
    });
  }

  if (sharedAliases.length > 0 && sameInputs && sameOutputs && !hasMaterialDifference) {
    issues.push({
      leftId: left.id,
      rightId: right.id,
      reason: `alias-only route split detected for ${JSON.stringify(sharedAliases[0])}`,
    });
  }

  if (left.engine === right.engine && sameIntent && hasMaterialDifference) {
    const kinds = new Set<JobRouteDifferenceKind>([
      ...leftDifferences.map((difference) => difference.kind),
      ...rightDifferences.map((difference) => difference.kind),
    ]);
    if (kinds.size === 0) {
      issues.push({
        leftId: left.id,
        rightId: right.id,
        reason: "same-engine routes must document a material job, default or result difference",
      });
    }
  }

  return issues;
}

export function evaluateJobIdentityPolicy(candidates: readonly JobIdentityCandidate[]): JobIdentityReport {
  const issues: JobIdentityIssue[] = [];
  const ids = new Set<string>();
  const routes = new Set<string>();

  for (const candidate of candidates) {
    if (ids.has(candidate.id)) {
      issues.push({ leftId: candidate.id, rightId: candidate.id, reason: "duplicate job identity id" });
    }
    if (routes.has(candidate.route)) {
      issues.push({ leftId: candidate.id, rightId: candidate.id, reason: "duplicate published route" });
    }
    ids.add(candidate.id);
    routes.add(candidate.route);
  }

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const left = candidates[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const right = candidates[rightIndex];
      if (right === undefined) continue;
      issues.push(...pairIssues(left, right));
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertCanonicalJobIdentities(candidates: readonly JobIdentityCandidate[]): void {
  const report = evaluateJobIdentityPolicy(candidates);
  if (!report.ok) throw new Error(report.issues.map((issue) => `${issue.leftId} <> ${issue.rightId}: ${issue.reason}`).join("\n"));
}
