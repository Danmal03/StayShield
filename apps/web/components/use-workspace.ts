'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { Account, Workspace } from '../lib/types';

export function useWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [message, setMessage] = useState('Loading your secure session…');

  const load = useCallback(async () => {
    try {
      const me = await api('/auth/me');
      if (me.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (!me.ok) throw new Error('account');
      const account = (await me.json()) as Account;
      const response = await api('/operations/workspace');
      if (response.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (!response.ok) throw new Error('workspace');
      setUser(account);
      setWorkspace((await response.json()) as Workspace);
      setMessage('');
    } catch {
      setMessage('StayShield could not load your account. Check that the API is running and retry.');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    const response = await api('/auth/logout', { method: 'POST' });
    if (response.ok || response.status === 204) router.replace('/auth/login');
    else setMessage('Sign out failed. Please retry.');
  }

  return { user, workspace, message, logout, reload: load };
}
