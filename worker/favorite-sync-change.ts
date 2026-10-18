/** Account-scoped conditional favorite mutation; the route authenticates and checks origin first. */
import { changeFavoriteIfCurrent, listFavoriteSync } from "./db";
import { MESSAGES, validateToolId } from "./validation";

interface ChangeResult {
  readonly status: number;
  readonly body: unknown;
}

const operationIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const reject = (status: number, message: string): ChangeResult => ({ status, body: { error: message } });

export async function applyFavoriteSyncChange(
  db: D1Database, userId: string, body: Record<string, unknown>, now: string,
): Promise<ChangeResult> {
  const toolId = validateToolId(body.toolId);
  if (!toolId.ok) return reject(400, toolId.message);
  if (typeof body.installed !== "boolean" || !Number.isSafeInteger(body.baseRevision) || (body.baseRevision as number) < 0) {
    return reject(400, MESSAGES.invalidBody);
  }
  // Prevent a changed login cookie from writing a different account's state.
  if (typeof body.expectedAccount !== "string" || body.expectedAccount !== userId) {
    return reject(409, "La sessione è cambiata: aggiorna i preferiti.");
  }
  if (typeof body.operationId !== "string" || !operationIdPattern.test(body.operationId)) {
    return reject(400, MESSAGES.invalidBody);
  }
  const appliedRevision = await changeFavoriteIfCurrent(
    db, userId, toolId.value, body.installed, body.baseRevision as number, body.operationId, now,
  );
  const snapshot = await listFavoriteSync(db, userId);
  return {
    status: appliedRevision === null ? 409 : 200,
    body: { version: 1, account: userId, ...snapshot, applied: appliedRevision !== null,
      ...(appliedRevision === null ? {} : { appliedRevision }) },
  };
}
