'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import Logo from './Logo';
import { Spinner } from './ui';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

const icon = (d) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const USER_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: icon('M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10') },
  { href: '/jobs', label: 'Jobs', icon: icon('M4 7h16v12H4zM9 7V5h6v2') },
  { href: '/profile', label: 'Profile', icon: icon('M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 4-6 8-6s8 2 8 6') },
];
const ADMIN_NAV = [
  { href: '/admin/users', label: 'Users', icon: icon('M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8') },
  { href: '/admin/sources', label: 'Sources', icon: icon('M4 11a9 9 0 019 9M4 4a16 16 0 0116 16M5 19a1 1 0 100-2 1 1 0 000 2z') },
];

function NavLinks({ items, pathname, onClick }) {
  return items.map((it) => {
    const active = pathname === it.href || pathname.startsWith(it.href + '/');
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={onClick}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        {it.icon}
        {it.label}
      </Link>
    );
  });
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, error, mutate } = useSWR('/auth/me', fetcher, { revalidateOnFocus: true, shouldRetryOnError: false });

  useEffect(() => {
    if (error?.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [error, pathname, router]);

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        {error && error.status !== 401 ? <p className="text-sm text-red-600">Could not reach the server: {error.message}</p> : <Spinner className="h-8 w-8" />}
      </div>
    );
  }

  const { user } = data;
  const isAdmin = user.role === 'admin';
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  const sidebar = (
    <nav className="flex flex-col gap-1">
      <NavLinks items={USER_NAV} pathname={pathname} onClick={() => setMenuOpen(false)} />
      {isAdmin && (
        <>
          <div className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Admin</div>
          <NavLinks items={ADMIN_NAV} pathname={pathname} onClick={() => setMenuOpen(false)} />
        </>
      )}
    </nav>
  );

  return (
    <SessionContext.Provider value={{ ...data, refresh: mutate }}>
      <div className="min-h-screen md:flex">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
          <div className="mb-6 px-2">
            <Logo href="/dashboard" />
          </div>
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
            <div className="flex items-center gap-3 md:hidden">
              <button className="btn-secondary btn-sm" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
                ☰
              </button>
              <Logo href="/dashboard" />
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-500">
                  {user.email}
                  {isAdmin && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase">admin</span>}
                </div>
              </div>
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{user.name[0]?.toUpperCase()}</span>
              )}
              <button className="btn-secondary btn-sm" onClick={logout}>
                Log out
              </button>
            </div>
          </header>
          {menuOpen && <div className="border-b border-slate-200 bg-white p-3 md:hidden">{sidebar}</div>}
          <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
