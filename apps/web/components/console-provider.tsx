'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiJson, apiRequest } from '../lib/operations-api';
import { Account, Workspace } from '../lib/types';
import { isAdmin } from '../lib/roles';
import { ConsoleShell } from './console-shell';
import { StaffPortalShell } from './staff-portal/staff-portal-shell';

type ConsoleContextValue = {
  user: Account | null;
  workspace: Workspace | null;
  loading: boolean;
  error: string;
  reloadWorkspace: () => Promise<void>;
  reloadSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkspace = useCallback(async () => {
    setError('');
    try {
      const response = await apiJson<Workspace>('/operations/workspace');
      setWorkspace(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the workspace.');
    }
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest('/auth/me');
      if (response.status === 401) {
        router.replace('/auth/login');
        return;
      }
      const account = await response.json() as Account;
      setUser(account);
      await loadWorkspace();
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        router.replace('/auth/login');
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your secure session.');
    } finally {
      setLoading(false);
    }
  }, [loadWorkspace, router]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const logout = useCallback(async () => {
    try {
      const response = await apiRequest('/auth/logout', { method: 'POST' });
      if (response.status === 204) router.replace('/auth/login');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Sign out failed. Please retry.');
    }
  }, [router]);

  const value = useMemo(() => ({
    user,
    workspace,
    loading,
    error,
    reloadWorkspace: loadWorkspace,
    reloadSession: loadSession,
    logout,
  }), [user, workspace, loading, error, loadWorkspace, loadSession, logout]);

  return (
    <ConsoleContext.Provider value={value}>
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsoleContext(): ConsoleContextValue {
  const context = useContext(ConsoleContext);
  if (!context) throw new Error('useConsoleContext must be used within ConsoleProvider.');
  return context;
}

export function ConsolePage({
  active,
  eyebrow,
  title,
  adminOnly = false,
  networkAdminOnly = false,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  adminOnly?: boolean;
  networkAdminOnly?: boolean;
  children: ReactNode;
}) {
  const { user, workspace, loading, error, reloadWorkspace, reloadSession, logout } =
    useConsoleContext();
  const router = useRouter();
  const admin = Boolean(user && isAdmin(user.roles));
  const networkAdmin = Boolean(user?.roles.includes('NETWORK_ADMINISTRATOR'));

  useEffect(() => {
    if (adminOnly && user && !admin) router.replace('/app/dashboard');
    if (networkAdminOnly && user && !admin && !networkAdmin) router.replace('/app/dashboard');
  }, [admin, adminOnly, networkAdmin, networkAdminOnly, router, user]);

  if (loading && !user) {
    return <main className="console-loading"><p className="notice">Loading your secure workspace…</p></main>;
  }
  if (!user) {
    return (
      <main className="console-loading">
        <p className="notice" role="alert">{error || 'Your session could not be loaded.'}</p>
        <button className="button secondary" onClick={() => void reloadSession()} type="button">Retry</button>
      </main>
    );
  }
  if ((adminOnly && !admin) || (networkAdminOnly && !admin && !networkAdmin)) {
    return <main className="console-loading"><p className="notice">Redirecting to your dashboard…</p></main>;
  }

  if (admin || (networkAdminOnly && networkAdmin)) {
    return (
      <ConsoleShell
        user={user}
        workspace={workspace}
        active={active}
        eyebrow={eyebrow}
        title={title}
        onLogout={logout}
      >
        {error && (
          <div className="notice notice-error" role="alert">
            <span>{error}</span>
            <button className="button secondary" onClick={() => void reloadWorkspace()} type="button">Retry</button>
          </div>
        )}
        {children}
      </ConsoleShell>
    );
  }

  return (
    <StaffPortalShell user={user} active={active} title={title} onLogout={() => void logout()}>
      {error && (
        <div className="notice notice-error" role="alert">
          <span>{error}</span>
          <button className="button secondary" onClick={() => void reloadWorkspace()} type="button">Retry</button>
        </div>
      )}
      {children}
    </StaffPortalShell>
  );
}
