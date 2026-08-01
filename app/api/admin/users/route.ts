import { isAccountRole, isAccountStatus } from "@/src/domain/access/roles";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { grantCredits, listUserAccounts, requireAdmin, setUserRole, setUserStatus } from "@/src/infrastructure/storage/admin";
import { apiError, HttpError, requireRequestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin } from "@/src/lib/security";
import { z } from "zod";

export const dynamic = "force-dynamic";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), userId: z.string().min(3).max(200), role: z.enum(["user", "admin"]) }),
  z.object({ action: z.literal("status"), userId: z.string().min(3).max(200), status: z.enum(["active", "suspended"]) }),
  z.object({ action: z.literal("credits"), userId: z.string().min(3).max(200), credits: z.number().int().min(1).max(100_000), note: z.string().trim().max(240).default("") }),
]);

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);
    return Response.json({ data: await listUserAccounts() }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 12_000);
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);
    const parsed = mutationSchema.safeParse(await request.json());
    if (!parsed.success) throw new HttpError(422, "Перевірте дані адміністративної дії.");
    if (parsed.data.action === "role") {
      if (!isAccountRole(parsed.data.role)) throw new HttpError(422, "Некоректна роль.");
      await setUserRole(parsed.data.userId, parsed.data.role);
    } else if (parsed.data.action === "status") {
      if (!isAccountStatus(parsed.data.status)) throw new HttpError(422, "Некоректний статус.");
      await setUserStatus(parsed.data.userId, parsed.data.status);
    } else {
      await grantCredits(user.id, parsed.data.userId, parsed.data.credits, parsed.data.note);
    }
    return Response.json({ data: await listUserAccounts() });
  } catch (error) { return apiError(error); }
}
