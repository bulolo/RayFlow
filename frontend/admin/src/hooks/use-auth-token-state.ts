import { useEffect, useState } from 'react';
import { getToken } from '@/shared/auth/session';

export function useAuthTokenState() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const syncToken = () => setHasToken(Boolean(getToken()));
    syncToken();
    window.addEventListener('storage', syncToken);
    window.addEventListener('rayflow-auth-change', syncToken);
    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('rayflow-auth-change', syncToken);
    };
  }, []);

  return hasToken;
}
