import { z } from "zod";

const password = z.string().min(10, "Пароль має містити щонайменше 10 символів.").max(128)
  .regex(/[A-Za-zА-Яа-яІіЇїЄєҐґ]/u, "Додайте до пароля літеру.")
  .regex(/\d/, "Додайте до пароля цифру.");

export const emailRegistrationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
});

export const signInSchema = z.object({
  identifier: z.string().trim().min(5).max(254),
  password: z.string().min(1).max(128),
});

export const phoneStartSchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Вкажіть номер у міжнародному форматі, наприклад +380…"),
});

export const phoneVerifySchema = phoneStartSchema.extend({
  displayName: z.string().trim().min(2).max(80),
  password,
  code: z.string().trim().regex(/^\d{4,10}$/),
});

export function normalizeIdentifier(value: string): { provider: "email" | "phone"; subject: string } | null {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const parsed = z.string().email().safeParse(trimmed.toLowerCase());
    return parsed.success ? { provider: "email", subject: parsed.data } : null;
  }
  const compact = trimmed.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact) ? { provider: "phone", subject: compact } : null;
}
