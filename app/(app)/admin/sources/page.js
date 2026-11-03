'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, timeAgo } from '@/lib/api';
import { PageHeader, Alert, Spinner } from '@/components/ui';

export default function AdminSources() {
  const { data, mutate } = useSWR('/admin/sources', fetcher);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({});

  const run = async (label, fn) => {
    setBusy(label);
    setMsg({});
    try {
      setMsg({ ok: await fn() });
      mutate();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy('');
    }
  };

  const toggle = (s) => run(s.name, async () => {
    await api('/admin/sources', { method: 'PUT', body: { [s.name]: { enabled: !s.config.enabled } } });
    return `${s.label} ${s.config.enabled ? 'disabled' : 'enabled'}.`;
  });

  const fetchNow = (force, only) =>
    run(only ? only[0] : 'all', async () => {
      const res = await api('/admin/sources/fetch', { method: 'POST', body: { force, only } });
      const ok = res.sources.filter((s) => !s.error && !s.skipped);
      const failed = res.sources.filter((s) => s.error);
      const skipped = res.sources.filter((s) => s.skipped);
      return [
        `Fetched ${ok.length} source(s), ${ok.reduce((a, s) => a + (s.added || 0), 0)} new posts.`,
        skipped.length && `${skipped.length} skipped (checked recently).`,
        failed.length && `Failed: ${failed.map((s) => s.source).join(', ')}.`,
        res.match && `Re-scored ${res.match.users} user(s), ${res.match.added} new matches.`,
      ]
        .filter(Boolean)
        .join(' ');
    });

  return (
    <>
      <PageHeader title="Sources" subtitle="Job boards are fetched once for everyone, then scored per user. A daily cron also refreshes them.">
        <button className="btn-secondary" onClick={() => fetchNow(false)} disabled={!!busy}>
          Fetch due sources
        </button>
        <button className="btn-primary" onClick={() => fetchNow(true)} disabled={!!busy}>
          {busy === 'all' ? <Spinner className="h-4 w-4" /> : null} Force fetch all
        </button>
      </PageHeader>

      {msg.ok && <div className="mb-4"><Alert kind="success">{msg.ok}</Alert></div>}
      {msg.error && <div className="mb-4"><Alert>{msg.error}</Alert></div>}

      {!data ? (
        <Spinner className="h-6 w-6 text-slate-400" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((s) => {
            const f = s.lastFetch;
            return (
              <div key={s.name} className={`card p-5 ${s.config.enabled ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:underline">
                      {s.label}
                    </a>
                    <div className="text-xs text-slate-500">At most every {s.minIntervalHours}h · {s.jobs} posts in pool</div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-brand-600" checked={!!s.config.enabled} onChange={() => toggle(s)} disabled={!!busy} />
                    Enabled
                  </label>
                </div>
                <div className="mt-3 text-sm">
                  {!f ? (
                    <span className="text-slate-500">Never fetched</span>
                  ) : f.ok ? (
                    <span className="text-emerald-700">
                      ✓ {timeAgo(f.fetchedAt)} · {f.count} posts · {(f.durationMs / 1000).toFixed(1)}s
                    </span>
                  ) : (
                    <span className="text-red-600">
                      ✕ {timeAgo(f.fetchedAt)}: {f.error}
                    </span>
                  )}
                </div>
                <button className="btn-secondary btn-sm mt-3" onClick={() => fetchNow(true, [s.name])} disabled={!!busy}>
                  {busy === s.name ? <Spinner className="h-3 w-3" /> : null} Fetch now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
