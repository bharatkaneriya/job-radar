import Link from 'next/link';

export default function Logo({ href = '/' }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold text-slate-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 12l6-6" strokeLinecap="round" />
        </svg>
      </span>
      Job Radar
    </Link>
  );
}
