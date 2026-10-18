import { describe, expect, it } from "vitest";
import { applyFavoriteSyncChange } from "../worker/favorite-sync-change";

const operationId = "00000000-0000-4000-8000-000000000001";
const request = { toolId: "business-day", installed: true, baseRevision: 0,
  expectedAccount: "account-a", operationId };

describe("#332 guarded HTTP favorite sync mutation", () => {
  it("refuses a session swap or invalid payload before any database action", async () => {
    let databaseCalls = 0;
    const db = { prepare() { databaseCalls++; throw new Error("unexpected database access"); } } as unknown as D1Database;
    expect((await applyFavoriteSyncChange(db, "account-b", request, "now")).status).toBe(409);
    expect((await applyFavoriteSyncChange(db, "account-a", { ...request, operationId: "forged" }, "now")).status).toBe(400);
    expect((await applyFavoriteSyncChange(db, "account-a", { ...request, baseRevision: -1 }, "now")).status).toBe(400);
    expect(databaseCalls).toBe(0);
  });

  it("preserves the CAS revision and account in a successful response", async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind(...bound: unknown[]) {
            if (sql.includes("INSERT INTO favorite_sync_events")) {
              expect(bound.slice(0, 6)).toEqual(["account-a", "business-day", 1, "now", 0, operationId]);
              return { first: async () => ({ id: 7 }) };
            }
            if (sql.includes("SELECT tool_id, installed, revision, operation_id")) {
              return { all: async () => ({ results: [{ tool_id: "business-day", installed: 1, revision: 7, operation_id: operationId }] }) };
            }
            return { run: async () => ({ meta: { changes: 0 } }) }; // event pruning
          },
        };
      },
    } as unknown as D1Database;
    const result = await applyFavoriteSyncChange(db, "account-a", request, "now");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ account: "account-a", applied: true, appliedRevision: 7,
      tools: ["business-day"], entries: [{ toolId: "business-day", installed: true, revision: 7, operationId }] });
  });
});
