/**
 * The account API, in one place.
 *
 * Both account pages go through here, so a status code, an Italian error body,
 * and an unreachable endpoint (no worker deployed) are handled exactly once and
 * never guessed twice. The shapes below are the contract implemented in
 * `worker/index.ts`; this module never invents a field the API does not return.
 *
 * Failures that reach the server always carry the server's own Italian message.
 * Two messages live here because the server cannot speak for them: a request
 * that never arrived, and a 2xx answer this page cannot read.
 */

export interface SessionUser {
  readonly email: string;
  readonly name: string;
}

export interface ActiveSession {
  readonly id: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly userAgent: string;
  readonly current: boolean;
}

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** The request never reached a server: no worker deployed, or no connection. */
export const CONNECTION_ERROR =
  "Non riusciamo a contattare il servizio di accesso. Controlla la connessione e riprova.";

/** The server answered, but not with something this page can use. */
export const UNEXPECTED_RESPONSE =
  "Il servizio ha risposto in modo inatteso. Riprova fra qualche istante.";

function errorMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const message = (payload as { readonly error?: unknown }).error;
  return typeof message === "string" && message.trim() !== "" ? message : undefined;
}

function asUser(value: unknown): SessionUser | null {
  if (typeof value !== "object" || value === null) return null;
  const user = value as { readonly email?: unknown; readonly name?: unknown };
  if (typeof user.email !== "string" || user.email === "") return null;
  return { email: user.email, name: typeof user.name === "string" ? user.name : "" };
}

function asSession(value: unknown): ActiveSession | null {
  if (typeof value !== "object" || value === null) return null;
  const session = value as Record<string, unknown>;
  if (typeof session.id !== "string" || session.id === "") return null;
  return {
    id: session.id,
    createdAt: typeof session.createdAt === "string" ? session.createdAt : "",
    lastSeenAt: typeof session.lastSeenAt === "string" ? session.lastSeenAt : "",
    userAgent: typeof session.userAgent === "string" ? session.userAgent : "",
    current: session.current === true,
  };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(path: string, method: Method, json?: unknown): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  const init: RequestInit = { method, headers, credentials: "same-origin" };
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return { ok: false, status: 0, message: CONNECTION_ERROR };
  }

  let payload: unknown;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: errorMessage(payload) ?? UNEXPECTED_RESPONSE };
  }
  return { ok: true, status: response.status, data: payload as T };
}

/** Endpoints that answer with the signed-in user. */
async function userRequest(
  path: string,
  method: "POST" | "PATCH",
  json: unknown,
): Promise<ApiResult<SessionUser>> {
  const result = await request<{ readonly user?: unknown }>(path, method, json);
  if (!result.ok) return result;
  const user = asUser(result.data?.user);
  if (user === null) return { ok: false, status: result.status, message: UNEXPECTED_RESPONSE };
  return { ok: true, status: result.status, data: user };
}

export async function readSession(): Promise<ApiResult<{ readonly user: SessionUser | null }>> {
  const result = await request<{ readonly user?: unknown }>("/api/auth/session", "GET");
  if (!result.ok) return result;
  return { ok: true, status: result.status, data: { user: asUser(result.data?.user) } };
}

export function signIn(email: string, password: string, turnstileToken = ""): Promise<ApiResult<SessionUser>> {
  return userRequest("/api/auth/login", "POST", { email, password, turnstileToken });
}

export function createAccount(
  name: string,
  email: string,
  password: string,
  turnstileToken = "",
): Promise<ApiResult<SessionUser>> {
  return userRequest("/api/auth/register", "POST", { name, email, password, turnstileToken });
}

export function signOut(): Promise<ApiResult<undefined>> {
  return request<undefined>("/api/auth/logout", "POST");
}

export function updateProfile(name: string): Promise<ApiResult<SessionUser>> {
  return userRequest("/api/auth/profile", "PATCH", { name });
}

export function updatePassword(currentPassword: string, newPassword: string): Promise<ApiResult<undefined>> {
  return request<undefined>("/api/auth/password", "POST", { currentPassword, newPassword });
}

export async function readSessions(): Promise<ApiResult<readonly ActiveSession[]>> {
  const result = await request<{ readonly sessions?: unknown }>("/api/auth/sessions", "GET");
  if (!result.ok) return result;
  const raw = result.data?.sessions;
  return {
    ok: true,
    status: result.status,
    data: Array.isArray(raw) ? raw.map(asSession).filter((item): item is ActiveSession => item !== null) : [],
  };
}

export function closeSession(id: string): Promise<ApiResult<undefined>> {
  return request<undefined>(`/api/auth/sessions/${encodeURIComponent(id)}`, "DELETE");
}

export function deleteAccount(password: string): Promise<ApiResult<undefined>> {
  return request<undefined>("/api/auth/account", "DELETE", { password });
}

/** The name if it is set, the email otherwise. */
export function displayName(user: SessionUser): string {
  const name = user.name.trim();
  return name === "" ? user.email : name;
}

export function initialOf(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "?" : trimmed.slice(0, 1).toLocaleUpperCase("it");
}

const BROWSERS: ReadonlyArray<readonly [string, string]> = [
  ["Edg/", "Microsoft Edge"],
  ["OPR/", "Opera"],
  ["Firefox/", "Firefox"],
  ["Chrome/", "Google Chrome"],
  ["Safari/", "Safari"],
];

const SYSTEMS: ReadonlyArray<readonly [string, string]> = [
  ["Windows", "Windows"],
  ["iPhone", "iPhone"],
  ["iPad", "iPad"],
  ["Android", "Android"],
  ["Mac OS X", "macOS"],
  ["Linux", "Linux"],
];

/**
 * A readable summary of a stored user agent — the browser and the system, no
 * version numbers and no identifiers. Text this function cannot place stays
 * "sconosciuto" rather than claiming a device it did not recognise.
 */
export function describeUserAgent(userAgent: string): string {
  if (userAgent.trim() === "") return "Dispositivo sconosciuto";
  const browser = BROWSERS.find(([marker]) => userAgent.includes(marker));
  const system = SYSTEMS.find(([marker]) => userAgent.includes(marker));
  if (browser === undefined && system === undefined) return "Browser sconosciuto";
  return [browser?.[1], system?.[1]].filter((part): part is string => part !== undefined).join(" · ");
}
