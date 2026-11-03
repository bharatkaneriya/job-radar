'use client';

import { useState } from 'react';
import { api, STATUSES, timeAgo } from '@/lib/api';
import { ScoreBadge, StatusBadge, Spinner } from './ui';

export default function JobCard({ item, onChange }) {
  const { job } = item;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = async (patch) => {
    setSaving(true);
    setError('');
    try {
      const res = await api(`/jobs/${item._id}`, { method: 'PATCH', body: patch });
      onChange?.({ ...item, ...res, job });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    setOpen(!open);
    if (!open && !detail) {
      try {
        setDetail(await api(`/jobs/${item._id}`));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <article className={`card p-4 md:p-5 ${item.status === 'skipped' ? 'opacity-60' : ''}`}>
      <div className="flex gap-4">
        <ScoreBadge score={item.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline">
                  {job.title}
                </a>
              </h3>
              <div className="mt-0.5 text-sm text-slate-600">
                {job.company || 'Unknown company'}
                {job.location && <> · {job.location}</>}
              </div>
            </div>
            <StatusBadge status={item.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {job.postedAt && <span>Posted {timeAgo(job.postedAt)}</span>}
            {job.salary && <span>💰 {job.salary}</span>}
            {job.jobType && <span>{job.jobType}</span>}
            <span>
              via{' '}
              <a href={job.sourceHome} target="_blank" rel="noopener noreferrer" className="underline">
                {job.sourceLabel}
              </a>
            </span>
          </div>

          {(item.matched?.length > 0 || item.flags?.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.matched.map((m) => (
                <span key={m} className="chip bg-emerald-50 text-emerald-800">
                  {m}
                </span>
              ))}
              {item.flags.map((f) => (
                <span key={f} className="chip bg-rose-50 text-rose-700">
                  ⚠ {f}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1.5" value={item.status} onChange={(e) => update({ status: e.target.value })} disabled={saving} aria-label="Status">
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm py-2">
              Open post ↗
            </a>
            <button className="btn-secondary btn-sm py-2" onClick={toggle}>
              {open ? 'Hide details' : 'Details & notes'}
            </button>
            {item.status === 'new' && (
              <button className="btn-secondary btn-sm py-2" onClick={() => update({ status: 'skipped' })} disabled={saving}>
                Skip
              </button>
            )}
            {saving && <Spinner className="h-4 w-4 text-slate-400" />}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {open && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className="label" htmlFor={`notes-${item._id}`}>
                  Notes
                </label>
                <textarea id={`notes-${item._id}`} className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contact, salary discussed, follow-up date…" />
                <button className="btn-secondary btn-sm mt-2" disabled={saving || notes === (item.notes || '')} onClick={() => update({ notes })}>
                  Save notes
                </button>
              </div>
              <div>
                <div className="label">Description</div>
                {detail ? (
                  <div className="max-h-96 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">{detail.job?.description || 'No description.'}</div>
                ) : (
                  <Spinner className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
