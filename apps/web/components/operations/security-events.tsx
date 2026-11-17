'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { SecurityEvent } from '../../lib/types';
import { isAdmin } from '../../lib/roles';
import { useConsoleContext } from '../console-provider';

type EventForm = {
  title: string;
  description: string;
  source: string;
  severity: string;
  status: string;
};

const emptyForm: EventForm = {
  title: '',
  description: '',
  source: 'Manual entry',
  severity: 'medium',
  status: 'open',
};

export function SecurityEventsPage() {
  const { user, reloadWorkspace } = useConsoleContext();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const triageFormRef = useRef<HTMLElement>(null);

  const canManage = Boolean(user && (
    isAdmin(user.roles) || user.roles.includes('SECURITY_ANALYST')
  ));

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setEvents(await apiJson<SecurityEvent[]>('/operations/events'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load security events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (editingId) triageFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((item) => {
      const matchesQuery = !needle || [item.title, item.description, item.source]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesQuery &&
        (severityFilter === 'all' || item.severity === severityFilter) &&
        (statusFilter === 'all' || item.status === statusFilter);
    });
  }, [events, query, severityFilter, statusFilter]);

  function startEdit(item: SecurityEvent) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      source: item.source,
      severity: item.severity,
      status: item.status,
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
        editingId ? `/operations/events/${editingId}` : '/operations/events',
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) },
      );
      cancelEdit();
      setNotice(editingId ? 'Event updated.' : 'Event recorded.');
      await load();
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this event.');
    } finally {
      setSaving(false);
    }
  }

  const openCount = events.filter((item) => item.status === 'open').length;
  const investigatingCount = events.filter((item) => item.status === 'investigating').length;
  const criticalCount = events.filter((item) => item.severity === 'critical' && item.status !== 'resolved' && item.status !== 'false_positive').length;

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card"><span>Total events</span><strong>{events.length}</strong></div>
        <div className="metric-card"><span>Open</span><strong>{openCount}</strong></div>
        <div className="metric-card"><span>Investigating</span><strong>{investigatingCount}</strong></div>
        <div className="metric-card"><span>Unresolved critical</span><strong>{criticalCount}</strong></div>
      </div>

      {canManage && (
        <section className="content-panel" ref={triageFormRef}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? 'EVENT TRIAGE' : 'MANUAL EVENT INTAKE'}</p>
              <h2>{editingId ? 'Triage security event' : 'Record a security event'}</h2>
            </div>
            {editingId && <button className="button secondary" onClick={cancelEdit} type="button">Cancel</button>}
          </div>
          <form className="operations-form" onSubmit={(event) => void save(event)}>
            <div className="field-grid">
              <label>Event title<input required minLength={3} maxLength={160} readOnly={Boolean(editingId)} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Source<input required minLength={2} maxLength={100} readOnly={Boolean(editingId)} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
              <label>Severity
                <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </label>
              {editingId && <label>Triage status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="false_positive">False positive</option>
                </select>
              </label>}
            </div>
            <label>{editingId ? 'Event details / investigation notes' : 'Description'}<textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <div className="form-actions">
              <button className="button primary" disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save triage update' : 'Record event'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">DETECTION &amp; TRIAGE</p><h2>Security events</h2></div>
          <span className="muted">{filtered.length} shown</span>
        </div>
        <div className="operations-toolbar">
          <label className="search-field">Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, source, description" /></label>
          <label>Severity
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="false_positive">False positive</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading ? <p className="muted">Loading security events…</p> : filtered.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead><tr><th>Event</th><th>Source</th><th>Severity</th><th>Status</th><th>Occurred</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong><small>{item.description || 'No additional details'}</small></td>
                    <td>{item.source}</td>
                    <td><span className={`status-badge severity-${item.severity}`}>{item.severity}</span></td>
                    <td><span className={`status-badge status-${item.status}`}>{item.status.replace('_', ' ')}</span></td>
                    <td>{new Date(item.occurredAt).toLocaleString()}</td>
                    <td className="row-actions">{canManage ? <button className="text-button" onClick={() => startEdit(item)} type="button">Triage</button> : <span className="muted">View only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state">{query || severityFilter !== 'all' || statusFilter !== 'all' ? 'No events match these filters.' : 'No security events have been recorded.'}</p>}
      </section>
    </>
  );
}
