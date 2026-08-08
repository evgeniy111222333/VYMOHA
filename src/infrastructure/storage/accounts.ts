import { ensureDatabase, runtimeEnv } from "@/db/runtime";
import type { AccountRole, AccountStatus } from "@/src/domain/access/roles";

export type UserIdentity = {
  id: string;
  email: string;
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

export type UserAccount = {
  userId: string;
  email: string;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: AccountRole;
  status: AccountStatus;
  creditBalance: number;
  totalCreditsPurchased: number;
  createdAt: string;
  updatedAt: string;
};

export async function ensureUserAccount(user: UserIdentity): Promise<UserAccount> {
  const database = await ensureDatabase();
  const existing = await getUserAccount(user.id);
  const displayName = user.name?.trim() || user.email;
  const forcedAdmin = Boolean(user.emailVerified) && isBootstrapAdmin(user.email);
  const now = new Date().toISOString();

  if (!existing) {
    const startingCredits = forcedAdmin ? adminStartingCredits() : 30;
    await database.prepare(`INSERT INTO user_accounts (
      user_id, email, phone, display_name, avatar_url, email_verified, phone_verified,
      role, status, credit_balance, total_credits_purchased, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?)`).bind(
      user.id, user.email.toLowerCase(), user.phone ?? null, displayName, user.avatarUrl ?? null,
      user.emailVerified ? 1 : 0, user.phoneVerified ? 1 : 0,
      forcedAdmin ? "admin" : "user", startingCredits, now, now,
    ).run();
    if (startingCredits > 0) {
      const ledgerReason = forcedAdmin ? 'admin_bootstrap' : 'welcome_bonus';
      await database.prepare(`INSERT OR IGNORE INTO credit_ledger (
        id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`).bind(
        crypto.randomUUID(), user.id, startingCredits, startingCredits, ledgerReason, `bootstrap:${user.id}`, now,
      ).run();
    }
  } else {
    await database.prepare(`UPDATE user_accounts SET email = ?, phone = COALESCE(?, phone),
      display_name = ?, avatar_url = COALESCE(?, avatar_url),
      email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
      phone_verified = CASE WHEN ? = 1 THEN 1 ELSE phone_verified END,
      role = CASE WHEN ? = 1 THEN 'admin' ELSE role END, updated_at = ? WHERE user_id = ?`).bind(
      user.email.toLowerCase(), user.phone ?? null, displayName, user.avatarUrl ?? null,
      user.emailVerified ? 1 : 0, user.phoneVerified ? 1 : 0, forcedAdmin ? 1 : 0, now, user.id,
    ).run();
  }

  const account = await getUserAccount(user.id);
  if (!account) throw new Error("Не вдалося створити обліковий запис.");
  return account;
}

export async function getUserAccount(userId: string): Promise<UserAccount | null> {
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT user_id, email, phone, display_name, avatar_url,
    email_verified, phone_verified, role, status,
    credit_balance, total_credits_purchased, created_at, updated_at
    FROM user_accounts WHERE user_id = ? LIMIT 1`).bind(userId).first<Record<string, unknown>>();
  return row ? mapAccount(row) : null;
}

export function isBootstrapAdmin(email: string): boolean {
  const allowed = (runtimeEnv().ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function mapAccount(row: Record<string, unknown>): UserAccount {
  return {
    userId: String(row.user_id), email: String(row.email), phone: row.phone ? String(row.phone) : null,
    displayName: String(row.display_name), avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    emailVerified: Boolean(row.email_verified), phoneVerified: Boolean(row.phone_verified),
    role: String(row.role) as AccountRole, status: String(row.status) as AccountStatus,
    creditBalance: Number(row.credit_balance), totalCreditsPurchased: Number(row.total_credits_purchased),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function adminStartingCredits(): number {
  const value = Number(runtimeEnv().ADMIN_STARTING_CREDITS ?? 250);
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000 ? value : 250;
}
