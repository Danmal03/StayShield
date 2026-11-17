'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { Policy } from '../../lib/types';
import { isAdmin } from '../../lib/roles';
import { useConsoleContext } from '../console-provider';

type PolicyForm = { name: string; summary: string; status: string };
const emptyForm: PolicyForm = { name: '', summary: '', status: 'draft' };

export function PoliciesPage() {
  const { user, reloadWorkspace } = useConsoleContext();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editFormRef = useRef<HTMLElement>(null);

  const canManage = Boolean(user && (
    isAdmin(user.roles) || user.roles.includes('DATA_PROTECTION_OFFICER')
  ));

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setPolicies(await apiJson<Policy[]>('/operations/policies'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load policies.');
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
    return policies.filter((policy) => {
      const searchableText = `${policy.name} ${policy.summary} ${policy.status}`.toLowerCase();
      const matchesQuery = terms.every((term) => searchableText.includes(term));
      return matchesQuery && (statusFilter === 'all' || policy.status === statusFilter);
    });
  }, [policies, query, statusFilter]);

  function startEdit(policy: Policy) {
    setEditingId(policy.id);
    setForm({ name: policy.name, summary: policy.summary, status: policy.status });
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
        editingId ? `/operations/policies/${editingId}` : '/operations/policies',
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(form) },
      );
      cancelEdit();
      setNotice(editingId ? 'Policy updated.' : 'Policy created.');
      await load();
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this policy.');
    } finally {
      setSaving(false);
    }
  }

  async function archive(policy: Policy) {
    if (!window.confirm(`Archive "${policy.name}"? You can edit it later to restore it.`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/operations/policies/${policy.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      setNotice('Policy archived.');
      await load();
      await reloadWorkspace();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Unable to archive this policy.');
    }
  }

  const activeCount = policies.filter((policy) => policy.status === 'active').length;
  const draftCount = policies.filter((policy) => policy.status === 'draft').length;
  const archivedCount = policies.filter((policy) => policy.status === 'archived').length;

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card"><span>Total policies</span><strong>{policies.length}</strong></div>
        <div className="metric-card"><span>Active</span><strong>{activeCount}</strong></div>
        <div className="metric-card"><span>Drafts</span><strong>{draftCount}</strong></div>
        <div className="metric-card"><span>Archived</span><strong>{archivedCount}</strong></div>
      </div>

      {canManage && (
        <section className="content-panel" ref={editFormRef}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? 'POLICY REVIEW' : 'POLICY LIBRARY'}</p>
              <h2>{editingId ? 'Edit policy' : 'Create a policy'}</h2>
            </div>
            {editingId && <button className="button secondary" onClick={cancelEdit} type="button">Cancel</button>}
          </div>
          <form className="operations-form" onSubmit={(event) => void save(event)}>
            <div className="field-grid">
              <label>Policy name<input required minLength={3} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <label>Policy summary and requirements<textarea required minLength={5} maxLength={5000} rows={5} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
            <div className="form-actions">
              <button className="button primary" disabled={saving} type="submit">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create policy'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">GOVERNANCE</p><h2>Security policies</h2></div>
          <span className="muted">{filtered.length} shown</span>
        </div>
        <div className="operations-toolbar">
          <label className="search-field">Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, summary, or status" /></label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading ? <p className="muted">Loading policies…</p> : filtered.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead><tr><th>Policy</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((policy) => (
                  <tr key={policy.id}>
                    <td><strong>{policy.name}</strong><small className="multiline">{policy.summary}</small></td>
                    <td><span className={`status-badge status-${policy.status}`}>{policy.status}</span></td>
                    <td className="row-actions">
                      {canManage ? (
                        <>
                          <button className="text-button" onClick={() => startEdit(policy)} type="button">Edit</button>
                          {policy.status !== 'archived' && <button className="text-button danger-text" onClick={() => void archive(policy)} type="button">Archive</button>}
                        </>
                      ) : <span className="muted">View only</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state">{query || statusFilter !== 'all' ? 'No policies match these filters.' : 'No policies have been created yet.'}</p>}
      </section>
    </>
  );
}
