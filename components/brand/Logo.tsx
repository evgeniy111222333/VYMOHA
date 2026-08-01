import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Вимога — на головну">
      <span className="brand__mark" aria-hidden="true"><Image src="/brand-mark-v2.png" alt="" width={512} height={512} priority unoptimized /></span>
      {!compact && <span className="brand__word">вимога<i>•</i></span>}
    </Link>
  );
}
