import Link from 'next/link';
import Logo from './Logo';

export default function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
