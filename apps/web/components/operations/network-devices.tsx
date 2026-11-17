'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { Device } from '../../lib/types';
import { isAdmin } from '../../lib/roles';
import { useConsoleContext } from '../console-provider';

type DeviceForm = {
  name: string;
  category: string;
  location: string;
  ipAddress: string;
  status: string;
};

const emptyForm: DeviceForm = {
  name: '',
  category: '',
  location: '',
  ipAddress: '',
  status: 'online',
};

function dateLabel(value: string): string {
  return new Date(value).toLocaleString();
}

export function NetworkDevicesPage() {
  const { user, reloadWorkspace } = useConsoleContext();
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState<DeviceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editFormRef = useRef<HTMLElement>(null);

  const canManage = Boolean(user && (
    isAdmin(user.roles) ||
    user.roles.some((role) => ['NETWORK_ADMINISTRATOR', 'IT_SUPPORT'].includes(role))
  ));
  const canDelete = Boolean(user && isAdmin(user.roles));

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setDevices(await apiJson<Device[]>('/operations/devices'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (editingId) editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesQuery = !needle || [
        device.name,
        device.category,
        device.location,
        device.ipAddress,
      ].some((value) => value.toLowerCase().includes(needle));
      return matchesQuery && (statusFilter === 'all' || device.status === statusFilter);
    });
  }, [devices, query, statusFilter]);

  function startEdit(device: Device) {
    setEditingId(device.id);
    setForm({
      name: device.name,
      category: device.category,
      location: device.location,
      ipAddress: device.ipAddress,
      status: device.status,
    });
    setNotice('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(
        editingId ? `/operations/devices/${editingId}` : '/operations/devices',
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) },
      );
      cancelEdit();
      setNotice(editingId ? 'Device updated.' : 'Device added.');
      await load();
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this device.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(device: Device) {
    if (!window.confirm(`Quarantine ${device.name}? It will remain in the inventory until an administrator resolves the issue and restores it.`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/operations/devices/${device.id}`, { method: 'DELETE' });
      setNotice('Device quarantined and retained in the inventory.');
      await load();
      await reloadWorkspace();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove this device.');
    }
  }

  async function restore(device: Device) {
    if (!window.confirm(`Has the issue with ${device.name} been resolved? Restore it to the active inventory?`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/operations/devices/${device.id}/restore`, { method: 'POST' });
      setNotice('Device restored to the active inventory.');
      await load();
      await reloadWorkspace();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore this device.');
    }
  }

  const onlineCount = devices.filter((device) => device.status === 'online').length;
  const attentionCount = devices.length - onlineCount;

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card"><span>All devices</span><strong>{devices.length}</strong></div>
        <div className="metric-card"><span>Online</span><strong>{onlineCount}</strong></div>
        <div className="metric-card"><span>Needs attention</span><strong>{attentionCount}</strong></div>
      </div>

      {canManage && (
        <section className="content-panel" ref={editFormRef}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? 'UPDATE INVENTORY' : 'DEVICE INVENTORY'}</p>
              <h2>{editingId ? 'Edit device' : 'Add a device'}</h2>
            </div>
            {editingId && <button className="button secondary" onClick={cancelEdit} type="button">Cancel</button>}
          </div>
          <form className="operations-form" onSubmit={(event) => void save(event)}>
            <div className="field-grid">
              <label>Device name<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Category<input required minLength={2} maxLength={60} placeholder="Access point, switch…" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label>Location<input required minLength={2} maxLength={120} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
              <label>IP address<input required type="text" inputMode="url" maxLength={45} placeholder="192.0.2.10" value={form.ipAddress} onChange={(event) => setForm({ ...form, ipAddress: event.target.value })} /></label>
              <label>Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="attention">Attention</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button className="button primary" disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add device'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">INVENTORY</p><h2>Network devices</h2></div>
          <span className="muted">{filtered.length} shown</span>
        </div>
        <div className="operations-toolbar">
          <label className="search-field">Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, category, location, IP" /></label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
              <option value="attention">Attention</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading ? <p className="muted">Loading devices…</p> : filtered.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead><tr><th>Device</th><th>Location</th><th>IP address</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((device) => (
                  <tr key={device.id}>
                    <td><strong>{device.name}</strong><small>{device.category}</small></td>
                    <td>{device.location}</td><td>{device.ipAddress}</td>
                    <td><span className={`status-badge status-${device.status}`}>{device.status}</span></td>
                    <td>{dateLabel(device.lastSeenAt)}</td>
                    <td className="row-actions">
                      {device.status === 'quarantined' ? (
                        canDelete
                          ? <button className="text-button" onClick={() => void restore(device)} type="button">Resolve &amp; restore</button>
                          : <span className="muted">Quarantined</span>
                      ) : (
                        <>
                          {canManage && <button className="text-button" onClick={() => startEdit(device)} type="button">Edit</button>}
                          {canDelete && <button className="text-button danger-text" onClick={() => void remove(device)} type="button">Quarantine</button>}
                          {!canManage && !canDelete && <span className="muted">View only</span>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state">{query || statusFilter !== 'all' ? 'No devices match these filters.' : 'No devices have been added yet.'}</p>}
        <p className="privacy-note">Quarantine is recorded in StayShield. Live Wi-Fi blocking requires a connected network access-control provider; none is currently configured.</p>
      </section>
    </>
  );
}
