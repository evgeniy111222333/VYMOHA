import { runtimeEnv } from "@/db/runtime";
import { sendTenderChangeEmail } from "@/src/infrastructure/notifications/email";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
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
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
