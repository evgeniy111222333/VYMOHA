"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import type { CompanyProfile } from "@/src/domain/tender/types";

type Profile = CompanyProfile & { region?: string };

export function CompanyProfileForm({ initialProfile }: { initialProfile: Profile | null }) {
  const [profile, setProfile] = useState<Profile>(initialProfile ?? { name: "", edrpou: "", region: "", cpvCodes: [], certifications: [], capabilities: [] });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    const response = await fetch("/api/company", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    const payload = await response.json() as { error?: { message?: string } };
    setSaving(false);
    if (!response.ok) return setError(payload.error?.message ?? "Не вдалося зберегти профіль.");
    setSaved(true);
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <section className="dashboard-card"><div className="dashboard-card__heading"><div><span>01</span><h2>Реквізити</h2></div><p>Використовуються лише для зіставлення вимог.</p></div><div className="form-grid"><label><span>Назва компанії</span><input value={profile.name ?? ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required maxLength={160} /></label><label><span>ЄДРПОУ</span><input value={profile.edrpou ?? ""} onChange={(e) => setProfile({ ...profile, edrpou: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" /></label><label className="form-grid__wide"><span>Регіон</span><input value={profile.region ?? ""} onChange={(e) => setProfile({ ...profile, region: e.target.value })} maxLength={100} placeholder="Наприклад, Київ" /></label></div></section>
      <TagEditor number="02" title="CPV-коди" help="Категорії, в яких компанія постачає товари або послуги." values={profile.cpvCodes} placeholder="30200000-1" onChange={(cpvCodes) => setProfile({ ...profile, cpvCodes })} pattern={/^\d{5,8}(?:-\d)?$/} />
      <TagEditor number="03" title="Сертифікати" help="ISO, ліцензії, дозволи та інші підтвердження." values={profile.certifications} placeholder="ISO 9001:2015" onChange={(certifications) => setProfile({ ...profile, certifications })} />
      <TagEditor number="04" title="Можливості" help="Коротко опишіть релевантний досвід, товари та географію поставок." values={profile.capabilities} placeholder="Поставка серверного обладнання по Україні" onChange={(capabilities) => setProfile({ ...profile, capabilities })} />
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="profile-form__actions"><button className="button button--primary" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Зберігаємо</> : saved ? <><Check size={16} /> Збережено</> : "Зберегти профіль"}</button><span>Профіль впливає на майбутні оцінки, але не змінює дані Prozorro.</span></div>
    </form>
  );
}

function TagEditor({ number, title, help, values, placeholder, onChange, pattern }: { number: string; title: string; help: string; values: string[]; placeholder: string; onChange: (values: string[]) => void; pattern?: RegExp }) {
  const [draft, setDraft] = useState("");
  function add() { const value = draft.trim(); if (!value || values.includes(value) || (pattern && !pattern.test(value))) return; onChange([...values, value]); setDraft(""); }
  return <section className="dashboard-card"><div className="dashboard-card__heading"><div><span>{number}</span><h2>{title}</h2></div><p>{help}</p></div><div className="tag-editor"><div>{values.map((value) => <span key={value}>{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Видалити ${value}`}><X size={13} /></button></span>)}</div><label><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} maxLength={180} /><button type="button" onClick={add}><Plus size={16} /> Додати</button></label></div></section>;
}
