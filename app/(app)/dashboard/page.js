'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, STATUSES } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import { PageHeader, Stat, ScoreBadge, Empty, Alert } from '@/components/ui';

export default function Dashboard() {
  const { user, profileCompleted } = useSession();
  const { data: stats } = useSWR('/jobs/stats', fetcher);
  const { data: top } = useSWR(profileCompleted ? '/jobs?status=new&sort=score&limit=5' : null, fetcher);
  const { data: admin } = useSWR(user.role === 'admin' ? '/admin/stats' : null, fetcher);
  const c = stats?.counts || {};

  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} subtitle="Here's where your job search stands.">
        <Link href="/jobs" className="btn-primary">
          Browse jobs
        </Link>
      </PageHeader>

      {!profileCompleted && (
        <div className="mb-6">
          <Alert kind="info">
            Your profile isn&apos;t set up yet, so there are no matches.{' '}
            <Link href="/profile" className="font-medium underline">
              Complete your profile
            </Link>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Matches" value={stats?.total} hint={stats ? `${stats.newThisWeek} new this week` : ''} />
        <Stat label="To review" value={c.new} />
        <Stat label="Applied" value={stats && c.applied + c.interview + c.offer} hint={stats ? `${c.interview} interview · ${c.offer} offer` : ''} />
        <Stat label="Saved" value={c.saved} />
      </div>

      {stats && stats.total > 0 && (
        <div className="card mt-6 p-4">
          <div className="mb-2 text-sm font-medium text-slate-700">Pipeline</div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {STATUSES.map((s) =>
              c[s.value] ? <div key={s.value} className={s.cls.split(' ')[0]} style={{ width: `${(c[s.value] / stats.total) * 100}%` }} title={`${s.label}: ${c[s.value]}`} /> : null
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
            {STATUSES.map((s) => (
              <Link key={s.value} href={`/jobs?status=${s.value}`} className="flex items-center gap-1.5 hover:underline">
                <span className={`h-2.5 w-2.5 rounded-full ${s.cls.split(' ')[0]}`} />
                {s.label} {c[s.value] || 0}
              </Link>
            ))}
          </div>
        </div>
      )}

      {profileCompleted && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Top new matches</h2>
          {top?.items?.length ? (
            <div className="card divide-y divide-slate-100">
              {top.items.map((it) => (
                <Link key={it._id} href={`/jobs?q=${encodeURIComponent(it.job.title)}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                  <ScoreBadge score={it.score} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{it.job.title}</div>
                    <div className="truncate text-sm text-slate-500">
                      {it.job.company} · {it.job.location || 'Remote'} · {it.job.sourceLabel}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            top && (
              <Empty title="Nothing new to review">
                Run a <Link href="/jobs?mode=live" className="text-brand-600 underline">live search</Link> to check the boards for fresh posts.
              </Empty>
            )
          )}
        </section>
      )}

      {admin && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Platform</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Users" value={admin.users} hint={`${admin.newUsersWeek} new this week`} />
            <Stat label="Active users" value={admin.active} hint={`${admin.admins} admin(s)`} />
            <Stat label="Jobs in pool" value={admin.jobs} />
            <Stat label="Applications tracked" value={admin.applied} />
          </div>
        </section>
      )}
    </>
  );
}
