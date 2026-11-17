'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { isAdmin, ROLE_LABELS } from '../../lib/roles';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { StaffAccount } from '../../lib/types';
import { useConsoleContext } from '../console-provider';

type StaffForm = {
  displayName: string;
  email: string;
  password: string;
  role: string;
  departmentId: string;
};

const emptyForm: StaffForm = {
  displayName: '',
  email: '',
  password: '',
  role: 'SECURITY_ANALYST',
  departmentId: '',
};

type DepartmentOption = { id: string; name: string; isActive: boolean };

const assignableRoles = [
  'SECURITY_ADMINISTRATOR',
  'SECURITY_ANALYST',
  'NETWORK_ADMINISTRATOR',
  'IT_SUPPORT',
  'AUDITOR',
  'DATA_PROTECTION_OFFICER',
  'HOTEL_MANAGEMENT',
  'READ_ONLY_EXECUTIVE',
];

export function StaffAccountsPage() {
  const { user, reloadWorkspace } = useConsoleContext();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const owner = Boolean(user?.roles.includes('SYSTEM_OWNER'));
  const canManage = Boolean(user && isAdmin(user.roles));
  const roles = owner ? ['SYSTEM_OWNER', ...assignableRoles] : assignableRoles;

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [staff, departmentOptions] = await Promise.all([
        apiJson<StaffAccount[]>('/staff'),
        apiJson<DepartmentOption[]>('/staff-portal/admin/departments'),
      ]);
      setAccounts(staff);
      setDepartments(departmentOptions.filter((department) => department.isActive));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter((account) => !needle || [
      account.displayName,
      account.email,
      ...account.roles.map((role) => ROLE_LABELS[role] ?? role),
    account.department?.name ?? '',
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [accounts, query]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/staff', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      setNotice('Staff account created. Share its initial password securely with the account holder.');
      await load();
      await reloadWorkspace();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the account.');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = accounts.filter((account) => account.isActive).length;

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card"><span>Staff accounts</span><strong>{accounts.length}</strong></div>
        <div className="metric-card"><span>Active accounts</span><strong>{activeCount}</strong></div>
      </div>

      {canManage && (
        <section className="content-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">ACCOUNT PROVISIONING</p><h2>Create a staff account</h2></div>
          </div>
          <p className="muted">This creates an account that can sign in immediately. Use a unique temporary password and share it with the staff member securely.</p>
          <form className="operations-form" onSubmit={(event) => void createAccount(event)}>
            <div className="field-grid">
              <label>Full name<input required minLength={2} maxLength={80} autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
              <label>Work email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Initial password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
              <label>Role
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] ?? role}</option>)}
                </select>
              </label>
              <label>Department
                <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                  <option value="">Not assigned</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            </div>
            <div className="form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Creating…' : 'Create account'}</button></div>
          </form>
        </section>
      )}

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">ACCESS MANAGEMENT</p><h2>Staff accounts</h2></div>
          <span className="muted">{filtered.length} shown</span>
        </div>
        <div className="operations-toolbar">
          <label className="search-field">Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or role" /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading ? <p className="muted">Loading staff accounts…</p> : filtered.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead><tr><th>Staff member</th><th>Role</th><th>Department</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.displayName}</strong><small>{account.email}</small></td>
                    <td>{account.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}</td>
                    <td>{account.department?.name ?? 'Unassigned'}</td>
                    <td><span className={`status-badge status-${account.isActive ? 'active' : 'archived'}`}>{account.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-state">{query ? 'No staff accounts match this search.' : 'No staff accounts found.'}</p>}
      </section>
    </>
  );
}
