import { ensureDatabase } from "@/db/runtime";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { HttpError } from "@/src/lib/http";
import { hashPassword, verifyPassword } from "./password";
import type { AuthProvider } from "./types";
import { normalizeIdentifier } from "./validation";

type PasswordRegistration = {
  provider: "email" | "phone";
  subject: string;
  displayName: string;
  password: string;
  verified: boolean;
};

export async function registerPasswordUser(input: PasswordRegistration): Promise<string> {
  const database = await ensureDatabase();
  const existingIdentity = await findIdentity(input.provider, input.subject);
  if (existingIdentity) throw new HttpError(409, "Обліковий запис уже існує. Спробуйте увійти.");

  if (input.provider === "email") {
    const existingAccount = await database.prepare("SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1")
      .bind(input.subject).first();
    if (existingAccount) throw new HttpError(409, "Ця адреса вже використовується. Увійдіть через Google або зверніться до підтримки.");
  } else {
    const existingAccount = await database.prepare("SELECT user_id FROM user_accounts WHERE phone = ? LIMIT 1")
      .bind(input.subject).first();
    if (existingAccount) throw new HttpError(409, "Цей номер уже використовується. Спробуйте увійти.");
  }

  const userId = crypto.randomUUID();
  const email = input.provider === "email" ? input.subject : phonePlaceholderEmail(userId);
  const secret = await hashPassword(input.password);
  await ensureUserAccount({
    id: userId,
    email,
    phone: input.provider === "phone" ? input.subject : null,
    name: input.displayName,
    emailVerified: input.provider === "email" ? input.verified : false,
    phoneVerified: input.provider === "phone" ? input.verified : false,
  });
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO auth_identities (
    id, user_id, provider, provider_subject, secret_hash, secret_salt, verified_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    crypto.randomUUID(), userId, input.provider, input.subject, secret.hash, secret.salt,
    input.verified ? now : null, now, now,
  ).run();
  return userId;
}

export async function authenticatePassword(identifier: string, password: string): Promise<string> {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) throw invalidCredentials();
  const database = await ensureDatabase();
  const row = await database.prepare(`SELECT i.user_id, i.secret_hash, i.secret_salt, a.status
    FROM auth_identities i JOIN user_accounts a ON a.user_id = i.user_id
    WHERE i.provider = ? AND i.provider_subject = ? LIMIT 1`).bind(
    normalized.provider, normalized.subject,
  ).first<Record<string, unknown>>();
  if (!row?.secret_hash || !row.secret_salt) {
    await fakePasswordWork(password);
    throw invalidCredentials();
  }
  const valid = await verifyPassword(password, String(row.secret_hash), String(row.secret_salt));
  if (!valid) throw invalidCredentials();
  if (String(row.status) !== "active") throw new HttpError(403, "Обліковий запис призупинено.");
  return String(row.user_id);
}

export async function upsertGoogleUser(profile: {
  subject: string; email: string; emailVerified: boolean; name: string; picture?: string | null;
}): Promise<string> {
  if (!profile.emailVerified) throw new HttpError(403, "Google не підтвердив адресу електронної пошти.");
  const database = await ensureDatabase();
  const existingIdentity = await findIdentity("google", profile.subject);
  if (existingIdentity) {
    await ensureUserAccount({
      id: existingIdentity, email: profile.email, name: profile.name, avatarUrl: profile.picture,
      emailVerified: true,
    });
    return existingIdentity;
  }

  const existingAccount = await database.prepare("SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1")
    .bind(profile.email.toLowerCase()).first<{ user_id: string }>();
  const userId = existingAccount?.user_id ?? crypto.randomUUID();
  await ensureUserAccount({
    id: userId, email: profile.email, name: profile.name, avatarUrl: profile.picture, emailVerified: true,
  });
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO auth_identities (
    id, user_id, provider, provider_subject, secret_hash, secret_salt, verified_at, created_at, updated_at
  ) VALUES (?, ?, 'google', ?, NULL, NULL, ?, ?, ?)`).bind(
    crypto.randomUUID(), userId, profile.subject, now, now, now,
  ).run();
  return userId;
}

async function findIdentity(provider: AuthProvider, subject: string): Promise<string | null> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_subject = ? LIMIT 1")
    .bind(provider, subject).first<{ user_id: string }>();
  return row?.user_id ?? null;
}

function invalidCredentials(): HttpError {
  return new HttpError(401, "Невірна пошта, номер або пароль.");
}

async function fakePasswordWork(password: string): Promise<void> {
  await hashPassword(`${password}:invalid`);
}

function phonePlaceholderEmail(userId: string): string {
  return `${userId}@phone.vymoha.invalid`;
}
