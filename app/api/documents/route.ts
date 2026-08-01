import { listDocuments, saveDocument, writeAuditEvent } from "@/src/infrastructure/storage/repository";
import { apiError, requireRequestUser } from "@/src/lib/http";
import { assertBodySize, assertSameOrigin, hasAllowedFileSignature, safeFilename } from "@/src/lib/security";

export const dynamic = "force-dynamic";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv",
]);

export async function GET(request: Request): Promise<Response> {
  try {
    const user = requireRequestUser(request);
    return Response.json({ data: await listDocuments(user.id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request); assertBodySize(request, MAX_FILE_BYTES + 100_000);
    const user = requireRequestUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: { message: "Оберіть файл." } }, { status: 422 });
    if (file.size === 0 || file.size > MAX_FILE_BYTES) return Response.json({ error: { message: "Файл має бути не більшим за 12 МБ." } }, { status: 422 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: { message: "Підтримуються PDF, DOCX, XLSX, TXT та CSV." } }, { status: 415 });
    const bytes = await file.arrayBuffer();
    if (!hasAllowedFileSignature(file.type, bytes)) return Response.json({ error: { message: "Вміст файла не відповідає заявленому формату." } }, { status: 415 });
    const saved = await saveDocument(user.id, { name: safeFilename(file.name), mimeType: file.type, bytes });
    await writeAuditEvent({ userId: user.id, action: "document.uploaded", resourceType: "document", resourceId: saved.id });
    return Response.json({ data: saved }, { status: 201 });
  } catch (error) { return apiError(error); }
}
