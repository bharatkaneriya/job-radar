'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, qs, timeAgo } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import Pagination from '@/components/Pagination';
import { PageHeader, Stat, Alert, Spinner, Empty } from '@/components/ui';

function UserDrawer({ id, onClose }) {
  const { data } = useSWR(`/admin/users/${id}`, fetcher);
  const p = data?.profile;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{data?.user.name || 'User'}</h2>
          <button className="btn-secondary btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {!data ? (
          <Spinner className="mt-6 h-6 w-6 text-slate-400" />
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
              <dt className="text-slate-500">Email</dt>
              <dd className="break-all">{data.user.email}</dd>
              <dt className="text-slate-500">Sign-in</dt>
              <dd>{[data.user.hasPassword && 'Password', data.user.google && 'Google'].filter(Boolean).join(' + ') || '—'}</dd>
              <dt className="text-slate-500">Joined</dt>
              <dd>{new Date(data.user.createdAt).toLocaleDateString()}</dd>
              <dt className="text-slate-500">Last login</dt>
              <dd>{data.user.lastLoginAt ? timeAgo(data.user.lastLoginAt) : 'never'}</dd>
            </dl>
            <div>
              <div className="mb-1.5 font-medium text-slate-700">Jobs by status</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.counts).length ? Object.entries(data.counts).map(([s, n]) => <span key={s} className="chip">{s}: {n}</span>) : <span className="text-slate-500">No matches yet</span>}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-medium text-slate-700">Profile {p?.completed ? '' : '(not completed)'}</div>
              {p?.headline && <p className="mb-2 text-slate-600">{p.headline}</p>}
              <div className="flex flex-wrap gap-1.5">
                {p?.skills?.map((s) => (
                  <span key={s.name} className="chip">
                    {s.name} · {s.weight}
                  </span>
                ))}
              </div>
              {p?.preferences?.preferredLocations?.length > 0 && <p className="mt-2 text-slate-600">Locations: {p.preferences.preferredLocations.join(', ')}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: me } = useSession();
  const [filters, setFilters] = useState({ q: '', role: '', status: '', page: 1 });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const { data, mutate } = useSWR(`/admin/users${qs(filters)}`, fetcher, { keepPreviousData: true });
  const { data: stats, mutate: mutateStats } = useSWR('/admin/stats', fetcher);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      mutate();
      mutateStats();
    } catch (err) {
      setError(err.message);
    }
  };
  const patch = (u, body) => act(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body }));
  const remove = (u) => {
    if (confirm(`Delete ${u.email} and all their saved jobs? This can't be undone.`)) act(() => api(`/admin/users/${u.id}`, { method: 'DELETE' }));
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, roles and access." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total users" value={stats?.users} hint={stats && `${stats.newUsersWeek} new this week`} />
        <Stat label="Active" value={stats?.active} />
        <Stat label="Admins" value={stats?.admins} />
        <Stat label="Applications tracked" value={stats?.applied} />
      </div>

      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        <form
          className="flex min-w-60 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({ ...filters, q: search.trim(), page: 1 });
          }}
        >
          <input className="input" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-secondary">Search</button>
        </form>
        <select className="input w-auto" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })} aria-label="Role">
          <option value="">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!data ? (
        <Spinner className="h-6 w-6 text-slate-400" />
      ) : data.items.length === 0 ? (
        <Empty title="No users found" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button className="cursor-pointer text-left" onClick={() => setOpen(u.id)}>
                        <div className="font-medium text-slate-900 hover:underline">
                          {u.name} {self && <span className="text-xs text-slate-400">(you)</span>}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select className="input w-auto py-1" value={u.role} disabled={self} onChange={(e) => patch(u, { role: e.target.value })} aria-label="Role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3">{u.matches}</td>
                    <td className="px-4 py-3">{u.applied}</td>
                    <td className="px-4 py-3 text-slate-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</td>
                    <td className="px-4 py-3">
                      {!self && (
                        <div className="flex justify-end gap-2">
                          <button className="btn-secondary btn-sm" onClick={() => patch(u, { status: u.status === 'active' ? 'disabled' : 'active' })}>
                            {u.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => remove(u)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={(page) => setFilters({ ...filters, page })} />}
      {open && <UserDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
