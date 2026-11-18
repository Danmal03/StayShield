'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { NetworkConnection } from '../../lib/types';

type Integration = {
  id: string;
  name: string;
  source: string;
  isEnabled: boolean;
  lastEventAt: string | null;
  createdAt: string;
  status: string;
};

type AdminSession = NetworkConnection & {
  employee: { displayName: string; email: string } | null;
  device: { name: string; deviceType: string } | null;
};

type IssuedCredential = { name: string; source: string; token: string };

function sourceLabel(source: string) {
  if (source === 'simulation') return 'Simulation (development only)';
  return source.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function connectionName(session: AdminSession) {
  if (session.connectionType === 'wifi') return session.ssid ?? 'SSID unavailable';
  if (session.connectionType === 'cellular') return session.carrierName ?? 'Carrier unavailable';
  if (session.connectionType === 'ethernet') return 'Ethernet';
  return 'Not available';
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export function NetworkMonitoringAdmin() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [credential, setCredential] = useState<IssuedCredential | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [integrationList, sessionList] = await Promise.all([
        apiJson<Integration[]>('/staff-portal/network/admin/integrations'),
        apiJson<AdminSession[]>('/staff-portal/network/admin/sessions'),
      ]);
      setIntegrations(integrationList);
      setSessions(sessionList);
    } catch (loadError) {
      setIntegrations([]);
      setSessions([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load network monitoring information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function createIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    setNotice('');
    setCredential(null);
    setCopied(false);
    try {
      const created = await apiJson<{ name: string; source: string; token: string }>(
        '/staff-portal/network/admin/integrations',
        {
          method: 'POST',
          body: JSON.stringify({ name: form.get('name'), source: form.get('source') }),
        },
      );
      setCredential(created);
      setNotice('Integration credential created. Copy it now; it will not be shown again.');
      formElement.reset();
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the network integration.');
    } finally {
      setSaving(false);
    }
  }

  async function disableIntegration(integration: Integration) {
    if (!window.confirm(`Disable ${integration.name}? Provider events using its credential will stop being accepted.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/staff-portal/network/admin/integrations/${integration.id}`, { method: 'DELETE' });
      setNotice(`${integration.name} was disabled.`);
      await load();
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Unable to disable this integration.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCredential() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.token);
      setCopied(true);
      setError('');
    } catch {
      setError('Could not copy the credential. Select and copy it manually.');
    }
  }

  if (loading) return <p className="notice">Loading network monitoring status…</p>;

  return (
    <div className="network-monitoring-admin">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}

      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">NETWORK PROVIDERS</p><h2>Integration setup</h2></div></div>
        <p className="muted">StayShield accepts normalized connection events from an authorised Wi-Fi controller, RADIUS, NAC, or managed endpoint connector. Creating a credential does not connect a provider by itself.</p>
        <form className="operations-form network-integration-form" onSubmit={(event) => void createIntegration(event)}>
          <label>Integration name<input name="name" required minLength={2} maxLength={80} placeholder="e.g. Hotel staff WLAN" /></label>
          <label>Provider type<select name="source" defaultValue="wifi_controller">
            <option value="wifi_controller">Wi-Fi controller</option>
            <option value="radius">RADIUS accounting</option>
            <option value="nac">Network access control (NAC)</option>
            <option value="endpoint_agent">Managed endpoint agent</option>
            <option value="simulation">Simulation (development only)</option>
          </select></label>
          <button className="button primary" disabled={saving} type="submit">{saving ? 'Creating…' : 'Create integration credential'}</button>
        </form>
        {credential && (
          <div className="network-integration-token" role="status">
            <strong>Copy this provider credential now</strong>
            <p>It is shown once and is required as a Bearer token when sending events.</p>
            <div><code>{credential.token}</code><button className="button secondary" onClick={() => void copyCredential()} type="button">{copied ? 'Copied' : 'Copy credential'}</button></div>
          </div>
        )}
        {integrations.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Integration</th><th>Provider</th><th>Status</th><th>Last event</th><th>Action</th></tr></thead>
          <tbody>{integrations.map((integration) => (
            <tr key={integration.id}>
              <td><strong>{integration.name}</strong></td>
              <td>{sourceLabel(integration.source)}</td>
              <td><span className={`status-badge status-${integration.status}`}>{sourceLabel(integration.status)}</span></td>
              <td>{displayDate(integration.lastEventAt)}</td>
              <td><button className="button secondary" disabled={saving || !integration.isEnabled} onClick={() => void disableIntegration(integration)} type="button">Disable</button></td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="empty-state">No network integrations have been configured.</p>}
        <p className="privacy-note">Credentials are stored only as hashes. Treat the one-time token like a password and configure it only in the trusted provider connector.</p>
      </section>

      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">CONNECTION VISIBILITY</p><h2>Recent network sessions</h2></div><button className="button secondary" onClick={() => void load()} type="button">Refresh</button></div>
        {sessions.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Employee / device</th><th>Network</th><th>Type</th><th>Source</th><th>IP / segment</th><th>Status</th><th>Last update</th></tr></thead>
          <tbody>{sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.employee ? <><strong>{session.employee.displayName}</strong><small>{session.employee.email}</small></> : <strong>Device identity not verified</strong>}{session.device && <small>{session.device.name} · {session.device.deviceType}</small>}</td>
              <td>{connectionName(session)}</td>
              <td>{sourceLabel(session.connectionType)}</td>
              <td>{sourceLabel(session.source)}</td>
              <td>{session.ipAddress ?? 'Not available'}<small>{session.networkSegment ?? 'Segment not available'}</small></td>
              <td><span className={`status-badge status-${session.status}`}>{sourceLabel(session.status)}</span></td>
              <td>{displayDate(session.lastSeenAt)}</td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="empty-state">No provider-reported connection sessions are available.</p>}
        <p className="privacy-note">Only authorised administrators can view tenant-wide sessions. Records without a confident employee or approved-device match remain unverified and are never attributed to staff.</p>
      </section>
    </div>
  );
}
