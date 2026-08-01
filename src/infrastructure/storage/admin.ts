import { ensureDatabase } from "@/db/runtime";
import type { AccountRole, AccountStatus } from "@/src/domain/access/roles";
import { HttpError } from "@/src/lib/http";
import { getUserAccount, isBootstrapAdmin, mapAccount, type UserAccount } from "./accounts";
import { getCreditBalance } from "./billing";

export async function requireAdmin(userId: string): Promise<UserAccount> {
  const account = await getUserAccount(userId);
  if (!account || account.status !== "active" || account.role !== "admin") throw new HttpError(403, "Потрібні права адміністратора.");
  return account;
}

export async function listUserAccounts(limit = 100): Promise<UserAccount[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT user_id, email, display_name, role, status, credit_balance,
    total_credits_purchased, created_at, updated_at FROM user_accounts ORDER BY created_at DESC LIMIT ?`)
    .bind(Math.min(limit, 250)).all<Record<string, unknown>>();
  return result.results.map(mapAccount);
}

export async function setUserRole(targetUserId: string, role: AccountRole): Promise<void> {
  const database = await ensureDatabase();
  const target = await getUserAccount(targetUserId);
  if (!target) throw new HttpError(404, "Користувача не знайдено.");
  if (role !== "admin" && isBootstrapAdmin(target.email)) throw new HttpError(409, "Головного адміністратора не можна понизити.");
  await database.prepare("UPDATE user_accounts SET role = ?, updated_at = ? WHERE user_id = ?")
    .bind(role, new Date().toISOString(), targetUserId).run();
}

export async function setUserStatus(targetUserId: string, status: AccountStatus): Promise<void> {
  const database = await ensureDatabase();
  const target = await getUserAccount(targetUserId);
  if (!target) throw new HttpError(404, "Користувача не знайдено.");
  if (status === "suspended" && isBootstrapAdmin(target.email)) throw new HttpError(409, "Головного адміністратора не можна заблокувати.");
  await database.prepare("UPDATE user_accounts SET status = ?, updated_at = ? WHERE user_id = ?")
    .bind(status, new Date().toISOString(), targetUserId).run();
}

export async function grantCredits(adminUserId: string, targetUserId: string, credits: number, note: string): Promise<number> {
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 100_000) throw new HttpError(422, "Некоректна кількість кредитів.");
  const database = await ensureDatabase();
  const target = await getUserAccount(targetUserId);
  if (!target) throw new HttpError(404, "Користувача не знайдено.");
  const now = new Date().toISOString();
  await database.prepare("UPDATE user_accounts SET credit_balance = credit_balance + ?, updated_at = ? WHERE user_id = ?")
    .bind(credits, now, targetUserId).run();
  const balance = await getCreditBalance(targetUserId);
  await database.prepare(`INSERT INTO credit_ledger (
    id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, 'admin_grant', ?, ?, ?)`).bind(
    crypto.randomUUID(), targetUserId, credits, balance, `admin:${adminUserId}:${crypto.randomUUID()}`,
    JSON.stringify({ adminUserId, note: note.slice(0, 240) }), now,
  ).run();
  return balance;
}
