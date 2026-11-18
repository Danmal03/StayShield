'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../lib/operations-api';
import {
  CurrentNetworkConnection,
  NetworkConnectionHistoryItem,
  NetworkIntegrationStatus,
} from '../../lib/types';

function NetworkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9a10 10 0 0 1 14 0M2 6a15 15 0 0 1 20 0" /><circle cx="12" cy="12" r="2" /><path d="M12 14v7" />
  </svg>;
}

function connectionTypeLabel(type: string) {
  if (type === 'wifi') return 'Wi-Fi';
  if (type === 'cellular') return 'Cellular / mobile data';
  if (type === 'ethernet') return 'Ethernet';
  return 'Not available';
}

function networkName(connection: NonNullable<CurrentNetworkConnection['connection']>) {
  if (connection.connectionType === 'wifi') return connection.ssid ?? 'SSID not provided by network source';
  if (connection.connectionType === 'cellular') return connection.carrierName ?? 'Carrier not available';
  if (connection.connectionType === 'ethernet') return 'Ethernet';
  return 'Not available';
}

function statusLabel(status: CurrentNetworkConnection['status']) {
  if (status === 'connected') return 'Connected';
  if (status === 'disconnected') return 'Disconnected';
  if (status === 'unverified') return 'Connection status unverified';
  return 'Monitoring not configured';
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

function duration(start: string | null, end: string | null) {
  if (!start) return 'Not available';
  const milliseconds = Math.max(0, new Date(end ?? Date.now()).getTime() - new Date(start).getTime());
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

export function StaffNetworkPanel({ compact = false }: { compact?: boolean }) {
  const [current, setCurrent] = useState<CurrentNetworkConnection | null>(null);
  const [integration, setIntegration] = useState<NetworkIntegrationStatus | null>(null);
  const [history, setHistory] = useState<NetworkConnectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [currentConnection, integrationStatus, records] = await Promise.all([
        apiJson<CurrentNetworkConnection>('/staff-portal/network/current'),
        apiJson<NetworkIntegrationStatus>('/staff-portal/network/status'),
        compact
          ? Promise.resolve([])
          : apiJson<NetworkConnectionHistoryItem[]>('/staff-portal/network/history'),
      ]);
      setCurrent(currentConnection);
      setIntegration(integrationStatus);
      if (!compact) setHistory(records);
      setError('');
    } catch (loadError) {
      setCurrent(null);
      setIntegration(null);
      setHistory([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load network connection details.');
    } finally {
      setLoading(false);
    }
  }, [compact]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (compact) {
    return (
      <Link className="staff-summary-card staff-live-network-card" href="/app/activity" aria-label="View current network connection and history">
        <span className="staff-summary-icon staff-icon-blue"><NetworkIcon /></span>
        <span className="staff-card-title">Current network connection</span>
        {loading && !current ? <strong className="staff-summary-value">Checking status…</strong> : (
          <>
            <strong className={`staff-summary-value staff-network-state-${current?.status ?? 'unknown'}`}>
              {current?.connection?.source === 'simulation' ? 'Simulated · Connected' : current ? statusLabel(current.status) : 'Status unavailable'}
            </strong>
            <small>{error ? `Connection status unavailable: ${error}` : current?.connection?.source === 'simulation' ? `Development simulation · ${networkName(current.connection)}` : current?.connection ? networkName(current.connection) : current?.status === 'disconnected' ? 'No active network connection' : 'Live details unavailable'}</small>
          </>
        )}
        <span className="staff-card-link">View connection details <b aria-hidden="true">→</b></span>
      </Link>
    );
  }

  return (
    <>
      <section className="content-panel staff-live-network-panel" aria-live="polite">
        <div className="panel-heading">
          <div><p className="eyebrow">CURRENT NETWORK CONNECTION</p><h2>Your network status</h2></div>
          {current && <span className={`staff-network-status staff-network-state-${current.status}`}><i aria-hidden="true" />{current.connection?.source === 'simulation' ? `Simulated · ${statusLabel(current.status)}` : statusLabel(current.status)}</span>}
        </div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {loading && !current ? <p className="empty-state">Checking for a verified network connection…</p> : current?.status === 'connected' && current.connection ? (
          <>
          {current.connection.source === 'simulation' && <div className="integration-notice" role="note"><strong>SIMULATION — DEVELOPMENT ONLY</strong><p>This connection is sample data and does not represent a real device or network.</p></div>}
          <div className="staff-network-details">
            <div><small>Network name</small><strong>{networkName(current.connection)}</strong></div>
            <div><small>Connection type</small><strong>{connectionTypeLabel(current.connection.connectionType)}</strong></div>
            <div><small>IP address</small><strong>{current.connection.ipAddress ?? 'Not available'}</strong></div>
            <div><small>Network segment</small><strong>{current.connection.networkSegment ?? 'Not available'}</strong></div>
            <div><small>Connected since</small><strong>{formatTime(current.connection.connectedAt)}</strong></div>
            <div><small>Last connection update</small><strong>{formatTime(current.connection.lastSeenAt)}</strong></div>
            <div><small>Network security status</small><strong>{current.connection.securityStatus === 'not_available' ? 'Not available' : current.connection.securityStatus}</strong></div>
            {current.connection.accessPoint && <div><small>Access point</small><strong>{current.connection.accessPoint}</strong></div>}
            {current.connection.verificationStatus !== 'verified' && <p>Device identity not verified. This connection is not attributed to your account.</p>}
          </div>
          </>
        ) : current?.status === 'disconnected' ? (
          <div className="integration-notice"><strong>Disconnected</strong><p>Your device is currently not connected to a recognised network.</p></div>
        ) : current?.status === 'unverified' ? (
          <div className="integration-notice"><strong>Connection status unverified</strong><p>StayShield cannot verify a current connection for your account. Check that the device is registered and that the network provider is reporting fresh updates. Previous network details are not shown as active.</p></div>
        ) : (
          <div className="integration-notice"><strong>Network monitoring not configured</strong><p>No Wi-Fi controller, RADIUS, NAC, or managed-device integration is currently reporting connection details. StayShield is not using browser data or sample connections.</p></div>
        )}
        {integration && <p className="staff-network-footnote">
          {integration.status === 'available'
            ? `Provider updates are expected at least every ${integration.freshnessSeconds} seconds.`
            : integration.status === 'unverified'
              ? `Provider data is older than ${integration.freshnessSeconds} seconds.`
              : 'No network integration is configured for this property.'}
          {integration.lastEventAt && ` Last provider update: ${formatTime(integration.lastEventAt)}.`}
        </p>}
      </section>
      <section className="content-panel staff-live-network-panel">
        <div className="panel-heading"><div><p className="eyebrow">PRIVATE ACCOUNT SCOPE</p><h2>My network connection history</h2></div></div>
        {history.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Network</th><th>Connection type</th><th>Connected</th><th>Disconnected</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>{history.map((item) => (
            <tr key={item.id}>
              <td>{item.source === 'simulation' ? 'SIMULATED · ' : ''}{item.connectionType === 'wifi' ? item.ssid ?? 'SSID unavailable' : item.connectionType === 'cellular' ? item.carrierName ?? 'Carrier unavailable' : connectionTypeLabel(item.connectionType)}</td>
              <td>{connectionTypeLabel(item.connectionType)}</td>
              <td>{formatTime(item.connectedAt)}</td>
              <td>{formatTime(item.disconnectedAt)}</td>
              <td>{duration(item.connectedAt, item.disconnectedAt)}</td>
              <td><span className={`status-badge status-${item.status}`}>{statusLabel(item.status === 'connected' ? 'connected' : item.status === 'unverified' ? 'unverified' : 'disconnected')}</span></td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="empty-state">{integration?.configured ? 'There is no verified connection history for your account yet.' : 'Connection history will appear here after a network provider is configured.'}</p>}
        <p className="privacy-note">This history includes verified sessions linked to your account only. Unverified or other employees’ sessions are not shown.</p>
      </section>
    </>
  );
}
