import { ensureDatabase } from "@/db/runtime";
import { sha256, clientAddress } from "@/src/lib/security";
import { randomToken } from "./password";
import type { AuthUser, SessionResult } from "./types";

export const SESSION_COOKIE = "vymoha_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string, request: Request): Promise<string> {
  const database = await ensureDatabase();
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  await database.prepare(`INSERT INTO auth_sessions (
    id, user_id, expires_at, created_at, last_seen_at, user_agent_hash, revoked_at
  ) VALUES (?, ?, ?, ?, ?, ?, NULL)`).bind(
    await sha256(token), userId, expiresAt.toISOString(), now.toISOString(), now.toISOString(),
    await sha256(`${userAgent}:${clientAddress(request)}`),
  ).run();
  await database.prepare("DELETE FROM auth_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL").bind(now.toISOString()).run();
  return token;
}

export async function getRequestAuthUser(request: Request): Promise<AuthUser | null> {
  return getAuthUserByToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

export async function getAuthUserByToken(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT a.user_id, a.email, a.phone, a.display_name, a.avatar_url,
    a.email_verified, a.phone_verified, a.status, s.expires_at
    FROM auth_sessions s JOIN user_accounts a ON a.user_id = s.user_id
    WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1`).bind(
    await sha256(token), new Date().toISOString(),
  ).first<Record<string, unknown>>();
  if (!row || String(row.status) !== "active") return null;
  return mapAuthUser(row);
}

export async function getSession(request: Request): Promise<SessionResult | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return null;
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT a.user_id, a.email, a.phone, a.display_name, a.avatar_url,
    a.email_verified, a.phone_verified, a.status, s.expires_at
    FROM auth_sessions s JOIN user_accounts a ON a.user_id = s.user_id
    WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1`).bind(
    await sha256(token), new Date().toISOString(),
  ).first<Record<string, unknown>>();
  if (!row || String(row.status) !== "active") return null;
  return { user: mapAuthUser(row), expiresAt: String(row.expires_at) };
}

export async function revokeRequestSession(request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  const database = await ensureDatabase();
  await database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?").bind(
    new Date().toISOString(), await sha256(token),
  ).run();
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function mapAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    userId: String(row.user_id), displayName: String(row.display_name), email: String(row.email),
    phone: row.phone ? String(row.phone) : null, avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    emailVerified: Boolean(row.email_verified), phoneVerified: Boolean(row.phone_verified),
  };
}
