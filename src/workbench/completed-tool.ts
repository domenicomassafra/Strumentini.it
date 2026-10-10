/**
 * Record a real successful operation without eagerly loading IndexedDB code
 * into every tool. The only argument is the known catalogue tool ID.
 */
export function recordCompletedTool(toolId: string | undefined): void {
  if (toolId === undefined || toolId.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(toolId)) return;
  void import("./membership")
    .then(({ noteToolUse }) => noteToolUse(toolId))
    .catch(() => undefined);
}
