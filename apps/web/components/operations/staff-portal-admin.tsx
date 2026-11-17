'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import { StaffAccount } from '../../lib/types';

const permissions = [
  ['websiteAccessRequest', 'Website access requests'],
  ['deviceRegistration', 'Device registration'],
  ['networkSupport', 'Network support requests'],
  ['accountAssistance', 'Account assistance'],
  ['lostDeviceReport', 'Lost device reports'],
  ['securityReport', 'Security reports'],
  ['supportRequest', 'General IT support'],
  ['training', 'Security training'],
];

type Department = { id: string; name: string; description: string; permissions: string[]; isActive: boolean };
type RequestItem = { id: string; category: string; description: string; status: string; createdAt: string; adminResponse: string | null; assignedAdmin: { displayName: string } | null; user: { displayName: string; email: string } };
type DeviceRequest = { id: string; name: string; deviceType: string; operatingSystem: string; createdAt: string; user: { displayName: string; email: string } };
type AdminData = { requests: RequestItem[]; devices: DeviceRequest[]; departments: Department[]; announcements: Array<{ id: string; title: string; body: string }> };

const allPermissions = permissions.map(([key]) => key);

export function StaffPortalAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [staffToAssign, setStaffToAssign] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [portal, accounts] = await Promise.all([
        apiJson<AdminData>('/staff-portal/admin/overview'),
        apiJson<StaffAccount[]>('/staff'),
      ]);
      setData(portal);
      setStaff(accounts.filter((account) => account.isActive));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load employee portal administration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>, endpoint: string, method: 'POST' | 'PATCH', body: unknown, success: string) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(endpoint, { method, body: JSON.stringify(body) });
      setNotice(success);
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to save this portal update.');
    } finally {
      setSaving(false);
    }
  }

  async function updateRequest(request: RequestItem, form: HTMLFormElement) {
    const formData = new FormData(form);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/staff-portal/admin/requests/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: formData.get('status'), adminResponse: formData.get('adminResponse') }),
      });
      setNotice('Request updated and the employee notified.');
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this request.');
    } finally {
      setSaving(false);
    }
  }

  async function reviewDevice(device: DeviceRequest, status: 'approved' | 'declined') {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/staff-portal/admin/devices/${device.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(`Device request ${status}. The employee was notified.`);
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review this device.');
    } finally {
      setSaving(false);
    }
  }

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const department = await apiJson<Department>('/staff-portal/admin/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          permissions: allPermissions,
          isActive: true,
        }),
      });
      setSelectedDepartmentId(department.id);
      setNotice('Department created. Configure its permissions and staff below.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the department.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    if (!window.confirm(`Delete ${department.name}? Staff assignments will be cleared and announcements targeted only to this department will be archived.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/staff-portal/admin/departments/${department.id}`, { method: 'DELETE' });
      setSelectedDepartmentId(null);
      setStaffToAssign('');
      setNotice(`${department.name} deleted.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the department.');
    } finally {
      setSaving(false);
    }
  }

  async function assignStaff(userId: string, departmentId: string | null) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/staff-portal/admin/staff/${userId}/department`, {
        method: 'PATCH',
        body: JSON.stringify({ departmentId }),
      });
      setStaffToAssign('');
      setNotice(departmentId ? 'Staff member assigned to the department.' : 'Staff member removed from the department.');
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Unable to update the staff assignment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="notice">Loading employee portal administration…</p>;
  if (!data) return <div className="notice notice-error" role="alert"><span>{error || 'Unable to load the portal administration area.'}</span><button className="button secondary" onClick={() => void load()} type="button">Retry</button></div>;

  const selectedDepartment = data.departments.find((department) => department.id === selectedDepartmentId) ?? null;
  const assignedStaff = selectedDepartment
    ? staff.filter((employee) => employee.department?.id === selectedDepartment.id)
    : [];
  const assignableStaff = selectedDepartment
    ? staff.filter((employee) => employee.department?.id !== selectedDepartment.id)
    : [];

  return (
    <div className="staff-portal-admin">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      <p className="muted">Website access and support requests appear under Employee requests. Device registration submissions are listed separately under Device registrations.</p>
      <div className="metric-grid">
        <div className="metric-card"><span>Employee requests</span><strong>{data.requests.filter((item) => ['pending', 'in_progress'].includes(item.status)).length}</strong></div>
        <div className="metric-card"><span>Device approvals</span><strong>{data.devices.length}</strong></div>
        <div className="metric-card"><span>Departments</span><strong>{data.departments.length}</strong></div>
      </div>

      <section className="content-panel" id="employee-requests">
        <div className="panel-heading"><div><p className="eyebrow">EMPLOYEE SUPPORT</p><h2>Requests and reports</h2></div></div>
        {data.requests.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Employee</th><th>Request</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>{data.requests.map((request) => (
            <tr key={request.id}>
              <td><strong>{request.user.displayName}</strong><small>{request.user.email}</small></td>
              <td><strong>{display(request.category)}</strong><small>ID: {request.id}</small><small>{request.description}</small><small>{new Date(request.createdAt).toLocaleString()}</small></td>
              <td><span className={`status-badge status-${request.status}`}>{display(request.status)}</span><small>{request.assignedAdmin?.displayName ?? 'Unassigned'}</small></td>
              <td><form className="inline-review-form" onSubmit={(event) => { event.preventDefault(); void updateRequest(request, event.currentTarget); }}>
                <select name="status" defaultValue={request.status}><option value="in_progress">In progress</option><option value="approved">Approve</option><option value="declined">Decline</option><option value="resolved">Resolve</option></select>
                <input name="adminResponse" maxLength={1000} defaultValue={request.adminResponse ?? ''} placeholder="Response to employee" />
                <button className="button secondary" disabled={saving} type="submit">Save</button>
              </form></td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="empty-state">There are no employee requests.</p>}
      </section>

      <section className="content-panel" id="device-approvals">
        <div className="panel-heading"><div><p className="eyebrow">DEVICE REGISTRATION</p><h2>Pending employee devices</h2></div></div>
        {data.devices.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Employee</th><th>Device</th><th>Submitted</th><th>Review</th></tr></thead>
          <tbody>{data.devices.map((device) => (
            <tr key={device.id}><td><strong>{device.user.displayName}</strong><small>{device.user.email}</small></td>
              <td>{device.name}<small>{device.deviceType} · {device.operatingSystem}</small></td>
              <td>{new Date(device.createdAt).toLocaleDateString()}</td>
              <td><div className="form-actions"><button className="button secondary" disabled={saving} onClick={() => void reviewDevice(device, 'approved')} type="button">Approve</button><button className="button secondary" disabled={saving} onClick={() => void reviewDevice(device, 'declined')} type="button">Decline</button></div></td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="empty-state">There are no pending device registrations.</p>}
        <p className="privacy-note">Approval records a local administrative decision only; it does not install or verify endpoint protection, encryption, or network access.</p>
      </section>

      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">CONFIGURABLE PERMISSIONS</p><h2>Departments</h2></div></div>
        <form className="operations-form" onSubmit={(event) => void createDepartment(event)}>
          <div className="field-grid">
            <label>Department name<input name="name" required minLength={2} maxLength={80} /></label>
            <label>Description<input name="description" maxLength={500} /></label>
          </div>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">Add department</button></div>
        </form>
        {data.departments.length ? (
          <div className="department-list" aria-label="Departments">
            {data.departments.map((department) => (
              <button
                className={`department-card${selectedDepartmentId === department.id ? ' selected' : ''}`}
                key={department.id}
                onClick={() => {
                  setSelectedDepartmentId(department.id);
                  setStaffToAssign('');
                }}
                type="button"
                aria-pressed={selectedDepartmentId === department.id}
              >
                <span><strong>{department.name}</strong><small>{department.description || 'No description'}</small></span>
                <span className={`status-badge status-${department.isActive ? 'active' : 'offline'}`}>{department.isActive ? 'Active' : 'Inactive'}</span>
              </button>
            ))}
          </div>
        ) : <p className="empty-state">No departments yet. Add one above.</p>}

        {selectedDepartment ? (
          <div className="department-detail">
            <div className="panel-heading">
              <div><p className="eyebrow">DEPARTMENT SETTINGS</p><h3>{selectedDepartment.name}</h3></div>
              <button className="button secondary danger-text" disabled={saving} onClick={() => void deleteDepartment(selectedDepartment)} type="button">Delete department</button>
            </div>
            <form className="department-edit-form" key={selectedDepartment.id} onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void send(event, `/staff-portal/admin/departments/${selectedDepartment.id}`, 'PATCH', {
                name: form.get('name'),
                description: form.get('description'),
                permissions: form.getAll('permission'),
                isActive: form.get('isActive') === 'on',
              }, 'Department settings saved.');
            }}>
              <div className="field-grid">
                <label>Department<input name="name" required minLength={2} maxLength={80} defaultValue={selectedDepartment.name} /></label>
                <label>Description<input name="description" maxLength={500} defaultValue={selectedDepartment.description} /></label>
              </div>
              <label className="check-label"><input name="isActive" type="checkbox" defaultChecked={selectedDepartment.isActive} /> Active</label>
              <PermissionChecks key={selectedDepartment.id} name="permission" values={selectedDepartment.permissions} />
              <div className="form-actions"><button className="button primary" disabled={saving} type="submit">Save department</button></div>
            </form>

            <div className="department-members">
              <h4>Active staff</h4>
              <p className="muted">Assign active staff members to this department. Inactive staff accounts are managed under Staff accounts.</p>
              <form className="inline-review-form" onSubmit={(event) => {
                event.preventDefault();
                if (staffToAssign) void assignStaff(staffToAssign, selectedDepartment.id);
              }}>
                <select
                  aria-label="Staff member to assign"
                  disabled={saving || !selectedDepartment.isActive || !assignableStaff.length}
                  value={staffToAssign}
                  onChange={(event) => setStaffToAssign(event.target.value)}
                >
                  <option value="">Choose an active staff member</option>
                  {assignableStaff.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.displayName}{employee.department ? ` · currently ${employee.department.name}` : ' · unassigned'}
                    </option>
                  ))}
                </select>
                <button className="button secondary" disabled={saving || !selectedDepartment.isActive || !staffToAssign} type="submit">Assign</button>
              </form>
              {!selectedDepartment.isActive && <p className="muted">Activate this department before assigning staff.</p>}
              {assignedStaff.length ? (
                <ul className="portal-list">
                  {assignedStaff.map((employee) => (
                    <li key={employee.id}>
                      <strong>{employee.displayName}</strong><small>{employee.email}</small>
                      <button className="button secondary" disabled={saving} onClick={() => void assignStaff(employee.id, null)} type="button">Remove from department</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty-state">No active staff are assigned to this department.</p>}
            </div>
          </div>
        ) : <p className="empty-state">Select a department above to edit its settings, permissions, and staff.</p>}
      </section>

      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">COMMUNICATIONS</p><h2>Publish an announcement</h2></div></div>
        <form className="operations-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          void send(event, '/staff-portal/admin/announcements', 'POST', {
            title: form.get('title'), body: form.get('body'),
            ...(form.get('audienceDepartmentId') ? { audienceDepartmentId: form.get('audienceDepartmentId') } : {}),
          }, 'Security announcement published.');
        }}>
          <div className="field-grid"><label>Title<input name="title" required minLength={3} maxLength={120} /></label><label>Audience department<select name="audienceDepartmentId"><option value="">All departments</option>{data.departments.filter((department) => department.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></div>
          <label>Announcement<textarea name="body" required minLength={5} maxLength={4000} rows={4} /></label>
          <button className="button primary" disabled={saving} type="submit">Publish announcement</button>
        </form>
        {data.announcements.length > 0 && <ul className="portal-list">{data.announcements.slice(0, 5).map((item) => <li key={item.id}><strong>{item.title}</strong><p>{item.body}</p></li>)}</ul>}
      </section>

    </div>
  );
}

function PermissionChecks({ name, values }: { name: string; values: string[] }) {
  const [selected, setSelected] = useState(values);
  useEffect(() => { setSelected(values); }, [values]);

  return (
    <fieldset className="permission-checks"><legend>Allowed self-service actions</legend>
      {permissions.map(([key, label]) => <label key={key}><input name={name} type="checkbox" value={key} checked={selected.includes(key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, key] : current.filter((value) => value !== key))} />{label}</label>)}
    </fieldset>
  );
}

function display(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
