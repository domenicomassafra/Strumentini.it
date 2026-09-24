import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function currentRevision(root: string): Promise<string> {
  const result = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
  return result.stdout.trim();
}
