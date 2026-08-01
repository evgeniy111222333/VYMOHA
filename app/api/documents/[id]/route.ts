import { runtimeEnv } from "@/db/runtime";
import { deleteDocument, getDocument, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";
import { assertSameOrigin } from "@/src/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireRequestUser(request);
    const id = (await params).id;
    const document = await getDocument(user.id, id);
    if (!document) return Response.json({ error: { message: "Документ не знайдено." } }, { status: 404 });
    const object = await runtimeEnv().DOCUMENTS.get(document.objectKey);
    if (!object?.body) return Response.json({ error: { message: "Файл недоступний у сховищі." } }, { status: 404 });
    return new Response(object.body, { headers: {
      "content-type": document.mimeType, "content-length": String(document.sizeBytes),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const id = (await params).id;
    const removed = await deleteDocument(user.id, id);
    if (!removed) return Response.json({ error: { message: "Документ не знайдено." } }, { status: 404 });
    await writeAuditEvent({ userId: user.id, action: "document.deleted", resourceType: "document", resourceId: id });
    return Response.json({ data: { deleted: true } });
  } catch (error) { return apiError(error); }
}
