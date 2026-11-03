'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher, qs, STATUSES } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import JobCard from '@/components/JobCard';
import Pagination from '@/components/Pagination';
import { PageHeader, Alert, Empty, Spinner } from '@/components/ui';

const TABS = [{ value: 'active', label: 'All active' }, ...STATUSES, { value: 'all', label: 'Everything' }];
const SOURCES = [
  ['', 'All sources'],
  ['remotive', 'Remotive'],
  ['jobicy', 'Jobicy'],
  ['himalayas', 'Himalayas'],
  ['arbeitnow', 'Arbeitnow'],
  ['weworkremotely', 'We Work Remotely'],
  ['hackernews', 'HN Who is hiring'],
];

function JobsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { profileCompleted } = useSession();

  const filters = {
    status: params.get('status') || 'active',
    q: params.get('q') || '',
    source: params.get('source') || '',
    sort: params.get('sort') || 'score',
    page: Number(params.get('page')) || 1,
  };
  const setFilters = (patch) => {
    const next = { ...filters, page: 1, ...patch };
    router.replace(`${pathname}${qs({ ...next, status: next.status === 'active' ? '' : next.status, sort: next.sort === 'score' ? '' : next.sort, page: next.page > 1 ? next.page : '' })}`, { scroll: false });
  };

  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);

  const key = profileCompleted ? `/jobs${qs(filters)}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { keepPreviousData: true });

  const [live, setLive] = useState({ busy: false, result: null, error: '' });
  const runLive = async () => {
    setLive({ busy: true, result: null, error: '' });
    try {
      const res = await api(`/jobs/search${qs(filters)}`, { method: 'POST' });
      mutate(res, { revalidate: false });
      setLive({ busy: false, result: res.live, error: '' });
    } catch (err) {
      setLive({ busy: false, result: null, error: err.message });
    }
  };
  // /jobs?mode=live (from the dashboard) starts a live search once.
  const autoLive = params.get('mode') === 'live';
  useEffect(() => {
    if (autoLive && profileCompleted) {
      setFilters({ mode: '' });
      runLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLive, profileCompleted]);

  const onCardChange = (updated) => {
    mutate((d) => d && { ...d, items: d.items.map((i) => (i._id === updated._id ? updated : i)) }, { revalidate: false });
  };

  if (!profileCompleted) {
    return (
      <>
        <PageHeader title="Jobs" />
        <Empty title="Set up your profile first">
          Your matches are scored against your skills.{' '}
          <Link href="/profile" className="text-brand-600 underline">
            Go to profile
          </Link>
        </Empty>
      </>
    );
  }

  const lr = live.result;
  const sourceErrors = lr?.sources?.filter((s) => s.error) || [];

  return (
    <>
      <PageHeader title="Jobs" subtitle="Your stored matches. Use live search to check the boards for new posts.">
        <button className="btn-primary" onClick={runLive} disabled={live.busy}>
          {live.busy ? (
            <>
              <Spinner className="h-4 w-4" /> Searching boards…
            </>
          ) : (
            '⟳ Live search'
          )}
        </button>
      </PageHeader>

      {live.error && <div className="mb-4"><Alert>{live.error}</Alert></div>}
      {lr && (
        <div className="mb-4">
          <Alert kind={lr.throttled ? 'info' : 'success'}>
            {lr.throttled
              ? `Showing your latest matches. You can search the boards again in ${Math.ceil(lr.retryInSec / 60)} min.`
              : `Checked ${lr.sources.filter((s) => !s.skipped && !s.error).length} board(s)` +
                (lr.sources.some((s) => s.skipped) ? ` (${lr.sources.filter((s) => s.skipped).length} checked recently, reused)` : '') +
                `. ${lr.match.added} new match${lr.match.added === 1 ? '' : 'es'}.`}
            {sourceErrors.length > 0 && <> Couldn&apos;t reach: {sourceErrors.map((s) => s.source).join(', ')}.</>}
          </Alert>
        </div>
      )}

      <div className="card mb-4 p-3">
        <div className="flex flex-wrap gap-2">
          <form
            className="flex min-w-60 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ q: search.trim() });
            }}
          >
            <input className="input" placeholder="Search title, company, location, skills…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-secondary">Search</button>
          </form>
          <select className="input w-auto" value={filters.source} onChange={(e) => setFilters({ source: e.target.value })} aria-label="Source">
            {SOURCES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })} aria-label="Sort">
            <option value="score">Best match</option>
            <option value="date">Newest post</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilters({ status: t.value })}
              className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium ${filters.status === t.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error.message}</Alert>}
      {isLoading && !data && (
        <div className="py-12 text-center text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {data && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {data.total} job{data.total === 1 ? '' : 's'}
            {filters.q && <> matching &ldquo;{filters.q}&rdquo;</>}
          </p>
          {data.items.length ? (
            <div className="space-y-3">
              {data.items.map((it) => (
                <JobCard key={it._id} item={it} onChange={onCardChange} />
              ))}
            </div>
          ) : (
            <Empty title="No jobs here">
              {filters.q || filters.source || filters.status !== 'active' ? 'Try clearing the filters, or run a live search.' : 'Run a live search to pull the latest posts, or lower your minimum score in your profile.'}
            </Empty>
          )}
          <Pagination page={data.page} pages={data.pages} onPage={(page) => setFilters({ page })} />
        </>
      )}
    </>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsInner />
    </Suspense>
  );
}
