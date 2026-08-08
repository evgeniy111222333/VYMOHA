import { SecurityError } from "./security";
import { getRequestAuthUser } from "@/src/auth/session";

export type RequestUser = { id: string; email: string; name?: string };

export async function requestUser(request: Request): Promise<RequestUser | null> {
  const user = await getRequestAuthUser(request);
  if (!user) return null;
  return { id: user.userId, email: user.email, name: user.displayName };
}

export async function requireRequestUser(request: Request): Promise<RequestUser> {
  const user = await requestUser(request);
  if (!user) throw new HttpError(401, "Увійдіть, щоб продовжити.");
  return user;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: HeadersInit
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function apiError(error: unknown): Response {
  const isSyntaxError = error instanceof SyntaxError;
  if (!(error instanceof HttpError) && !(error instanceof SecurityError) && !isSyntaxError) {
    console.error("Unhandled API error", error);
  }
  
  if (error instanceof HttpError) {
    return Response.json({ error: { message: error.message, details: error.details } }, { status: error.status, headers: error.headers });
  }
  if (error instanceof SecurityError) return Response.json({ error: { message: error.message } }, { status: 403 });
  if (isSyntaxError) return Response.json({ error: { message: "Некоректний формат даних (очікувався правильний JSON)." } }, { status: 400 });

  const message = error instanceof Error ? error.message : "Неочікувана помилка.";
  const safeMessage = /UA-\d{4}|форматі|не знайдено|джерело даних/i.test(message)
    ? message
    : "Сервіс тимчасово не зміг завершити операцію. Спробуйте ще раз.";
  return Response.json({ error: { message: safeMessage } }, { status: 500 });
}
