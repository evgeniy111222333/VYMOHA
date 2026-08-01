import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthUserByToken, SESSION_COOKIE } from "@/src/auth/session";
import type { AuthUser } from "@/src/auth/types";

export async function getAuthUser(): Promise<AuthUser | null> {
  const store = await cookies();
  return getAuthUserByToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAuthUser(returnTo: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/auth/sign-in?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://vymoha.local");
    if (url.origin !== "https://vymoha.local" || url.pathname.startsWith("/auth") || url.pathname.startsWith("/api/auth")) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
