import { ensureDatabase } from "@/db/runtime";
import type { AnalysisTier, CreditPackage } from "@/src/domain/billing/packages";
import { HttpError } from "@/src/lib/http";

export type CreditEntry = {
  id: string; delta: number; balanceAfter: number; reason: string; metadata: Record<string, unknown>; createdAt: string;
};

export type PaymentOrder = {
  id: string; userId: string; packageId: string; credits: number; amountMinor: number; currency: string;
  status: string; providerSessionId: string | null; createdAt: string; paidAt: string | null;
};

export type MonobankPayment = {
  sessionId: string;
  paymentId: string;
  amountMinor: number;
  currencyCode: number;
};

export type MonobankFulfillmentResult = "fulfilled" | "already-processed" | "not-found" | "amount-mismatch" | "currency-mismatch";

export async function reserveAnalysisCredits(input: {
  userId: string; analysisId: string; tier: AnalysisTier; model: string; credits: number;
}): Promise<number> {
  if (input.credits <= 0) return getCreditBalance(input.userId);
  const database = await ensureDatabase();
  const result = await database.prepare(`UPDATE user_accounts SET credit_balance = credit_balance - ?, updated_at = ?
    WHERE user_id = ? AND status = 'active' AND credit_balance >= ?`).bind(
    input.credits, new Date().toISOString(), input.userId, input.credits,
  ).run();
  if ((result.meta.changes ?? 0) !== 1) throw new HttpError(402, "Недостатньо сигналів. Оберіть пакет і повторіть аналіз.");
  const balance = await getCreditBalance(input.userId);
  const now = new Date().toISOString();
  try {
    await database.batch([
      database.prepare(`INSERT INTO credit_ledger (
        id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, 'analysis_charge', ?, ?, ?)`).bind(
        crypto.randomUUID(), input.userId, -input.credits, balance, `analysis:${input.analysisId}:charge`,
        JSON.stringify({ analysisId: input.analysisId, tier: input.tier, model: input.model }), now,
      ),
      database.prepare(`INSERT INTO ai_usage (
        id, user_id, analysis_id, tier, model, credits_charged, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)`).bind(
        crypto.randomUUID(), input.userId, input.analysisId, input.tier, input.model, input.credits, now,
      ),
    ]);
  } catch (error) {
    await database.prepare("UPDATE user_accounts SET credit_balance = credit_balance + ? WHERE user_id = ?").bind(input.credits, input.userId).run();
    throw error;
  }
  return balance;
}

export async function completeAnalysisUsage(input: {
  analysisId: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; costMicrousd: number;
}): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(`UPDATE ai_usage SET input_tokens = ?, cached_input_tokens = ?, output_tokens = ?,
    cost_microusd = ?, status = 'completed', completed_at = ? WHERE analysis_id = ? AND status = 'reserved'`).bind(
    input.inputTokens, input.cachedInputTokens, input.outputTokens, input.costMicrousd, new Date().toISOString(), input.analysisId,
  ).run();
}

export async function refundAnalysisCredits(userId: string, analysisId: string, reason: string): Promise<void> {
  const database = await ensureDatabase();
  const usage = await database.prepare(`SELECT credits_charged FROM ai_usage
    WHERE analysis_id = ? AND user_id = ? AND status = 'reserved' LIMIT 1`).bind(analysisId, userId).first<{ credits_charged: number }>();
  if (!usage) return;
  const claimed = await database.prepare("UPDATE ai_usage SET status = 'refunded', completed_at = ? WHERE analysis_id = ? AND status = 'reserved'")
    .bind(new Date().toISOString(), analysisId).run();
  if ((claimed.meta.changes ?? 0) !== 1) return;
  const credits = Number(usage.credits_charged);
  await database.prepare("UPDATE user_accounts SET credit_balance = credit_balance + ?, updated_at = ? WHERE user_id = ?")
    .bind(credits, new Date().toISOString(), userId).run();
  const balance = await getCreditBalance(userId);
  await database.prepare(`INSERT OR IGNORE INTO credit_ledger (
    id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, 'analysis_refund', ?, ?, ?)`).bind(
    crypto.randomUUID(), userId, credits, balance, `analysis:${analysisId}:refund`, JSON.stringify({ reason }), new Date().toISOString(),
  ).run();
}

export async function getCreditBalance(userId: string): Promise<number> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT credit_balance FROM user_accounts WHERE user_id = ? LIMIT 1")
    .bind(userId).first<{ credit_balance: number }>();
  if (!row) throw new HttpError(401, "Увійдіть, щоб користуватися сигналами.");
  return Number(row.credit_balance);
}

export async function listCreditLedger(userId: string, limit = 30): Promise<CreditEntry[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT id, delta, balance_after, reason, metadata_json, created_at
    FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(userId, Math.min(limit, 100)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), delta: Number(row.delta), balanceAfter: Number(row.balance_after), reason: String(row.reason),
    metadata: safeObject(row.metadata_json), createdAt: String(row.created_at),
  }));
}

export async function createPaymentOrder(userId: string, pack: CreditPackage, provider: "stripe" | "monobank" = "stripe"): Promise<PaymentOrder> {
  const database = await ensureDatabase();
  const order: PaymentOrder = {
    id: crypto.randomUUID(), userId, packageId: pack.id, credits: pack.credits, amountMinor: pack.amountMinor,
    currency: pack.currency, status: "pending", providerSessionId: null, createdAt: new Date().toISOString(), paidAt: null,
  };
  await database.prepare(`INSERT INTO payment_orders (
    id, user_id, package_id, credits, amount_minor, currency, status, provider, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(
    order.id, userId, order.packageId, order.credits, order.amountMinor, order.currency, provider, order.createdAt,
  ).run();
  return order;
}

export async function attachCheckoutSession(orderId: string, sessionId: string): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare("UPDATE payment_orders SET provider_session_id = ? WHERE id = ? AND status = 'pending'").bind(sessionId, orderId).run();
}

export async function fulfillPayment(orderId: string, sessionId: string, paymentId?: string): Promise<boolean> {
  const database = await ensureDatabase();
  const order = await database.prepare(`SELECT id, user_id, credits FROM payment_orders
    WHERE id = ? AND provider_session_id = ? LIMIT 1`).bind(orderId, sessionId).first<Record<string, unknown>>();
  if (!order) throw new HttpError(404, "Платіжне замовлення не знайдено.");
  const credits = Number(order.credits);
  const userId = String(order.user_id);
  const paidAt = new Date().toISOString();
  const results = await database.batch([
    database.prepare(`UPDATE user_accounts SET credit_balance = credit_balance + ?,
      total_credits_purchased = total_credits_purchased + ?, updated_at = ?
      WHERE user_id = ? AND EXISTS (
        SELECT 1 FROM payment_orders WHERE id = ? AND provider_session_id = ? AND status = 'pending'
      )`).bind(credits, credits, paidAt, userId, orderId, sessionId),
    database.prepare(`INSERT OR IGNORE INTO credit_ledger (
      id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
    ) SELECT ?, ?, ?, credit_balance, 'purchase', ?, ?, ? FROM user_accounts
      WHERE user_id = ? AND EXISTS (
        SELECT 1 FROM payment_orders WHERE id = ? AND provider_session_id = ? AND status = 'pending'
      )`).bind(
      crypto.randomUUID(), userId, credits, `payment:${orderId}`, JSON.stringify({ orderId, sessionId }), paidAt,
      userId, orderId, sessionId,
    ),
    database.prepare(`UPDATE payment_orders SET status = 'paid', provider_payment_id = ?, paid_at = ?
      WHERE id = ? AND provider_session_id = ? AND status = 'pending'`).bind(paymentId ?? null, paidAt, orderId, sessionId),
  ]);
  return (results[2]?.meta.changes ?? 0) === 1;
}

/**
 * Credits an order only when a Monobank statement item matches its generated
 * payment code, exact amount and UAH currency. The paid-state condition makes
 * duplicate webhooks safe.
 */
export async function fulfillMonobankPayment(payment: MonobankPayment): Promise<MonobankFulfillmentResult> {
  const database = await ensureDatabase();
  const order = await database.prepare(`SELECT id, user_id, credits, amount_minor, currency, status FROM payment_orders
    WHERE provider = 'monobank' AND provider_session_id = ? LIMIT 1`)
    .bind(payment.sessionId).first<Record<string, unknown>>();

  if (!order) return "not-found";
  if (String(order.status) !== "pending") return "already-processed";
  if (payment.currencyCode !== 980 || String(order.currency).toLowerCase() !== "uah") return "currency-mismatch";
  if (Number(order.amount_minor) !== payment.amountMinor) return "amount-mismatch";

  const orderId = String(order.id);
  const userId = String(order.user_id);
  const credits = Number(order.credits);
  const paidAt = new Date().toISOString();
  const results = await database.batch([
    database.prepare(`UPDATE user_accounts SET credit_balance = credit_balance + ?,
      total_credits_purchased = total_credits_purchased + ?, updated_at = ?
      WHERE user_id = ? AND EXISTS (
        SELECT 1 FROM payment_orders WHERE id = ? AND provider = 'monobank'
          AND provider_session_id = ? AND status = 'pending' AND amount_minor = ? AND currency = 'uah'
      )`).bind(credits, credits, paidAt, userId, orderId, payment.sessionId, payment.amountMinor),
    database.prepare(`INSERT OR IGNORE INTO credit_ledger (
      id, user_id, delta, balance_after, reason, idempotency_key, metadata_json, created_at
    ) SELECT ?, ?, ?, credit_balance, 'purchase', ?, ?, ? FROM user_accounts
      WHERE user_id = ? AND EXISTS (
        SELECT 1 FROM payment_orders WHERE id = ? AND provider = 'monobank'
          AND provider_session_id = ? AND status = 'pending' AND amount_minor = ? AND currency = 'uah'
      )`).bind(
      crypto.randomUUID(), userId, credits, `payment:monobank:${payment.paymentId}`,
      JSON.stringify({ orderId, sessionId: payment.sessionId, paymentId: payment.paymentId, amountMinor: payment.amountMinor, currencyCode: payment.currencyCode }),
      paidAt, userId, orderId, payment.sessionId, payment.amountMinor,
    ),
    database.prepare(`UPDATE payment_orders SET status = 'paid', provider_payment_id = ?, paid_at = ?
      WHERE id = ? AND provider = 'monobank' AND provider_session_id = ? AND status = 'pending'
        AND amount_minor = ? AND currency = 'uah'`).bind(payment.paymentId, paidAt, orderId, payment.sessionId, payment.amountMinor),
  ]);
  return (results[2]?.meta.changes ?? 0) === 1 ? "fulfilled" : "already-processed";
}

function safeObject(value: unknown): Record<string, unknown> {
  try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
