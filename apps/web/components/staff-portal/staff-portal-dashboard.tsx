'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/operations-api';
import { StaffPortalOverview } from '../../lib/types';
import { useConsoleContext } from '../console-provider';

type BrowserNetworkInformation = EventTarget & { readonly type?: string };
type NavigatorWithNetworkInformation = Navigator & {
  readonly connection?: BrowserNetworkInformation;
};

export function StaffPortalDashboard() {
  const { user } = useConsoleContext();
  const [data, setData] = useState<StaffPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState('');

  useEffect(() => {
    const connection = (navigator as NavigatorWithNetworkInformation).connection;
    const updateConnection = () => {
      setIsOnline(navigator.onLine);
      setConnectionType(connection?.type?.toLowerCase() ?? '');
    };

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    connection?.addEventListener('change', updateConnection);

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
      connection?.removeEventListener('change', updateConnection);
    };
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setData(await apiJson<StaffPortalOverview>('/staff-portal/overview'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your employee portal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="notice">Loading your personal security information…</p>;
  if (!data) {
    return (
      <div className="notice notice-error" role="alert">
        <span>{error || 'Your portal data could not be loaded.'}</span>
        <button className="button secondary" onClick={() => void load()} type="button">Retry</button>
      </div>
    );
  }

  const firstName = data.profile.displayName.trim().split(/\s+/)[0] || 'there';
  return (
    <>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <section className="staff-welcome">
        <p className="eyebrow">EMPLOYEE SECURITY PORTAL</p>
        <h2>Welcome, {firstName}</h2>
        <p>{data.profile.jobTitle || 'Team member'}{data.profile.department ? ` · ${data.profile.department.name}` : ''}</p>
        <small>{user?.email}</small>
      </section>

      <section className="staff-metric-grid" aria-label="Your security overview">
        <div className="metric-card"><span>Account security</span><strong>Review</strong><small>Multi-factor authentication is not configured</small></div>
        <div className="metric-card"><span>Registered devices</span><strong>{data.summary.registeredDevices}</strong><small>Approved in StayShield</small></div>
        <div className="metric-card">
          <span>Network connection</span>
          <strong>{isOnline === null ? 'Checking…' : isOnline ? 'Connected' : 'Offline'}</strong>
          <small>
            {isOnline === null
              ? 'Checking your browser connection'
              : !isOnline
                ? 'Your browser reports that this device is offline'
                : connectionType === 'wifi'
                  ? 'Wi-Fi detected; browser access to the network name is restricted'
                  : connectionType
                    ? `${connectionType} connection; Wi-Fi name is not available to websites`
                    : 'Browser reports online; Wi-Fi name is not available to websites'}
          </small>
        </div>
        <div className="metric-card"><span>Assigned training</span><strong>{data.summary.assignedTraining}</strong><small><Link href="/app/training">Open courses</Link></small></div>
        <div className="metric-card"><span>Requests needing attention</span><strong>{data.summary.pendingRequests}</strong><small><Link href="/app/requests">Track requests</Link></small></div>
        <div className="metric-card"><span>Security score</span><strong>{data.securityScore ? `${data.securityScore.score}%` : '—'}</strong><small>{data.securityScore ? 'Based on configured assessment' : 'No assessment configured'}</small></div>
      </section>

      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">LATEST</p><h2>Security announcements</h2></div></div>
        {data.announcements.length ? (
          <ul className="portal-list">
            {data.announcements.slice(0, 4).map((announcement) => (
              <li key={announcement.id}><strong>{announcement.title}</strong><p>{announcement.body}</p><small>{new Date(announcement.createdAt).toLocaleString()}</small></li>
            ))}
          </ul>
        ) : <p className="empty-state">There are no announcements for your account.</p>}
      </section>

      <p className="privacy-note">Network, website filtering, and endpoint protection data appear only when an approved provider is connected. StayShield does not monitor private messages or keystrokes.</p>
    </>
  );
}
