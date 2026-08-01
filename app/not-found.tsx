import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return <main className="not-found"><Logo /><div><span className="mono">404 / НЕ ЗНАЙДЕНО</span><h1>Цієї сторінки<br />немає у вимогах.</h1><p>Поверніться до аналізатора або перевірте адресу.</p><Link className="button button--primary" href="/"><ArrowLeft size={16} /> На головну</Link></div></main>;
}
