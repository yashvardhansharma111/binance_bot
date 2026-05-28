'use client';
import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'SessionInvalidated') {
      signOut({ callbackUrl: window.location.origin + '/login?reason=session_expired' });
    }
  }, [session]);

  return null;
}
