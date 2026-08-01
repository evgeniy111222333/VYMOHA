import { redirect } from "next/navigation";
import { getAuthUser, safeReturnPath } from "@/app/auth";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { googleConfigured } from "@/src/auth/providers/google";
import { phoneAuthConfigured } from "@/src/auth/providers/twilio";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.return_to);
  if (await getAuthUser()) redirect(returnTo);
  return <AuthPageFrame><AuthPanel mode="sign-in" returnTo={returnTo} googleEnabled={googleConfigured()} phoneEnabled={phoneAuthConfigured()} initialError={oauthError(params.error)} /></AuthPageFrame>;
}

function oauthError(value?: string): string {
  if (value === "google_unavailable") return "Вхід через Google тимчасово недоступний.";
  if (value === "google_failed") return "Google не підтвердив вхід. Спробуйте ще раз.";
  return "";
}
