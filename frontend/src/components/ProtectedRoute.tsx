import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

type Status = 'loading' | 'authenticated' | 'change-password' | 'mfa-enroll' | 'unauthenticated';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    api
      .me()
      .then((user) => {
        if (!user || user.authenticated === false) return setStatus('unauthenticated');
        if (user.mustChangePassword) return setStatus('change-password');
        if (user.mfaEnrollRequired) return setStatus('mfa-enroll');
        setStatus('authenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (status === 'change-password') return <Navigate to="/trocar-senha" replace />;
  if (status === 'mfa-enroll') return <Navigate to="/mfa/configurar" replace />;
  return <>{children}</>;
}
