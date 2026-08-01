import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { CompanyProfileForm } from "@/components/dashboard/CompanyProfileForm";
import { getCompanyProfile } from "@/src/infrastructure/storage/repository";

export const dynamic = "force-dynamic";
export default async function CompanyPage() { const user = await requireChatGPTUser("/dashboard/company"); const profile = await getCompanyProfile(user.userId); return <><div className="dashboard-heading"><div><span className="section-kicker">Профіль компанії</span><h1>Контекст для точніших рішень.</h1><p>Додайте лише те, що можна зіставити з вимогами закупівлі.</p></div></div><CompanyProfileForm initialProfile={profile} /></>; }
