'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/operations-api';
import { StaffPortalOverview } from '../../lib/types';
import { StaffNetworkPanel } from './staff-network-panel';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function deviceAttention(status: string) {
  return ['attention', 'blocked', 'failed', 'non_compliant', 'not_protected', 'quarantined', 'unencrypted'].includes(status.toLowerCase());
}

function StatusIcon({ type }: { type: 'shield' | 'devices' | 'network' | 'bell' }) {
  const content = {
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    devices: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    network: <><circle cx="12" cy="12" r="2" /><path d="M5 9a10 10 0 0 1 14 0M2 6a15 15 0 0 1 20 0m-17 6a10 10 0 0 0 14 0" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  }[type];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{content}</svg>;
}

export function StaffPortalDashboard() {
  const [data, setData] = useState<StaffPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <p className="notice staff-loading">Loading your personal security information…</p>;
  if (!data) {
    return (
      <div className="notice notice-error staff-dashboard-error" role="alert">
        <span>{error || 'Your portal data could not be loaded.'}</span>
        <button className="button secondary" onClick={() => void load()} type="button">Retry</button>
      </div>
    );
  }

  const firstName = data.profile.displayName.trim().split(/\s+/)[0] || 'there';
  const pendingDevices = data.devices.filter((device) => device.status.toLowerCase() === 'pending').length;
  const devicesNeedingAttention = data.devices.filter((device) =>
    [device.endpointProtectionStatus, device.encryptionStatus, device.complianceStatus]
      .some(deviceAttention),
  ).length;
  const completedTraining = data.trainingAssignments.filter((assignment) => assignment.completion?.passed).length;
  const trainingTotal = data.trainingAssignments.length;
  const unreadNotifications = data.summary.unreadNotifications;
  const securityScore = data.securityScore?.score;
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="staff-dashboard">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <section className="staff-hero">
        <div className="staff-hero-copy">
          <p className="eyebrow">YOUR PERSONAL SECURITY SPACE</p>
          <h2>{salutation}, {firstName}</h2>
          <p>A clear view of your security essentials, helpful resources, and anything that needs your attention.</p>
          <div className="staff-hero-profile">
            <span className="staff-avatar staff-avatar-large" aria-hidden="true">{initials(data.profile.displayName) || 'SS'}</span>
            <span><strong>{data.profile.displayName}</strong><small>{[data.profile.jobTitle, data.profile.department?.name].filter(Boolean).join(' · ') || 'StayShield team member'}</small></span>
            <span className="staff-signed-in"><i aria-hidden="true" /> Signed in</span>
          </div>
        </div>
        <div className="staff-hero-art" aria-hidden="true">
          <div className="staff-hero-orbit"><StatusIcon type="shield" /></div>
          <span className="staff-orbit-dot staff-orbit-dot-one" />
          <span className="staff-orbit-dot staff-orbit-dot-two" />
        </div>
      </section>

      <section className="staff-summary-grid" aria-label="Your security overview">
        <Link className="staff-summary-card" href="/app/account">
          <span className="staff-summary-icon staff-icon-gold"><StatusIcon type="shield" /></span>
          <span className="staff-card-title">Account security</span>
          <strong className="staff-summary-value staff-value-attention">Action to consider</strong>
          <small>MFA is not configured for this account</small>
          <span className="staff-card-link">Review account <b aria-hidden="true">→</b></span>
        </Link>
        <Link className="staff-summary-card" href="/app/devices">
          <span className="staff-summary-icon staff-icon-teal"><StatusIcon type="devices" /></span>
          <span className="staff-card-title">My devices</span>
          <strong className="staff-summary-value">{data.summary.registeredDevices} registered</strong>
          <small>{pendingDevices} awaiting review{devicesNeedingAttention ? ` · ${devicesNeedingAttention} need attention` : ''}</small>
          <span className="staff-card-link">Manage devices <b aria-hidden="true">→</b></span>
        </Link>
        <StaffNetworkPanel compact />
        <Link className="staff-summary-card" href="/app/notifications">
          <span className="staff-summary-icon staff-icon-slate"><StatusIcon type="bell" /></span>
          <span className="staff-card-title">Notifications &amp; actions</span>
          <strong className="staff-summary-value">{unreadNotifications} unread</strong>
          <small>{data.summary.pendingRequests} requests in progress</small>
          <span className="staff-card-link">View updates <b aria-hidden="true">→</b></span>
        </Link>
      </section>

      <section className="staff-posture-panel">
        <div className="staff-posture-intro">
          <p className="eyebrow">PERSONAL SECURITY</p>
          <h2>Your security status</h2>
          <p>Understand the protections in place and the information available to StayShield.</p>
          {securityScore !== undefined ? (
            <div className="staff-score-wrap">
              <div className="staff-score-ring" role="img" aria-label={`Security score ${securityScore} out of 100`} style={{ '--score': `${Math.max(0, Math.min(100, securityScore))}%` } as React.CSSProperties}>
                <span>{securityScore}<small>/100</small></span>
              </div>
              <span><strong>Security score</strong><small>Based on your latest configured assessment</small><small>Updated {new Date(data.securityScore!.calculatedAt).toLocaleDateString()}</small></span>
            </div>
          ) : (
            <div className="staff-score-unavailable"><span>—</span><strong>Score not available</strong><small>No security assessment has been configured.</small></div>
          )}
        </div>
        <div className="staff-posture-checks">
          <div className="staff-posture-status"><span className="staff-status-dot staff-dot-warning" /><span><strong>Attention recommended</strong><small>Your account uses a local password. MFA is not configured.</small></span></div>
          <ul>
            <li><span>Multi-factor authentication</span><b className="staff-check-warn">Not configured</b></li>
            <li><span>Registered devices</span><b>{data.summary.registeredDevices} registered</b></li>
            <li><span>Device compliance</span><b>{devicesNeedingAttention ? `${devicesNeedingAttention} need review` : data.devices.length && data.devices.every((device) => device.complianceStatus.toLowerCase() === 'compliant') ? 'Compliant' : data.devices.some((device) => !['unknown', 'pending', 'not_available'].includes(device.complianceStatus.toLowerCase())) ? 'Status recorded' : 'Not available'}</b></li>
            <li><span>Security training</span><b>{trainingTotal ? `${completedTraining} of ${trainingTotal} complete` : 'Not assigned'}</b></li>
          </ul>
          <p className="staff-data-disclaimer">Details are based on information currently available in your account. Endpoint provider data is not connected.</p>
        </div>
      </section>

      <div className="staff-dashboard-lower">
        <section className="content-panel staff-dashboard-panel">
          <div className="panel-heading"><div><p className="eyebrow">LATEST UPDATES</p><h2>Security announcements</h2></div><Link href="/app/notifications">All notifications</Link></div>
          {data.announcements.length ? (
            <ul className="portal-list">
              {data.announcements.slice(0, 4).map((announcement) => (
                <li key={announcement.id}><strong>{announcement.title}</strong><p>{announcement.body}</p><small>{new Date(announcement.createdAt).toLocaleString()}</small></li>
              ))}
            </ul>
          ) : <p className="empty-state">There are no announcements for your account.</p>}
        </section>
        <section className="content-panel staff-dashboard-panel">
          <div className="panel-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>What would you like to do?</h2></div></div>
          <div className="staff-quick-links">
            <Link href="/app/security-centre"><span className="staff-quick-icon"><StatusIcon type="shield" /></span><span><strong>Report a security concern</strong><small>Phishing, lost device, or suspicious activity</small></span><b aria-hidden="true">→</b></Link>
            <Link href="/app/web-access"><span className="staff-quick-icon"><StatusIcon type="network" /></span><span><strong>Request website access</strong><small>Ask for access needed for your work</small></span><b aria-hidden="true">→</b></Link>
            <Link href="/app/requests"><span className="staff-quick-icon"><StatusIcon type="devices" /></span><span><strong>Get help from IT</strong><small>Review a request or ask for support</small></span><b aria-hidden="true">→</b></Link>
          </div>
        </section>
      </div>
      <p className="privacy-note staff-privacy-note">Network, website filtering, and endpoint protection details appear only when supplied by connected providers. StayShield does not monitor private messages or keystrokes.</p>
    </div>
  );
}
