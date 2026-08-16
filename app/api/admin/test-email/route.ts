import { runtimeEnv } from "@/db/runtime";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { requireAdmin } from "@/src/infrastructure/storage/admin";
import { sendTenderChangeEmail } from "@/src/infrastructure/notifications/email";
import { apiError, requireRequestUser } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRequestUser(request);
    await ensureUserAccount(user);
    await requireAdmin(user.id);

    const env = runtimeEnv();
    const apiKey = env.RESEND_API_KEY;
    const from = "VYMOHA <updates@vymoha.com>";

    if (!apiKey) {
      return Response.json({ error: "RESEND_API_KEY is not configured in environment" }, { status: 500 });
    }

    const result = await sendTenderChangeEmail(
      {
        to: "itsdelka001@gmail.com",
        tenderExternalId: "UA-2026-08-16-004812-a",
        sourceUrl: "https://prozorro.gov.ua/tender/UA-2026-08-16-004812-a",
        previousVersion: new Date(Date.now() - 86400000).toISOString(),
        currentVersion: new Date().toISOString(),
      },
      apiKey,
      from
    );

    return Response.json({ success: true, status: result, to: "itsdelka001@gmail.com" });
  } catch (error) {
    return apiError(error);
  }
}
