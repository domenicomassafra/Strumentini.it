/**
 * D1 access layer.
 *
 * Every function takes the `D1Database` binding as its first argument, so the
 * layer has no worker-scoped state and can be exercised against any D1
 * instance. Rows are returned as plain objects; no SQL leaks into the routes.
 */

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly password_hash: string;
  readonly password_salt: string;
  readonly password_iterations: number;
  readonly password_login_enabled: number;
  readonly google_sub: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SessionRow {
  readonly id: string;
  readonly token_hash: string;
  readonly user_id: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly last_seen_at: string;
  readonly user_agent: string;
}

export interface SessionWithUser {
  readonly session: SessionRow;
  readonly user: UserRow;
}

export interface NewUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly passwordSalt: string;
  readonly passwordIterations: number;
  readonly passwordLoginEnabled?: boolean;
  readonly googleSub?: string | null;
  readonly createdAt: string;
}

export interface NewSession {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly userAgent: string;
}

const USER_COLUMNS = "id, email, name, password_hash, password_salt, password_iterations, password_login_enabled, google_sub, created_at, updated_at";
const SESSION_COLUMNS = "id, token_hash, user_id, created_at, expires_at, last_seen_at, user_agent";

interface SessionUserRow {
  readonly session_id: string;
  readonly token_hash: string;
  readonly session_user_id: string;
  readonly session_created_at: string;
  readonly expires_at: string;
  readonly last_seen_at: string;
  readonly user_agent: string;
  readonly user_id: string;
  readonly email: string;
  readonly name: string;
  readonly password_hash: string;
  readonly password_salt: string;
  readonly password_iterations: number;
  readonly password_login_enabled: number;
  readonly google_sub: string | null;
  readonly user_created_at: string;
  readonly updated_at: string;
}

/**
 * Inserts a user, returning `null` when the email is already registered.
 * The insert itself is the uniqueness check, so concurrent registrations
 * cannot both win.
 */
export async function createUser(db: D1Database, user: NewUser): Promise<UserRow | null> {
  const result = await db
    .prepare(
      `INSERT INTO users (
         id, email, name, password_hash, password_salt, password_iterations,
         password_login_enabled, google_sub, created_at, updated_at
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
       ON CONFLICT(email) DO NOTHING`,
    )
    .bind(
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.passwordSalt,
      user.passwordIterations,
      user.passwordLoginEnabled === false ? 0 : 1,
      user.googleSub ?? null,
      user.createdAt,
    )
    .run();
  if (result.meta.changes === 0) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    password_iterations: user.passwordIterations,
    password_login_enabled: user.passwordLoginEnabled === false ? 0 : 1,
    google_sub: user.googleSub ?? null,
    created_at: user.createdAt,
    updated_at: user.createdAt,
  };
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?1 LIMIT 1`).bind(email).first<UserRow>();
}

export async function findUserByGoogleSubject(db: D1Database, subject: string): Promise<UserRow | null> {
  return await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?1 LIMIT 1`).bind(subject).first<UserRow>();
}

export async function linkGoogleSubject(
  db: D1Database,
  userId: string,
  subject: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare("UPDATE users SET google_sub = ?1, updated_at = ?2 WHERE id = ?3")
    .bind(subject, updatedAt, userId)
    .run();
}

export async function createSession(db: D1Database, session: NewSession): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?4, ?6)`,
    )
    .bind(session.id, session.tokenHash, session.userId, session.createdAt, session.expiresAt, session.userAgent)
    .run();
}

/**
 * Atomic login barrier: issuing a session and checking the password credential
 * occur in the same SQLite statement. A password change cannot finish between
 * a stale KDF verification and a subsequently issued new login session.
 */
export async function createSessionForPasswordCredential(
  db: D1Database,
  session: NewSession,
  expected: { readonly hash: string; readonly salt: string; readonly iterations: number },
): Promise<boolean> {
  const result = await db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at, user_agent)
     SELECT ?1, ?2, u.id, ?3, ?4, ?3, ?5 FROM users u
     WHERE u.id = ?6 AND u.password_hash = ?7 AND u.password_salt = ?8
       AND u.password_iterations = ?9 AND u.password_login_enabled = 1`,
  ).bind(
    session.id, session.tokenHash, session.createdAt, session.expiresAt,
    session.userAgent, session.userId, expected.hash, expected.salt, expected.iterations,
  ).run();
  return result.meta.changes === 1;
}

/** Resolves a session (and its owner) by the SHA-256 hash of the raw token. */
export async function findSessionByToken(db: D1Database, tokenHash: string): Promise<SessionWithUser | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.token_hash, s.user_id AS session_user_id,
              s.created_at AS session_created_at, s.expires_at, s.last_seen_at, s.user_agent,
              u.id AS user_id, u.email, u.name, u.password_hash, u.password_salt, u.password_iterations,
              u.password_login_enabled, u.google_sub,
              u.created_at AS user_created_at, u.updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<SessionUserRow>();
  if (row === null) return null;
  return {
    session: {
      id: row.session_id,
      token_hash: row.token_hash,
      user_id: row.session_user_id,
      created_at: row.session_created_at,
      expires_at: row.expires_at,
      last_seen_at: row.last_seen_at,
      user_agent: row.user_agent,
    },
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      password_hash: row.password_hash,
      password_salt: row.password_salt,
      password_iterations: row.password_iterations,
      password_login_enabled: row.password_login_enabled,
      google_sub: row.google_sub,
      created_at: row.user_created_at,
      updated_at: row.updated_at,
    },
  };
}

export async function touchSession(db: D1Database, sessionId: string, lastSeenAt: string): Promise<void> {
  await db.prepare("UPDATE sessions SET last_seen_at = ?1 WHERE id = ?2").bind(lastSeenAt, sessionId).run();
}

/** Deletes a session, but only when it belongs to `userId`. */
export async function deleteSession(db: D1Database, sessionId: string, userId: string): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM sessions WHERE id = ?1 AND user_id = ?2")
    .bind(sessionId, userId)
    .run();
  return result.meta.changes > 0;
}

/** Deletes every session of a user, optionally sparing the caller's own. */
export async function deleteAllSessionsForUser(db: D1Database, userId: string, exceptSessionId?: string): Promise<number> {
  const result = exceptSessionId === undefined
    ? await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId).run()
    : await db.prepare("DELETE FROM sessions WHERE user_id = ?1 AND id <> ?2").bind(userId, exceptSessionId).run();
  return result.meta.changes;
}

export async function listSessions(db: D1Database, userId: string): Promise<readonly SessionRow[]> {
  const result = await db
    .prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE user_id = ?1 ORDER BY created_at DESC, id ASC`)
    .bind(userId)
    .all<SessionRow>();
  return result.results;
}

export async function updateUserName(db: D1Database, userId: string, name: string, updatedAt: string): Promise<void> {
  await db.prepare("UPDATE users SET name = ?1, updated_at = ?2 WHERE id = ?3").bind(name, updatedAt, userId).run();
}

export interface PasswordUpdate {
  readonly hash: string;
  readonly salt: string;
  readonly iterations: number;
}

/** Compare-and-swap password mutation. Stale rehash/change cannot overwrite
 * credentials written by another login, password change or reset in flight. */
export async function updateUserPasswordIfUnchanged(
  db: D1Database,
  userId: string,
  password: PasswordUpdate,
  expected: { readonly hash: string; readonly salt: string; readonly iterations: number; readonly loginEnabled: number },
  updatedAt: string,
  currentSessionId: string | null = null,
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3,
      password_login_enabled = 1, updated_at = ?4
     WHERE id = ?5 AND password_hash = ?6 AND password_salt = ?7
       AND password_iterations = ?8 AND password_login_enabled = ?9
       AND (?10 IS NULL OR EXISTS (SELECT 1 FROM sessions s
          WHERE s.id = ?10 AND s.user_id = users.id AND s.expires_at > ?4))`,
  ).bind(password.hash, password.salt, password.iterations, updatedAt, userId,
    expected.hash, expected.salt, expected.iterations, expected.loginEnabled, currentSessionId).run();
  return result.meta.changes === 1;
}

/** Account deletion is authorized against the same live session and credential
 * originally checked, so a revoked session/stale async KDF cannot delete it. */
export async function deleteUserIfSessionCredentialUnchanged(
  db: D1Database,
  userId: string,
  sessionId: string,
  expected: { readonly hash: string; readonly salt: string; readonly iterations: number; readonly loginEnabled: number },
  at: string,
): Promise<boolean> {
  const result = await db.prepare(
    `DELETE FROM users WHERE id = ?1 AND password_hash = ?2 AND password_salt = ?3
     AND password_iterations = ?4 AND password_login_enabled = ?5
     AND EXISTS (SELECT 1 FROM sessions s WHERE s.id = ?6
       AND s.user_id = users.id AND s.expires_at > ?7)
     RETURNING id`,
  ).bind(userId, expected.hash, expected.salt, expected.iterations,
    expected.loginEnabled, sessionId, at).first<{ id: string }>();
  // D1 meta.changes includes cascaded rows; RETURNING names only the deleted user.
  return result?.id === userId;
}

/** Deletes the user and every session they own. */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId),
    db.prepare("DELETE FROM users WHERE id = ?1").bind(userId),
  ]);
}

export interface LoginAttemptWindow {
  readonly count: number;
  /** ISO timestamp of the oldest attempt still inside the window, if any. */
  readonly oldest: string | null;
}

/** Counts recent failed attempts for a scope (one IP) inside the window. */
export async function countLoginAttempts(db: D1Database, scope: string, since: string): Promise<LoginAttemptWindow> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count, MIN(attempted_at) AS oldest FROM login_attempts WHERE scope = ?1 AND attempted_at >= ?2")
    .bind(scope, since)
    .first<{ readonly count: number; readonly oldest: string | null }>();
  return { count: row?.count ?? 0, oldest: row?.oldest ?? null };
}

/** Atomic one-minute compute reservation. Unlike edge-colo rate limits, the
 * INSERT predicate is serialized by D1 and includes concurrent in-flight KDF
 * jobs. Reservations count even on KDF outage to protect the Free CPU quota.
 * This scope uses a prefix distinct from legacy failed-login counters.
 */
export async function reserveKdfAttempt(db: D1Database, ip: string, at: string, since: string): Promise<boolean> {
  const row = await db.prepare(
    `INSERT INTO login_attempts (scope, attempted_at)
     SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM login_attempts
       WHERE scope = ?1 AND attempted_at >= ?3) < 8 RETURNING id`,
  ).bind(`kdf-ip:${ip}`, at, since).first<{ readonly id: number }>();
  // Successes and backend outages also reserve slots, so relying on failed
  // login cleanup would retain them indefinitely. Prune globally every 16th
  // reservation; the scope prefix keeps unrelated failure evidence intact.
  if (row !== null && row.id % 16 === 0) {
    await db.prepare("DELETE FROM login_attempts WHERE scope GLOB 'kdf-ip:*' AND attempted_at < ?1")
      .bind(since).run();
  }
  return row !== null;
}

/**
 * Records a failed attempt and, in the same round trip, drops everything that
 * has fallen out of the window so the table cannot grow without bound.
 */
export async function recordLoginAttempt(
  db: D1Database,
  scope: string,
  attemptedAt: string,
  pruneBefore: string,
): Promise<void> {
  await db.batch([
    db.prepare("INSERT INTO login_attempts (scope, attempted_at) VALUES (?1, ?2)").bind(scope, attemptedAt),
    db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?1").bind(pruneBefore),
  ]);
}

export interface FavoriteSyncEntry {
  readonly toolId: string;
  readonly installed: boolean;
  readonly revision: number;
  readonly operationId?: string;
}

export interface FavoriteSyncSnapshot {
  readonly revision: number;
  readonly entries: readonly FavoriteSyncEntry[];
  readonly tools: readonly string[];
}

interface FavoriteSyncRow {
  readonly tool_id: string;
  readonly installed: number;
  readonly revision: number;
  readonly operation_id: string | null;
}

/** The durable state table carries every tombstone/revision. Keep only the
 * last 128 audit events per user; AUTOINCREMENT never reuses deleted IDs.
 * Pages released by SQLite may be reused by later operations.
 */
async function pruneFavoriteEvents(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`
    DELETE FROM favorite_sync_events
    WHERE user_id = ?1 AND id < COALESCE((
      SELECT id FROM favorite_sync_events
      WHERE user_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET 127
    ), 0)
  `).bind(userId).run();
}

/** Includes tombstones; the client must see deletions as well as additions. */
export async function listFavoriteSync(db: D1Database, userId: string): Promise<FavoriteSyncSnapshot> {
  const result = await db.prepare(
    "SELECT tool_id, installed, revision, operation_id FROM favorite_sync_state WHERE user_id = ?1 ORDER BY revision DESC LIMIT 2001",
  ).bind(userId).all<FavoriteSyncRow>();
  if (result.results.length > 2000) throw new Error("FAVORITE_SYNC_CAP_EXCEEDED");
  if (result.results.some((row) => !Number.isSafeInteger(row.revision) || row.revision < 1 || (row.installed !== 0 && row.installed !== 1))) {
    throw new Error("FAVORITE_SYNC_CORRUPT");
  }
  return {
    revision: result.results[0]?.revision ?? 0,
    entries: result.results.map((row) => ({ toolId: row.tool_id, installed: row.installed === 1, revision: row.revision,
      ...(row.operation_id === null ? {} : { operationId: row.operation_id }) })),
    tools: result.results.filter((row) => row.installed === 1).map((row) => row.tool_id),
  };
}

/** SQLite conditional INSERT and AFTER INSERT trigger are one atomic mutation.
 * Another device's newer write to the same tool makes this INSERT a no-op.
 */
export async function changeFavoriteIfCurrent(
  db: D1Database,
  userId: string,
  toolId: string,
  installed: boolean,
  baseRevision: number,
  operationId: string,
  at: string,
): Promise<number | null> {
  const row = await db.prepare(`
    INSERT INTO favorite_sync_events (user_id, tool_id, installed, created_at, operation_id)
    SELECT ?1, ?2, ?3, ?4, ?6
    WHERE COALESCE((SELECT revision FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2), 0) <= ?5
      AND NOT EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2 AND operation_id = ?6)
      AND ((SELECT COUNT(*) FROM favorite_sync_state WHERE user_id = ?1) < 2000
           OR EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2))
      AND (?3 = 0 OR (SELECT COUNT(*) FROM favorite_sync_state WHERE user_id = ?1 AND installed = 1) < 500
           OR EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2 AND installed = 1))
    RETURNING id
  `).bind(userId, toolId, installed ? 1 : 0, at, baseRevision, operationId).first<{ id: number }>();
  if (row !== null) await pruneFavoriteEvents(db, userId);
  return row?.id ?? null;
}

/** Legacy PUT: pre-migration accounts may have unrecorded deletions. Permit
 * unknown IDs only for accounts created after the migration (no old history).
 */
export async function addFavorite(db: D1Database, userId: string, toolId: string, createdAt: string): Promise<boolean> {
  await db.prepare(`
    INSERT INTO favorite_sync_events (user_id, tool_id, installed, created_at)
    SELECT ?1, ?2, 1, ?3
    WHERE NOT EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2)
      AND NOT EXISTS (SELECT 1 FROM favorite_sync_migrated_accounts WHERE user_id = ?1)
  `).bind(userId, toolId, createdAt).run();
  await pruneFavoriteEvents(db, userId);
  const row = await db.prepare("SELECT installed FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2")
    .bind(userId, toolId).first<{ installed: number }>();
  return row?.installed === 1;
}

/** Legacy DELETE is idempotent; a missing favourite becomes a tombstone. */
export async function removeFavorite(db: D1Database, userId: string, toolId: string, at = new Date().toISOString()): Promise<void> {
  await db.prepare(`
    INSERT INTO favorite_sync_events (user_id, tool_id, installed, created_at)
    SELECT ?1, ?2, 0, ?3
    WHERE NOT EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2 AND installed = 0)
  `).bind(userId, toolId, at).run();
  await pruneFavoriteEvents(db, userId);
}

/** Every present favourite gets a durable tombstone, including bulk clear. */
export async function clearFavorites(db: D1Database, userId: string, at = new Date().toISOString()): Promise<void> {
  const current = await listFavoriteSync(db, userId);
  if (current.tools.length === 0) return;
  await db.batch([...current.tools.map((toolId) => db.prepare(`
    INSERT INTO favorite_sync_events (user_id, tool_id, installed, created_at)
    SELECT ?1, ?2, 0, ?3
    WHERE EXISTS (SELECT 1 FROM favorite_sync_state WHERE user_id = ?1 AND tool_id = ?2 AND installed = 1)
  `).bind(userId, toolId, at)), db.prepare(`
    DELETE FROM favorite_sync_events
    WHERE user_id = ?1 AND id < COALESCE((
      SELECT id FROM favorite_sync_events WHERE user_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET 127
    ), 0)
  `).bind(userId)]);
}

/** Legacy shape remains available for consumers of GET /api/favorites. */
export async function listFavorites(db: D1Database, userId: string): Promise<readonly string[]> {
  return (await listFavoriteSync(db, userId)).tools;
}
