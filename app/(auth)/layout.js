import Logo from '@/components/Logo';

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      {children}
    </div>
  );
}
