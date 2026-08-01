import { runtimeEnv } from "@/db/runtime";
import { HttpError } from "@/src/lib/http";

export function phoneAuthConfigured(): boolean {
  const env = runtimeEnv();
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID);
}

export async function sendPhoneCode(phone: string): Promise<void> {
  const response = await twilioRequest("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
  const result = await response.json() as { status?: string; message?: string };
  if (!response.ok || !result.status) throw new HttpError(502, "Не вдалося надіслати код. Перевірте номер і спробуйте ще раз.");
}

export async function verifyPhoneCode(phone: string, code: string): Promise<boolean> {
  const response = await twilioRequest("VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
  const result = await response.json() as { status?: string };
  return response.ok && result.status === "approved";
}

async function twilioRequest(path: string, body: URLSearchParams): Promise<Response> {
  const env = runtimeEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
    throw new HttpError(503, "Реєстрація за номером тимчасово недоступна.");
  }
  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  return fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
    method: "POST",
    headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}
