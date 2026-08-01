import { Logo } from "@/components/brand/Logo";

export function AuthPageFrame({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><div className="auth-page__brand"><Logo /></div><section className="auth-layout"><aside><span className="section-kicker">ВЛАСНИЙ КАБІНЕТ</span><h2>Ваші рішення.<br /><em>Ваші дані.</em></h2><p>Вхід без стороннього профілю. Перевірки, документи та баланс залишаються у вашому робочому просторі.</p><ul><li>Захищена сесія на 30 днів</li><li>Пароль зберігається лише як криптографічний хеш</li><li>Google, пошта або підтверджений номер</li></ul></aside><div className="auth-layout__panel">{children}</div></section></main>;
}
