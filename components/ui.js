import { statusMeta } from '@/lib/api';

export function StatusBadge({ status }) {
  const m = statusMeta(status);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

export function ScoreBadge({ score }) {
  const cls = score >= 30 ? 'bg-emerald-600 text-white' : score >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700';
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold ${cls}`} title="Match score: 30+ strong, 20–29 worth a look">
      {score}
    </span>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const cls = { error: 'border-red-200 bg-red-50 text-red-700', success: 'border-emerald-200 bg-emerald-50 text-emerald-700', info: 'border-sky-200 bg-sky-50 text-sky-800' }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="Loading" />;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value ?? '—'}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card px-6 py-12 text-center">
      <div className="font-medium text-slate-800">{title}</div>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}
