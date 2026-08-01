import { SecurityError } from "./security";

export type RequestUser = { id: string; email: string; name?: string };

export function requestUser(request: Request): RequestUser | null {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  return { id, email, name: decodeName(request) ?? undefined };
}

export function requireRequestUser(request: Request): RequestUser {
  const user = requestUser(request);
  if (!user) throw new HttpError(401, "Увійдіть, щоб продовжити.");
  return user;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: { message: error.message, details: error.details } }, { status: error.status });
  if (error instanceof SecurityError) return Response.json({ error: { message: error.message } }, { status: 403 });
  const message = error instanceof Error ? error.message : "Неочікувана помилка.";
  const safeMessage = /UA-\d{4}|форматі|не знайдено|джерело даних/i.test(message)
    ? message
    : "Сервіс тимчасово не зміг завершити операцію. Спробуйте ще раз.";
  return Response.json({ error: { message: safeMessage } }, { status: 500 });
}

function decodeName(request: Request): string | null {
  if (request.headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return null;
  const value = request.headers.get("oai-authenticated-user-full-name");
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}
