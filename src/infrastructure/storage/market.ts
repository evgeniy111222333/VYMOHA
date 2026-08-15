import { ensureDatabase } from "@/db/runtime";
import type { MarketSample } from "@/src/domain/market/stats";

/** Витяг з сирого тендера → нормалізований семпл для ринкової статистики. */
export function extractMarketSample(raw: Record<string, unknown>): MarketSample | null {
  const cpv = readCpv(raw);
  if (!cpv) return null;

  const method = readString(raw.procurementMethodType) ?? null;
  const value = raw.value as Record<string, unknown> | undefined;
  const expectedAmount = readNumber(value?.amount);
  if (expectedAmount === null || expectedAmount <= 0) return null;

  const procuringEntity = raw.procuringEntity as Record<string, unknown> | undefined;
  const address = procuringEntity?.address as Record<string, unknown> | undefined;
  const region = readString(address?.region) ?? null;

  const participants = countParticipants(raw.bids);
  const winningAmount = readWinningAmount(raw.awards);
  const winnerEdrpou = readWinnerEdrpou(raw.awards);
  const completedAt = (readString(raw.dateModified) ?? readString(raw.date)) ?? null;

  return {
    cpv8: cpv.cpv8,
    cpv5: cpv.cpv5,
    cpv3: cpv.cpv3,
    region,
    method,
    expectedAmount,
    currency: readString(value?.currency) ?? null,
    participants,
    winningAmount,
    winnerEdrpou,
    completedAt,
  };
}

/** Читає CPV з items[0].classification.id (fallback — top classification). */
export function readCpv(raw: Record<string, unknown>): { cpv8: string; cpv5: string; cpv3: string } | null {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const firstItem = items[0] as Record<string, unknown> | undefined;
  const classification = (firstItem?.classification ?? raw.classification) as Record<string, unknown> | undefined;
  const id = readString(classification?.id);
  if (!id) return null;
  const digits = id.replace(/\D/g, "");
  if (digits.length < 8) return null;
  // Зберігаємо 8-значну базу без контрольної цифри — це канонічний CPV
  // для порівняння; контрольна цифра детерміновано виводиться з бази.
  const cpv8 = digits.slice(0, 8);
  return { cpv8, cpv5: cpv8.slice(0, 5), cpv3: cpv8.slice(0, 3) };
}

/** Кількість унікальних учасників за ЄДРПОУ серед ставок. */
export function countParticipants(bids: unknown): number {
  if (!Array.isArray(bids)) return 0;
  const ids = new Set<string>();
  for (const bid of bids) {
    const tenderers = (bid as Record<string, unknown> | undefined)?.tenderers;
    if (!Array.isArray(tenderers)) continue;
    for (const tenderer of tenderers) {
      const id = (tenderer as Record<string, unknown> | undefined)?.identifier as Record<string, unknown> | undefined;
      const edrpou = readString(id?.id);
      if (edrpou) ids.add(edrpou);
    }
  }
  return ids.size;
}

/** Сума активних award (переможці); null якщо переможця не визначено. */
export function readWinningAmount(awards: unknown): number | null {
  if (!Array.isArray(awards)) return null;
  let total: number | null = null;
  for (const award of awards) {
    const record = award as Record<string, unknown> | undefined;
    if (record?.status !== "active") continue;
    const amount = readNumber((record.value as Record<string, unknown> | undefined)?.amount);
    if (amount === null) continue;
    total = (total ?? 0) + amount;
  }
  return total;
}

export function readWinnerEdrpou(awards: unknown): string | null {
  if (!Array.isArray(awards)) return null;
  for (const award of awards) {
    const record = award as Record<string, unknown> | undefined;
    if (record?.status !== "active") continue;
    const suppliers = record.suppliers;
    if (!Array.isArray(suppliers)) continue;
    const supplier = suppliers[0] as Record<string, unknown> | undefined;
    const edrpou = readString((supplier?.identifier as Record<string, unknown> | undefined)?.id);
    if (edrpou) return edrpou;
  }
  return null;
}

export async function upsertMarketTenders(samples: MarketSample[]): Promise<void> {
  if (samples.length === 0) return;
  const database = await ensureDatabase();
  const indexedAt = new Date().toISOString();
  const statements = samples.map((sample) => {
    const id = `m-${sample.cpv8}-${sample.completedAt ?? "unknown"}-${sample.winnerEdrpou ?? "n/a"}-${sample.expectedAmount}`;
    return database.prepare(`INSERT INTO market_tenders (
      id, tender_external_id, cpv8, cpv5, cpv3, region, method,
      expected_amount, currency, participants, winning_amount, winner_edrpou,
      completed_at, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`).bind(
      id, id, sample.cpv8, sample.cpv5, sample.cpv3, sample.region, sample.method,
      sample.expectedAmount, sample.currency, sample.participants, sample.winningAmount,
      sample.winnerEdrpou, sample.completedAt, indexedAt,
    );
  });
  await database.batch(statements);
}

export async function queryMarketSamples(cpv5: string, cpv3: string): Promise<MarketSample[]> {
  const database = await ensureDatabase();
  const result = await database.prepare(`SELECT cpv8, cpv5, cpv3, region, method,
    expected_amount, currency, participants, winning_amount, winner_edrpou, completed_at
    FROM market_tenders WHERE cpv5 = ? OR cpv3 = ? ORDER BY completed_at DESC LIMIT 500`)
    .bind(cpv5, cpv3).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    cpv8: String(row.cpv8), cpv5: String(row.cpv5), cpv3: String(row.cpv3),
    region: row.region ? String(row.region) : null,
    method: row.method ? String(row.method) : null,
    expectedAmount: Number(row.expected_amount),
    currency: row.currency ? String(row.currency) : null,
    participants: Number(row.participants),
    winningAmount: row.winning_amount === null || row.winning_amount === undefined ? null : Number(row.winning_amount),
    winnerEdrpou: row.winner_edrpou ? String(row.winner_edrpou) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }));
}

export type MarketBackfillState = { cursor: string | null; finished: boolean };

const BACKFILL_KEY = "backfill";

export async function getMarketBackfillState(): Promise<MarketBackfillState> {
  const database = await ensureDatabase();
  const row = await database.prepare("SELECT cursor, finished FROM market_index_progress WHERE key = ?")
    .bind(BACKFILL_KEY).first<{ cursor: string | null; finished: number }>();
  return { cursor: row?.cursor ?? null, finished: Boolean(row?.finished) };
}

export async function setMarketBackfillState(cursor: string | null, finished: boolean): Promise<void> {
  const database = await ensureDatabase();
  await database.prepare(`INSERT INTO market_index_progress (key, cursor, finished, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET cursor = excluded.cursor, finished = excluded.finished, updated_at = excluded.updated_at`)
    .bind(BACKFILL_KEY, cursor, finished ? 1 : 0, new Date().toISOString()).run();
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
