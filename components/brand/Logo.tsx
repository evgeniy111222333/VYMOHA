import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Вимога — на головну">
      <span className="brand__mark" aria-hidden="true"><span className="brand__monogram">V</span><i /></span>
      {!compact && <span className="brand__word">ВИМ<em>О</em>ГА</span>}
    </Link>
  );
}
