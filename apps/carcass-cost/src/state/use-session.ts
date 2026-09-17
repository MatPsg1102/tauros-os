// Sessão da nuvem (P-0001). Fica em `checking` enquanto o supabase-js restaura
// a sessão persistida: nesse intervalo o histórico continua local, sem piscar.
// Sem nuvem (auth null) o status é `unavailable` e nada mais acontece.

import { useEffect, useState } from 'react';

import { CLOUD_UNAVAILABLE_MESSAGE, type CloudAuth, type CloudSession } from './cloud.js';

export type CloudSessionStatus = 'unavailable' | 'checking' | 'signed-out' | 'signed-in';

export interface CloudSessionController {
  readonly status: CloudSessionStatus;
  readonly email: string | null;
  readonly error: string | null;
  readonly pending: boolean;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
}

export function useCloudSession(auth: CloudAuth | null): CloudSessionController {
  const [status, setStatus] = useState<CloudSessionStatus>(
    auth === null ? 'unavailable' : 'checking',
  );
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (auth === null) {
      setStatus('unavailable');
      setEmail(null);
      return undefined;
    }
    let active = true;
    const apply = (session: CloudSession | null): void => {
      if (!active) return;
      setEmail(session?.email ?? null);
      setStatus(session === null ? 'signed-out' : 'signed-in');
    };
    const unsubscribe = auth.onChange(apply);
    void auth.getSession().then(apply, () => {
      apply(null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  return {
    status,
    email,
    error,
    pending,
    signIn: async (userEmail, password) => {
      if (auth === null) return;
      setPending(true);
      setError(null);
      try {
        const message = await auth.signIn(userEmail, password);
        setError(message);
        if (message === null) {
          const session = await auth.getSession();
          setEmail(session?.email ?? null);
          setStatus(session === null ? 'signed-out' : 'signed-in');
        }
      } catch {
        setError(CLOUD_UNAVAILABLE_MESSAGE);
      } finally {
        setPending(false);
      }
    },
    signOut: async () => {
      if (auth === null) return;
      setPending(true);
      setError(null);
      try {
        await auth.signOut();
        setEmail(null);
        setStatus('signed-out');
      } catch {
        setError(CLOUD_UNAVAILABLE_MESSAGE);
      } finally {
        setPending(false);
      }
    },
  };
}
