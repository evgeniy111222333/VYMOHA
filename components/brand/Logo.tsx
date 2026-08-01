import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Вимога — на головну">
      <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
      {!compact && <span className="brand__word">вимога</span>}
    </Link>
  );
}
