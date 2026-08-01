"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, Mail, Phone, ShieldCheck } from "lucide-react";

type AuthPanelProps = {
  mode: "sign-in" | "register";
  returnTo: string;
  googleEnabled: boolean;
  phoneEnabled: boolean;
  initialError?: string;
};

export function AuthPanel({ mode, returnTo, googleEnabled, phoneEnabled, initialError = "" }: AuthPanelProps) {
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [phoneStep, setPhoneStep] = useState<"details" | "code">("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState({ displayName: "", phone: "+380", password: "" });

  async function submitJson(endpoint: string, body: Record<string, string>) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { data?: { redirectTo?: string; sent?: boolean }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Не вдалося завершити дію.");
      if (result.data?.redirectTo) window.location.href = returnTo || result.data.redirectTo;
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сталася помилка. Спробуйте ще раз.");
      return null;
    } finally { setBusy(false); }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submitJson("/api/auth/sign-in", { identifier: String(data.get("identifier") ?? ""), password: String(data.get("password") ?? "") });
  }

  async function registerEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("Паролі не збігаються."); return; }
    await submitJson("/api/auth/register", {
      displayName: String(data.get("displayName") ?? ""), email: String(data.get("email") ?? ""), password,
    });
  }

  async function requestPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneEnabled) { setError("Реєстрація за номером тимчасово недоступна."); return; }
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("Паролі не збігаються."); return; }
    const draft = { displayName: String(data.get("displayName") ?? ""), phone: String(data.get("phone") ?? ""), password };
    const result = await submitJson("/api/auth/phone/start", { phone: draft.phone });
    if (result?.data?.sent) { setPhoneDraft(draft); setPhoneStep("code"); }
  }

  async function verifyPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submitJson("/api/auth/phone/verify", { ...phoneDraft, code: String(data.get("code") ?? "") });
  }

  const googleHref = `/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;

  return <div className="auth-panel">
    <div className="auth-panel__tabs" aria-label="Режим авторизації">
      <a className={mode === "sign-in" ? "is-active" : ""} href={`/auth/sign-in?return_to=${encodeURIComponent(returnTo)}`}>Вхід</a>
      <a className={mode === "register" ? "is-active" : ""} href={`/auth/register?return_to=${encodeURIComponent(returnTo)}`}>Реєстрація</a>
    </div>

    <header><span className="auth-panel__icon"><ShieldCheck size={19} /></span><div><h1>{mode === "sign-in" ? "Раді бачити знову." : "Створіть свій простір."}</h1><p>{mode === "sign-in" ? "Увійдіть до тендерного кабінету." : "Збережені перевірки, документи й рішення — в одному місці."}</p></div></header>

    {googleEnabled ? <a className="auth-google" href={googleHref}><span>G</span> Продовжити з Google <ArrowRight size={16} /></a> : <button className="auth-google" type="button" disabled><span>G</span> Google тимчасово недоступний</button>}
    <div className="auth-divider"><span>або</span></div>

    {mode === "sign-in" ? <form className="auth-form" onSubmit={signIn}>
      <label>Пошта або номер телефону<input name="identifier" autoComplete="username" placeholder="name@company.ua або +380…" required /></label>
      <PasswordField name="password" label="Пароль" autoComplete="current-password" show={showPassword} toggle={() => setShowPassword((value) => !value)} />
      <button className="button button--primary button--full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Перевіряємо</> : <>Увійти <ArrowRight size={17} /></>}</button>
    </form> : <>
      <div className="auth-methods" role="tablist" aria-label="Спосіб реєстрації">
        <button type="button" role="tab" aria-selected={channel === "email"} className={channel === "email" ? "is-active" : ""} onClick={() => { setChannel("email"); setError(""); }}><Mail size={15} /> Пошта</button>
        <button type="button" role="tab" aria-selected={channel === "phone"} className={channel === "phone" ? "is-active" : ""} onClick={() => { setChannel("phone"); setError(""); }}><Phone size={15} /> Телефон</button>
      </div>
      {channel === "email" ? <form className="auth-form" onSubmit={registerEmail}>
        <label>Ім’я<input name="displayName" autoComplete="name" placeholder="Як до вас звертатися" minLength={2} maxLength={80} required /></label>
        <label>Робоча пошта<input name="email" type="email" autoComplete="email" placeholder="name@company.ua" required /></label>
        <PasswordField name="password" label="Пароль" autoComplete="new-password" show={showPassword} toggle={() => setShowPassword((value) => !value)} />
        <PasswordField name="confirmPassword" label="Повторіть пароль" autoComplete="new-password" show={showPassword} />
        <p className="auth-form__hint"><KeyRound size={13} /> Щонайменше 10 символів, літера та цифра.</p>
        <button className="button button--primary button--full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Створюємо</> : <>Створити кабінет <ArrowRight size={17} /></>}</button>
      </form> : phoneStep === "details" ? <form className="auth-form" onSubmit={requestPhoneCode}>
        <label>Ім’я<input name="displayName" autoComplete="name" placeholder="Як до вас звертатися" minLength={2} maxLength={80} required /></label>
        <label>Номер телефону<input name="phone" type="tel" autoComplete="tel" defaultValue="+380" placeholder="+380…" required /></label>
        <PasswordField name="password" label="Пароль" autoComplete="new-password" show={showPassword} toggle={() => setShowPassword((value) => !value)} />
        <PasswordField name="confirmPassword" label="Повторіть пароль" autoComplete="new-password" show={showPassword} />
        <button className="button button--primary button--full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Надсилаємо</> : <>Отримати SMS-код <ArrowRight size={17} /></>}</button>
      </form> : <form className="auth-form auth-form--code" onSubmit={verifyPhone}>
        <p>Код надіслано на <b>{phoneDraft.phone}</b></p>
        <label>Код підтвердження<input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" minLength={4} maxLength={10} required autoFocus /></label>
        <button className="button button--primary button--full" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Перевіряємо</> : <>Підтвердити й увійти <ArrowRight size={17} /></>}</button>
        <button className="auth-back" type="button" onClick={() => setPhoneStep("details")}>Змінити номер</button>
      </form>}
    </>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <p className="auth-legal">Продовжуючи, ви погоджуєтеся з <a href="/terms">умовами</a> та <a href="/privacy">політикою конфіденційності</a>.</p>
  </div>;
}

function PasswordField({ name, label, autoComplete, show, toggle }: { name: string; label: string; autoComplete: string; show: boolean; toggle?: () => void }) {
  return <label>{label}<span className="auth-password"><input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} minLength={10} maxLength={128} required />{toggle && <button type="button" onClick={toggle} aria-label={show ? "Приховати пароль" : "Показати пароль"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</span></label>;
}
