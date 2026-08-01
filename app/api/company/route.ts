import { getCompanyProfile, upsertCompanyProfile, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin } from "@/src/lib/security";
import { companyProfileSchema } from "@/src/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    return Response.json({ data: await getCompanyProfile(user.id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, 32_000);
    const user = await requireRequestUser(request);
    const parsed = companyProfileSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: { message: "Профіль містить помилки.", details: parsed.error.issues } }, { status: 422 });
    await upsertCompanyProfile(user.id, parsed.data);
    await writeAuditEvent({ userId: user.id, action: "company.updated", resourceType: "organization" });
    return Response.json({ data: parsed.data });
  } catch (error) { return apiError(error); }
}
