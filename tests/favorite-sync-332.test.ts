import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addFavorite, changeFavoriteIfCurrent } from "../worker/db";

interface TestEntry { toolId: string; installed: boolean; revision: number; operationId?: string }

function fakeSyncService() {
  let revision = 0;
  const entries = new Map<string, TestEntry>();
  const writes: { toolId: string; installed: boolean; baseRevision: number }[] = [];
  let offline = false;
  let invalid = false;
  let unauthenticated = false;
  let beforePost: (() => void) | undefined;
  let afterPost: (() => Promise<void>) | undefined;
  let dropPostAcknowledgement = false;
  let currentAccount = "account-1";

  const snapshot = () => ({
    version: 1, account: currentAccount, revision,
    entries: [...entries.values()].sort((a, b) => b.revision - a.revision),
    tools: [...entries.values()].filter((entry) => entry.installed).sort((a, b) => b.revision - a.revision).map((entry) => entry.toolId),
  });
  const serverWrite = (toolId: string, installed: boolean, baseRevision = Number.MAX_SAFE_INTEGER, operationId?: string) => {
    if ((entries.get(toolId)?.revision ?? 0) > baseRevision) return false;
    const entry = { toolId, installed, revision: ++revision, ...(operationId === undefined ? {} : { operationId }) };
    entries.set(toolId, entry);
    writes.push({ toolId, installed, baseRevision });
    return true;
  };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (offline) throw new TypeError("network offline");
    if (unauthenticated) return Response.json({ error: "Unauthenticated" }, { status: 401 });
    expect(String(input)).toBe("/api/favorites/sync");
    if (init?.method === "POST") {
      expect(init.credentials).toBe("same-origin");
      if (beforePost) { const hook = beforePost; beforePost = undefined; hook(); }
      const body = JSON.parse(String(init.body)) as { toolId: string; installed: boolean; baseRevision: number; operationId: string; expectedAccount: string };
      if (body.expectedAccount !== currentAccount) return Response.json({ error: "Session changed" }, { status: 409 });
      expect(body.operationId).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u);
      const changed = serverWrite(body.toolId, body.installed, body.baseRevision, body.operationId);
      const appliedRevision = changed ? entries.get(body.toolId)?.revision : undefined;
      const reply = { ...snapshot(), applied: changed, appliedRevision };
      if (afterPost) { const hook = afterPost; afterPost = undefined; await hook(); }
      if (dropPostAcknowledgement) { dropPostAcknowledgement = false; throw new TypeError("Acknowledgement lost after commit"); }
      return Response.json(reply, { status: changed ? 200 : 409 });
    }
    if (invalid) return Response.json({ tools: ["alpha"] }, { status: 200 });
    return Response.json(snapshot());
  });
  return {
    snapshot, serverWrite, fetchMock, writes,
    setOffline(value: boolean) { offline = value; },
    setInvalid(value: boolean) { invalid = value; },
    setUnauthenticated(value: boolean) { unauthenticated = value; },
    raceNextPost(hook: () => void) { beforePost = hook; },
    afterNextPost(hook: () => Promise<void>) { afterPost = hook; },
    loseNextPostAcknowledgement() { dropPostAcknowledgement = true; },
    switchAccount(id: string) { currentAccount = id; },
  };
}

async function isolatedDevice(values = new Map<string, unknown>()) {
  vi.resetModules();
  vi.doMock("../src/persistence/persistence", () => ({
    createIndexedDbPersistence: () => ({
      get: async (key: string) => structuredClone(values.get(key)),
      put: async (key: string, value: unknown) => { values.set(key, structuredClone(value)); },
      delete: async (key: string) => { values.delete(key); },
    }),
  }));
  return await import("../src/workbench/membership");
}

describe("#332 two independent devices and tombstones", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("CustomEvent", class<T> extends Event {
      detail: T;
      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    });
  });
  afterEach(() => {
    vi.doUnmock("../src/persistence/persistence");
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("converges two isolated IndexedDB histories and never resurrects a remote deletion", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    const b = await isolatedDevice();

    // Unknown local state cannot resurrect old (possibly pre-migration) deletions.
    expect((await a.syncMembershipWithAccount())?.installed).toEqual([]);
    expect((await b.syncMembershipWithAccount())?.installed).toEqual([]);
    await a.setInstalled("business-day", true);
    await a.pushMembershipChange("business-day", true, true);
    expect((await b.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    await a.setInstalled("rare-tool", true);
    await a.pushMembershipChange("rare-tool", true, true);
    await a.setInstalled("rare-tool", false);
    await a.pushMembershipChange("rare-tool", false, true);
    expect(service.snapshot().entries.find((row) => row.toolId === "rare-tool")?.installed).toBe(false);

    // B never saw rare-tool: its offline addition is older than A's tombstone.
    await b.setInstalled("rare-tool", true);
    const before = service.writes.length;
    expect((await b.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    expect(service.writes).toHaveLength(before);
    expect(service.snapshot().tools).not.toContain("rare-tool");

    // B may still add a different tool, while A's deletion of the default wins.
    await b.setInstalled("offline-tool", true);
    await a.setInstalled("business-day", false);
    await a.pushMembershipChange("business-day", false, true);
    expect((await b.syncMembershipWithAccount())?.installed).toEqual(["offline-tool"]);
    expect((await a.syncMembershipWithAccount())?.installed).toEqual(["offline-tool"]);
    expect(service.snapshot().tools).toEqual(["offline-tool"]);
  });

  it("handles a concurrent 409 by following the newer per-tool revision", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    const b = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.pushMembershipChange("business-day", true, true);
    await b.syncMembershipWithAccount();
    await b.setInstalled("business-day", false);
    service.raceNextPost(() => {
      service.serverWrite("business-day", false);
      service.serverWrite("business-day", true);
    });
    expect((await b.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    expect(service.snapshot().tools).toContain("business-day");
    expect((await a.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
  });

  it("does not drop a newer local re-add while its earlier removal is in flight", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", false);
    service.afterNextPost(async () => {
      // The removal has reached the server, but the client has not completed
      // its fetch/acknowledgement when the user clicks Add again.
      await a.setInstalled("business-day", true);
    });
    await a.syncMembershipWithAccount();
    await a.syncMembershipWithAccount();
    expect(service.snapshot().tools).toEqual(["business-day"]);
    expect((await a.loadMembership()).installed).toEqual(["business-day"]);
  });

  it("keeps a newer remote tombstone authoritative even after an acknowledged local write", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    const b = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", false);
    service.afterNextPost(async () => {
      await a.setInstalled("business-day", true);
      // B's newest removal follows A's earlier acknowledged write.
      service.serverWrite("business-day", true);
      service.serverWrite("business-day", false);
    });
    await a.syncMembershipWithAccount();
    const writes = service.writes.length;
    expect((await a.syncMembershipWithAccount())?.installed).toEqual([]);
    expect(service.writes).toHaveLength(writes);
    expect(service.snapshot().tools).toEqual([]);
  });

  it("retries its latest click after the first write succeeds but a later GET goes offline", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", false);
    service.afterNextPost(async () => {
      await a.setInstalled("business-day", true);
      service.setOffline(true);
    });
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    expect((await a.loadMembership()).installed).toEqual(["business-day"]);
    service.setOffline(false);
    expect((await a.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    expect(service.snapshot().tools).toEqual(["business-day"]);
  });

  it("recognizes an earlier committed removal after losing its HTTP acknowledgement, then applies the newer re-add", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const storage = new Map<string, unknown>();
    const a = await isolatedDevice(storage);
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", false);
    service.loseNextPostAcknowledgement();
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    expect(service.snapshot().tools).toEqual([]);
    // Reload completely resets module state; only durable IndexedDB survives.
    const reloaded = await isolatedDevice(storage);
    await reloaded.setInstalled("business-day", true);
    expect((await reloaded.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    expect(service.snapshot().tools).toEqual(["business-day"]);
    expect(service.writes).toHaveLength(3);
  });

  it("keeps a newer foreign tombstone after a lost removal acknowledgement and an offline re-add", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    const b = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", false);
    service.loseNextPostAcknowledgement();
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    await b.syncMembershipWithAccount();
    await b.setInstalled("business-day", true);
    await b.syncMembershipWithAccount();
    await b.setInstalled("business-day", false);
    await b.syncMembershipWithAccount();
    await a.setInstalled("business-day", true); // stale offline intent
    const writes = service.writes.length;
    expect((await a.syncMembershipWithAccount())?.installed).toEqual([]);
    expect(service.writes).toHaveLength(writes);
    expect(service.snapshot().tools).toEqual([]);
  });

  it("replaces the previous account's local favorites without uploading them to a new account", async () => {
    const firstAccount = fakeSyncService();
    vi.stubGlobal("fetch", firstAccount.fetchMock);
    const a = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.syncMembershipWithAccount();

    const secondAccount = fakeSyncService();
    secondAccount.switchAccount("account-2");
    vi.stubGlobal("fetch", secondAccount.fetchMock);
    expect((await a.syncMembershipWithAccount())?.installed).toEqual([]);
    expect(secondAccount.writes).toHaveLength(0);
    expect(secondAccount.snapshot().tools).toEqual([]);
    vi.stubGlobal("fetch", firstAccount.fetchMock);
    expect((await a.syncMembershipWithAccount())?.installed).toEqual(["business-day"]);
    expect(firstAccount.writes).toHaveLength(1);
  });

  it("refuses writes to a different account when a cookie changes between two pending POSTs", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await a.setInstalled("business-day", true);
    await a.setInstalled("offline-tool", true);
    service.afterNextPost(async () => { service.switchAccount("account-2"); });
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    expect(service.writes).toHaveLength(1);
    expect(service.fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    expect((await a.loadMembership()).installed).toEqual(["business-day", "offline-tool"]);
  });

  it("fails closed on unavailable session, malformed snapshots and network failures", async () => {
    const service = fakeSyncService();
    vi.stubGlobal("fetch", service.fetchMock);
    const a = await isolatedDevice();
    await a.syncMembershipWithAccount();
    await a.setInstalled("offline-tool", true);
    service.setOffline(true);
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    expect((await a.loadMembership()).installed).toContain("offline-tool");
    service.setOffline(false);
    service.setUnauthenticated(true);
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    service.setUnauthenticated(false);
    service.setInvalid(true);
    expect(await a.syncMembershipWithAccount()).toBeUndefined();
    expect(service.writes).toHaveLength(0);
    service.setInvalid(false);
    expect((await a.syncMembershipWithAccount())?.installed).toContain("offline-tool");
    expect(service.writes).toHaveLength(1);
    expect(service.fetchMock.mock.calls.every(([url]) => String(url) === "/api/favorites/sync")).toBe(true);
  });
});

describe("#332 SQLite D1 migration and atomic compare-and-swap", () => {
  it("applies after Google auth, mirrors legacy table and refuses stale writes across devices", async () => {
    const prepared: string[] = [];
    const fakeDb = {
      prepare(statement: string) {
        prepared.push(statement);
        return { bind: () => ({ first: async () => null, run: async () => ({ meta: { changes: 0 } }) }) };
      },
    } as unknown as D1Database;
    await changeFavoriteIfCurrent(fakeDb, "account-1", "tool", true, 0, "00000000-0000-4000-8000-000000000001", "now");
    await addFavorite(fakeDb, "account-1", "tool", "now");
    const root = fileURLToPath(new URL("../", import.meta.url));
    const python = String.raw`
import sqlite3, pathlib, sys, json, uuid
p = pathlib.Path(sys.argv[1]) / 'worker/migrations'
db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys = ON')
db.executescript((p/'0001_init.sql').read_text())
db.executescript((p/'0002_google_auth.sql').read_text())
db.execute('INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,password_login_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',('account-1','a@b.it','A','h','s',1,1,'now','now'))
db.execute('INSERT INTO favorites VALUES (?,?,?)',('account-1','preexisting','now'))
db.executescript((p/'0003_favorite_sync.sql').read_text())
db.executescript((p/'0004_favorite_operation_ids.sql').read_text())
assert db.execute('SELECT installed FROM favorite_sync_state WHERE tool_id=?',('preexisting',)).fetchone() == (1,)
# The previously deployed 0003 Worker can still INSERT without an operation ID.
db.execute('INSERT INTO favorite_sync_events(user_id,tool_id,installed,created_at) VALUES (?,?,?,?)',('account-1','legacy-client',1,'now'))
assert db.execute('SELECT installed,operation_id FROM favorite_sync_state WHERE tool_id=?',('legacy-client',)).fetchone() == (1,None)
payload = json.loads(sys.stdin.read())
sql, legacy, prune = payload['cas'], payload['legacy'], payload['prune']
db.execute(legacy,('account-1','old-deleted-tool','now'))
assert db.execute('SELECT 1 FROM favorite_sync_state WHERE tool_id=?',('old-deleted-tool',)).fetchone() is None, 'migration must protect unknown old deletions'
db.execute('INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,password_login_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',('new-account','new@b.it','N','h','s',1,1,'now','now'))
db.execute(legacy,('new-account','fresh-tool','now'))
assert db.execute('SELECT installed FROM favorite_sync_state WHERE user_id=?',('new-account',)).fetchone() == (1,), 'new users retain old PUT contract'
def write(name,enabled,base,operation_id=None):
    return db.execute(sql,('account-1',name,int(enabled),'now',base,operation_id or str(uuid.uuid4()))).fetchone() is not None
base = db.execute('SELECT MAX(revision) FROM favorite_sync_state').fetchone()[0]
assert write('alpha',True,base)
first_operation = db.execute('SELECT operation_id FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone()[0]
assert first_operation and not write('alpha',True,base,first_operation), 'replayed request must not create duplicate event'
assert not write('alpha',False,base), 'concurrent stale device must conflict'
latest = db.execute('SELECT revision FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone()[0]
assert write('alpha',False,latest)
assert db.execute('SELECT operation_id FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone()[0] is not None
assert not write('alpha',True,latest), 'stale offline add must not resurrect deleted item'
assert write('beta',True,base), 'unrelated tool allowed despite global revision advancing'
assert db.execute('SELECT installed FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone() == (0,)
assert db.execute('SELECT 1 FROM favorites WHERE tool_id=?',('alpha',)).fetchone() is None
assert db.execute('SELECT 1 FROM favorites WHERE tool_id=?',('beta',)).fetchone() is not None
for idx in range(300):
    latest = db.execute('SELECT revision FROM favorite_sync_state WHERE tool_id=?',('beta',)).fetchone()[0]
    assert write('beta',bool(idx%2),latest)
    db.execute(prune,('account-1',))
assert db.execute('SELECT COUNT(*) FROM favorite_sync_events WHERE user_id=?',('account-1',)).fetchone()[0] <= 128
assert db.execute('SELECT installed FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone() == (0,), 'tombstone retained after history pruning'
assert db.execute('SELECT operation_id FROM favorite_sync_state WHERE tool_id=?',('alpha',)).fetchone()[0], 'operation identity survives pruning'
latest = db.execute('SELECT MAX(revision) FROM favorite_sync_state WHERE user_id=?',('account-1',)).fetchone()[0]
assert latest > 300
print('SQLITE_MIGRATION_AND_CAS_PASS')
`;
    const proc = spawnSync("python3", ["-c", python, root], { input: JSON.stringify({ cas: prepared[0], legacy: prepared[1], prune: prepared[2] }), encoding: "utf8", timeout: 10_000 });
    expect(proc.status, `${proc.stdout}\n${proc.stderr}`).toBe(0);
    expect(proc.stdout).toContain("SQLITE_MIGRATION_AND_CAS_PASS");
  });
});
