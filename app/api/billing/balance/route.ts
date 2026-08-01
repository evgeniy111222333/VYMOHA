import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { listCreditLedger } from "@/src/infrastructure/storage/billing";
import { apiError, requireRequestUser } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = requireRequestUser(request);
    const account = await ensureUserAccount(user);
    const ledger = await listCreditLedger(user.id, 20);
    return Response.json({ data: { account, ledger } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
