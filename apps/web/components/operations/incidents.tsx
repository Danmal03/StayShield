'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { Incident } from '../../lib/types';
import { isAdmin } from '../../lib/roles';
import { useConsoleContext } from '../console-provider';

type IncidentForm = { title: string; summary: string; severity: string; status: string };
const emptyForm: IncidentForm = { title: '', summary: '', severity: 'medium', status: 'open' };

export function IncidentsPage() {
  const { user, reloadWorkspace } = useConsoleContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [form, setForm] = useState<IncidentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editFormRef = useRef<HTMLElement>(null);

  const canManage = Boolean(user && (
    isAdmin(user.roles) ||
    user.roles.some((role) => ['SECURITY_ANALYST', 'IT_SUPPORT'].includes(role))
  ));

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setIncidents(await apiJson<Incident[]>('/operations/incidents'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load incidents.');
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
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return incidents.filter((incident) => {
      const searchableText = `${incident.title} ${incident.summary} ${incident.severity} ${incident.status}`.toLowerCase();
      const matchesQuery = terms.every((term) => searchableText.includes(term));
      return matchesQuery &&
        (severityFilter === 'all' || incident.severity === severityFilter) &&
        (statusFilter === 'all' || incident.status === statusFilter);
    });
  }, [incidents, query, severityFilter, statusFilter]);

  function startEdit(incident: Incident) {
    setEditingId(incident.id);
    setForm({
      title: incident.title,
      summary: incident.summary,
      severity: incident.severity,
      status: incident.status,
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
        editingId ? `/operations/incidents/${editingId}` : '/operations/incidents',
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) },
      );
      cancelEdit();
      setNotice(editingId ? 'Incident updated.' : 'Incident opened.');
      await load();
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this incident.');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = incidents.filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved').length;
  const criticalCount = incidents.filter((incident) => incident.severity === 'critical' && incident.status !== 'closed' && incident.status !== 'resolved').length;
  const investigatingCount = incidents.filter((incident) => incident.status === 'investigating').length;

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card"><span>All incidents</span><strong>{incidents.length}</strong></div>
        <div className="metric-card"><span>Active</span><strong>{activeCount}</strong></div>
        <div className="metric-card"><span>Critical active</span><strong>{criticalCount}</strong></div>
        <div className="metric-card"><span>Investigating</span><strong>{investigatingCount}</strong></div>
      </div>

      {canManage && (
        <section className="content-panel" ref={editFormRef}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? 'INCIDENT RESPONSE' : 'INCIDENT INTAKE'}</p>
              <h2>{editingId ? 'Update incident' : 'Open an incident'}</h2>
            </div>
            {editingId && <button className="button secondary" onClick={cancelEdit} type="button">Cancel</button>}
          </div>
          <form className="operations-form" onSubmit={(event) => void save(event)}>
            <div className="field-grid">
              <label>Incident title<input required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Severity
                <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </label>
              {editingId && <label>Response status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="open">Open</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                </select>
              </label>}
            </div>
            <label>Incident details<textarea required minLength={5} maxLength={5000} rows={4} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
            <div className="form-actions">
              <button className="button primary" disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save response update' : 'Open incident'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">RESPONSE TRACKING</p><h2>Incidents</h2></div>
          <span className="muted">{filtered.length} shown</span>
        </div>
        <div className="operations-toolbar">
          <label className="search-field">Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, details, severity, or status" /></label>
          <label>Severity
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading ? <p className="muted">Loading incidents…</p> : filtered.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Opened</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((incident) => (
                  <tr key={incident.id}>
                    <td><strong>{incident.title}</strong><small className="multiline">{incident.summary}</small></td>
                    <td><span className={`status-badge severity-${incident.severity}`}>{incident.severity}</span></td>
                    <td><span className={`status-badge status-${incident.status}`}>{incident.status}</span></td>
                    <td>{new Date(incident.openedAt).toLocaleString()}</td>
                    <td className="row-actions">{canManage ? <button className="text-button" onClick={() => startEdit(incident)} type="button">Update</button> : <span className="muted">View only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state">{query || severityFilter !== 'all' || statusFilter !== 'all' ? 'No incidents match these filters.' : 'No incidents have been opened.'}</p>}
      </section>
    </>
  );
}
