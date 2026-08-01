import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { setWatch, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin } from "@/src/lib/security";
import { z } from "zod";

export const dynamic = "force-dynamic";
const schema = z.object({ source: z.string().min(10).max(300) });

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 8_000);
    const user = requireRequestUser(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: { message: "Невірний номер закупівлі." } }, { status: 422 });
    const tender = await fetchTender(parsed.data.source);
    await setWatch(user.id, user.email, tender.externalId, tender.dateModified);
    await writeAuditEvent({ userId: user.id, action: "watch.created", resourceType: "tender", resourceId: tender.externalId });
    return Response.json({ data: { tenderId: tender.externalId, active: true } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
