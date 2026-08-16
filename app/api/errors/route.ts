import { captureError } from "@/src/services/observability/errors";
import { consumeRateLimit } from "@/src/infrastructure/storage/repository";
import { assertBodySize, assertSameOrigin, clientAddress, sha256 } from "@/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    assertBodySize(request, 4_000);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return Response.json({ ok: false }, { status: 400 });

    const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
    if (!message) return Response.json({ ok: false }, { status: 400 });

    const ipHash = await sha256(clientAddress(request));
    const limit = await consumeRateLimit(`errors:client:${ipHash}`, 20, 3_600);
    if (!limit.allowed) return Response.json({ ok: false }, { status: 429 });

    await captureError({
      source: "client",
      route: typeof body.route === "string" ? body.route.slice(0, 200) : undefined,
      error: {
        name: typeof body.name === "string" ? body.name.slice(0, 200) : "ClientError",
        message,
        stack: typeof body.stack === "string" ? body.stack.slice(0, 2000) : undefined,
      },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
