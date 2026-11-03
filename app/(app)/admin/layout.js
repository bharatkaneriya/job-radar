'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/AppShell';

// The API enforces the admin role; this just keeps non-admins off these screens.
export default function AdminLayout({ children }) {
  const { user } = useSession();
  const router = useRouter();
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!isAdmin) router.replace('/dashboard');
  }, [isAdmin, router]);

  return isAdmin ? children : null;
}
