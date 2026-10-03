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

const USER_COLUMNS = "id, email, name, password_hash, password_salt, password_iterations, created_at, updated_at";
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
      `INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT(email) DO NOTHING`,
    )
    .bind(
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.passwordSalt,
      user.passwordIterations,
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
    created_at: user.createdAt,
    updated_at: user.createdAt,
  };
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?1 LIMIT 1`).bind(email).first<UserRow>();
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

/** Resolves a session (and its owner) by the SHA-256 hash of the raw token. */
export async function findSessionByToken(db: D1Database, tokenHash: string): Promise<SessionWithUser | null> {
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.token_hash, s.user_id AS session_user_id,
              s.created_at AS session_created_at, s.expires_at, s.last_seen_at, s.user_agent,
              u.id AS user_id, u.email, u.name, u.password_hash, u.password_salt, u.password_iterations,
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

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  password: PasswordUpdate,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, updated_at = ?4 WHERE id = ?5",
    )
    .bind(password.hash, password.salt, password.iterations, updatedAt, userId)
    .run();
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

/** The caller's favourite tool ids, newest first. */
export async function listFavorites(db: D1Database, userId: string): Promise<readonly string[]> {
  const result = await db
    .prepare("SELECT tool_id FROM favorites WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC")
    .bind(userId)
    .all<{ readonly tool_id: string }>();
  return result.results.map((row) => row.tool_id);
}

/** Idempotent: re-adding an existing favourite keeps the original `created_at`. */
export async function addFavorite(db: D1Database, userId: string, toolId: string, createdAt: string): Promise<void> {
  await db
    .prepare("INSERT INTO favorites (user_id, tool_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, tool_id) DO NOTHING")
    .bind(userId, toolId, createdAt)
    .run();
}

/** Idempotent: removing a favourite that is not there is not an error. */
export async function removeFavorite(db: D1Database, userId: string, toolId: string): Promise<void> {
  await db.prepare("DELETE FROM favorites WHERE user_id = ?1 AND tool_id = ?2").bind(userId, toolId).run();
}

export async function clearFavorites(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM favorites WHERE user_id = ?1").bind(userId).run();
}
