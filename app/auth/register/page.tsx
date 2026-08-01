import { redirect } from "next/navigation";
import { getAuthUser, safeReturnPath } from "@/app/auth";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthPageFrame } from "@/components/auth/AuthPageFrame";
import { googleConfigured } from "@/src/auth/providers/google";
import { phoneAuthConfigured } from "@/src/auth/providers/twilio";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to);
  if (await getAuthUser()) redirect(returnTo);
  return <AuthPageFrame><AuthPanel mode="register" returnTo={returnTo} googleEnabled={googleConfigured()} phoneEnabled={phoneAuthConfigured()} /></AuthPageFrame>;
}
