'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJson, apiRequest } from '../../lib/operations-api';
import {
  StaffNotification,
  StaffPortalOverview,
  StaffRequest,
  PersonalSecurityReport,
  StaffTrainingAssignment,
} from '../../lib/types';
import { useConsoleContext } from '../console-provider';
import { StaffNetworkPanel } from './staff-network-panel';

export type StaffPortalSection =
  | 'devices'
  | 'activity'
  | 'web-access'
  | 'security'
  | 'account'
  | 'requests'
  | 'notifications'
  | 'training';

type OwnSession = { id: string; createdAt: string; expiresAt: string; current: boolean };
type OwnLoginEvent = { id: string; action: string; sourceIp: string | null; createdAt: string };

const requestCategories = [
  ['device_registration', 'Device registration'],
  ['network_connectivity', 'Network connectivity'],
  ['account_assistance', 'Account assistance'],
  ['lost_device', 'Lost or stolen device'],
  ['security_incident', 'Security incident'],
  ['suspicious_email', 'Suspicious email / phishing'],
  ['suspected_malware', 'Suspected malware'],
  ['suspicious_device', 'Suspicious device'],
  ['general_it_support', 'General IT support'],
];
const permissionForRequest: Record<string, string> = {
  device_registration: 'deviceRegistration',
  network_connectivity: 'networkSupport',
  account_assistance: 'accountAssistance',
  lost_device: 'lostDeviceReport',
  security_incident: 'securityReport',
  suspicious_email: 'securityReport',
  suspected_malware: 'securityReport',
  suspicious_device: 'securityReport',
  general_it_support: 'supportRequest',
};

const statusClass = (status: string) => status.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');

export function StaffPortalWorkspace({ section }: { section: StaffPortalSection }) {
  const { reloadSession } = useConsoleContext();
  const [data, setData] = useState<StaffPortalOverview | null>(null);
  const [sessions, setSessions] = useState<OwnSession[]>([]);
  const [loginEvents, setLoginEvents] = useState<OwnLoginEvent[]>([]);
  const [reports, setReports] = useState<PersonalSecurityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const overview = await apiJson<StaffPortalOverview>('/staff-portal/overview');
      setData(overview);
      if (section === 'account' || section === 'security') {
        const [ownSessions, ownReports, ownLoginEvents] = await Promise.all([
          section === 'account' ? apiJson<OwnSession[]>('/staff-portal/sessions') : Promise.resolve([]),
          section === 'security' ? apiJson<PersonalSecurityReport[]>('/staff-portal/reports') : Promise.resolve([]),
          section === 'account' ? apiJson<OwnLoginEvent[]>('/staff-portal/login-history') : Promise.resolve([]),
        ]);
        if (section === 'account') {
          setSessions(ownSessions);
          setLoginEvents(ownLoginEvents);
        }
        if (section === 'security') setReports(ownReports);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this portal area.');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { void load(); }, [load]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    body: unknown,
    successText: string,
  ) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });
      setNotice(successText);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your request could not be submitted.');
    } finally {
      setSaving(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setError('');
    setNotice('');
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/staff-portal/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.get('displayName'),
          jobTitle: form.get('jobTitle'),
          notificationPreferences: {
            email: form.get('emailNotifications') === 'on',
            inApp: form.get('inAppNotifications') === 'on',
          },
        }),
      });
      setNotice('Your profile was updated.');
      await reloadSession();
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function markNotification(id: string) {
    setError('');
    try {
      await apiRequest(`/staff-portal/notifications/${id}/read`, { method: 'PATCH' });
      await load();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to update the notification.');
    }
  }

  async function revokeSession(id: string) {
    if (!window.confirm('Sign out this session?')) return;
    setError('');
    try {
      await apiRequest(`/staff-portal/sessions/${id}`, { method: 'DELETE' });
      setNotice('The selected session was signed out.');
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke this session.');
    }
  }

  if (loading) return <p className="notice">Loading your information…</p>;
  if (!data) {
    return (
      <div className="notice notice-error" role="alert">
        <span>{error || 'This portal area could not be loaded.'}</span>
        <button className="button secondary" onClick={() => void load()} type="button">Retry</button>
      </div>
    );
  }

  return (
    <div className="staff-portal-content">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {section === 'devices' && <DevicesSection data={data} saving={saving} submit={submit} />}
      {section === 'activity' && <ActivitySection data={data} />}
      {section === 'web-access' && <WebAccessSection data={data} saving={saving} submit={submit} />}
      {section === 'security' && <SecuritySection data={data} reports={reports} saving={saving} submit={submit} />}
      {section === 'requests' && <RequestsSection data={data} saving={saving} submit={submit} />}
      {section === 'notifications' && <NotificationsSection items={data.notifications} onMarkRead={markNotification} />}
      {section === 'training' && <TrainingSection assignments={data.trainingAssignments} onReload={load} setError={setError} setNotice={setNotice} />}
      {section === 'account' && (
        <AccountSection
          data={data}
          sessions={sessions}
          loginEvents={loginEvents}
          saving={saving}
          setSaving={setSaving}
          setError={setError}
          setNotice={setNotice}
          onProfileSubmit={updateProfile}
          onRevokeSession={revokeSession}
        />
      )}
    </div>
  );
}

function DevicesSection({
  data,
  saving,
  submit,
}: {
  data: StaffPortalOverview;
  saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, endpoint: string, body: unknown, success: string) => Promise<void>;
}) {
  const canRegister = departmentAllows(data, 'deviceRegistration');
  const canReportLost = departmentAllows(data, 'lostDeviceReport');
  return (
    <>
      {canRegister && <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">PERSONAL DEVICES</p><h2>Register a device</h2></div></div>
        <p className="muted">Submissions remain pending until an administrator reviews them. Endpoint, encryption, and compliance checks are unavailable until an approved provider is connected.</p>
        <form className="operations-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          void submit(event, '/staff-portal/devices', {
            name: form.get('name'),
            deviceType: form.get('deviceType'),
            operatingSystem: form.get('operatingSystem'),
          }, 'Device registration request submitted for administrator review.');
        }}>
          <div className="field-grid">
            <label>Device name<input name="name" required maxLength={100} /></label>
            <label>Device type<input name="deviceType" required maxLength={60} placeholder="Laptop, phone, tablet…" /></label>
            <label>Operating system<input name="operatingSystem" required maxLength={100} placeholder="Windows 11, iOS…" /></label>
          </div>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Submitting…' : 'Request registration'}</button></div>
        </form>
      </section>}
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">YOUR DEVICES</p><h2>Registered devices</h2></div><span className="muted">{data.devices.length} shown</span></div>
        {data.devices.length ? (
          <div className="table-scroll"><table className="operations-table">
            <thead><tr><th>Device</th><th>Connection</th><th>Assigned IP</th><th>Network segment</th><th>Protection</th><th>Encryption</th><th>Compliance</th><th>Registration</th></tr></thead>
            <tbody>{data.devices.map((device) => (
              <tr key={device.id}>
                <td><strong>{device.name}</strong><small>{device.deviceType} · {device.operatingSystem}</small></td>
                <td>{displayStatus(device.connectionStatus)}</td><td>{device.assignedIp ?? 'Not available'}</td>
                <td>{device.networkSegment ?? 'Not available'}</td><td>{displayStatus(device.endpointProtectionStatus)}</td>
                <td>{displayStatus(device.encryptionStatus)}</td><td>{displayStatus(device.complianceStatus)}</td>
                <td><span className={`status-badge status-${statusClass(device.status)}`}>{displayStatus(device.status)}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="empty-state">You have not requested registration for a device.</p>}
      </section>
      {canReportLost && <LostDeviceForm saving={saving} submit={submit} />}
    </>
  );
}

function LostDeviceForm({ saving, submit }: { saving: boolean; submit: (event: FormEvent<HTMLFormElement>, endpoint: string, body: unknown, success: string) => Promise<void> }) {
  return (
    <section className="content-panel">
      <div className="panel-heading"><div><p className="eyebrow">DEVICE SAFETY</p><h2>Report a lost or stolen device</h2></div></div>
      <form className="operations-form" onSubmit={(event) => {
        const form = new FormData(event.currentTarget);
        void submit(event, '/staff-portal/requests', {
          category: 'lost_device',
          description: form.get('description'),
        }, 'Your lost-device report was sent to the administrator.');
      }}>
        <label>What happened?<textarea name="description" required minLength={5} maxLength={2000} rows={3} /></label>
        <div className="form-actions"><button className="button secondary" disabled={saving} type="submit">Submit lost-device report</button></div>
      </form>
    </section>
  );
}

function ActivitySection({ data }: { data: StaffPortalOverview }) {
  return (
    <>
      <StaffNetworkPanel />
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">PRIVATE ACCOUNT SCOPE</p><h2>Your recent security activity</h2></div></div>
        {data.recentActivity.length ? <ul className="portal-list">{data.recentActivity.map((item) => (
          <li key={item.id}><strong>{item.title}</strong><span className={`status-badge status-${statusClass(item.status)}`}>{displayStatus(item.status)}</span><small>{new Date(item.occurredAt).toLocaleString()}</small></li>
        ))}</ul> : <p className="empty-state">There is no recent account activity to show.</p>}
        <p className="privacy-note">This list contains your own sign-in and report records only. It does not include tenant-wide monitoring logs or other employees’ activity.</p>
      </section>
    </>
  );
}

function WebAccessSection({
  data,
  saving,
  submit,
}: {
  data: StaffPortalOverview;
  saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, endpoint: string, body: unknown, success: string) => Promise<void>;
}) {
  const requests = data.requests.filter((request) => request.category === 'website_access');
  const canRequest = departmentAllows(data, 'websiteAccessRequest');
  return (
    <>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">WEB ACCESS</p><h2>Your access and restrictions</h2></div></div>
        <div className="integration-notice"><strong>Website filtering is not connected</strong><p>{data.webAccess.message} Current permissions and website category restrictions cannot be queried or enforced by this deployment.</p></div>
        {canRequest && <form className="operations-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          void submit(event, '/staff-portal/requests', {
            category: 'website_access',
            website: form.get('website'),
            websiteCategory: form.get('websiteCategory'),
            temporaryUntil: new Date(String(form.get('temporaryUntil'))).toISOString(),
            description: [
              `Business justification: ${form.get('businessJustification')}`,
              `Reason for access: ${form.get('accessReason')}`,
              form.get('comments') ? `Additional comments: ${form.get('comments')}` : '',
            ].filter(Boolean).join('\n'),
          }, 'Website access request sent for administrator review. It will not change filtering without an integration.');
        }}>
          <h3>Request website access</h3>
          <div className="field-grid">
            <label>Website<input name="website" type="url" required maxLength={253} placeholder="https://example.com" /></label>
            <label>Category<select name="websiteCategory"><option value="">Not sure</option><option>Work</option><option>Research</option><option>Training</option><option>Other</option></select></label>
            <label>Access needed until<input name="temporaryUntil" type="datetime-local" required /></label>
          </div>
          <label>Business justification<textarea name="businessJustification" required minLength={5} maxLength={1000} rows={2} /></label>
          <label>Why do you need access to this website?<textarea name="accessReason" required minLength={5} maxLength={1000} rows={2} /></label>
          <label>Additional comments (optional)<textarea name="comments" maxLength={1000} rows={2} /></label>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Submitting…' : 'Submit access request'}</button></div>
        </form>}
      </section>
      <RequestList requests={requests} />
    </>
  );
}

function SecuritySection({
  data,
  reports,
  saving,
  submit,
}: {
  data: StaffPortalOverview;
  reports: PersonalSecurityReport[];
  saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, endpoint: string, body: unknown, success: string) => Promise<void>;
}) {
  const canReport = departmentAllows(data, 'securityReport');
  return (
    <>
      {canReport && <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">REPORT A CONCERN</p><h2>Security centre</h2></div></div>
        <p className="muted">Reports are visible to authorised administrators and security responders. Do not include passwords or MFA recovery codes.</p>
        <form className="operations-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          void submit(event, '/staff-portal/reports', {
            category: form.get('category'),
            title: form.get('title'),
            description: form.get('description'),
          }, 'Your security report was submitted to the incident response team.');
        }}>
          <div className="field-grid">
            <label>Report type<select name="category"><option value="suspicious_email">Suspicious email / phishing</option><option value="security_incident">Security incident</option><option value="suspected_malware">Suspected malware</option><option value="suspicious_device">Suspicious device</option></select></label>
            <label>Short title<input name="title" required minLength={5} maxLength={120} /></label>
          </div>
          <label>What did you notice?<textarea name="description" required minLength={5} maxLength={2000} rows={4} /></label>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Submitting…' : 'Send security report'}</button></div>
        </form>
      </section>}
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">SECURITY AWARENESS</p><h2>Helpful reminders</h2></div></div>
        <ul className="portal-list">
          <li><strong>Pause before opening unexpected links</strong><p>Check the sender and destination before opening links or attachments. Use the report form above when unsure.</p></li>
          <li><strong>Protect your sign-in</strong><p>Use a unique password and never share it with colleagues or support staff.</p></li>
          <li><strong>Keep work devices safe</strong><p>Lock screens when stepping away and report lost devices promptly.</p></li>
        </ul>
        <a className="button secondary" href="/app/training">View assigned training</a>
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">YOUR REPORTS</p><h2>Security reports</h2></div></div>
        {reports.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Report</th><th>Status</th><th>Severity</th><th>Submitted</th></tr></thead>
          <tbody>{reports.map((report) => <tr key={report.id}>
            <td><strong>{report.title}</strong><small>Report ID: {report.id} · {displayStatus(report.reportCategory ?? 'security incident')}</small><small>{report.summary}</small></td>
            <td><span className={`status-badge status-${statusClass(report.status)}`}>{displayStatus(report.status)}</span></td>
            <td>{displayStatus(report.severity)}</td>
            <td>{new Date(report.openedAt).toLocaleDateString()}</td>
          </tr>)}</tbody>
        </table></div> : <p className="empty-state">You have not submitted any security reports.</p>}
      </section>
    </>
  );
}

function RequestsSection({
  data,
  saving,
  submit,
}: {
  data: StaffPortalOverview;
  saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, endpoint: string, body: unknown, success: string) => Promise<void>;
}) {
  const permittedCategories = requestCategories.filter(([category]) =>
    departmentAllows(data, permissionForRequest[category]),
  );
  return (
    <>
      {permittedCategories.length > 0 && <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">REQUESTS & SUPPORT</p><h2>Submit a request</h2></div></div>
        <form className="operations-form" onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          void submit(event, '/staff-portal/requests', {
            category: form.get('category'),
            description: form.get('description'),
            ...(form.get('website') ? { website: form.get('website') } : {}),
            ...(form.get('websiteCategory') ? { websiteCategory: form.get('websiteCategory') } : {}),
          }, 'Your request was submitted. You can track updates below.');
        }}>
          <div className="field-grid">
            <label>Request category<select name="category">{permittedCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Website (for web access)<input name="website" type="url" maxLength={253} placeholder="Optional" /></label>
          </div>
          <label>Description<textarea name="description" required minLength={5} maxLength={2000} rows={4} /></label>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">{saving ? 'Submitting…' : 'Submit request'}</button></div>
        </form>
      </section>}
      <RequestList requests={data.requests} />
    </>
  );
}

function RequestList({ requests }: { requests: StaffRequest[] }) {
  return (
    <section className="content-panel">
      <div className="panel-heading"><div><p className="eyebrow">TRACKING</p><h2>Your requests</h2></div><span className="muted">{requests.length} shown</span></div>
      {requests.length ? <div className="table-scroll"><table className="operations-table">
        <thead><tr><th>Request</th><th>Status</th><th>Submitted</th><th>Assigned administrator</th><th>Administrator response</th><th>Resolved</th></tr></thead>
        <tbody>{requests.map((request) => (
          <tr key={request.id}>
            <td><strong>{displayStatus(request.category)}</strong><small>Request ID: {request.id}</small><small>{request.website || request.description}</small></td>
            <td><span className={`status-badge status-${statusClass(request.status)}`}>{displayStatus(request.status)}</span></td>
            <td>{new Date(request.createdAt).toLocaleDateString()}</td>
            <td>{request.assignedAdmin?.displayName ?? 'Not assigned'}</td>
            <td>{request.adminResponse || 'Awaiting response'}</td>
            <td>{request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString() : '—'}</td>
          </tr>
        ))}</tbody>
      </table></div> : <p className="empty-state">You have not submitted any requests.</p>}
    </section>
  );
}

function NotificationsSection({ items, onMarkRead }: { items: StaffNotification[]; onMarkRead: (id: string) => Promise<void> }) {
  return (
    <section className="content-panel">
      <div className="panel-heading"><div><p className="eyebrow">NOTIFICATION CENTRE</p><h2>Your notifications</h2></div><span className="muted">{items.filter((item) => !item.readAt).length} unread</span></div>
      {items.length ? <ul className="portal-list">
        {items.map((item) => (
          <li key={item.id} className={item.readAt ? '' : 'portal-notification-unread'}>
            <strong>{item.title}</strong><p>{item.body}</p><small>{displayStatus(item.category)} · {new Date(item.createdAt).toLocaleString()}</small>
            {!item.readAt && <button className="button secondary" onClick={() => void onMarkRead(item.id)} type="button">Mark as read</button>}
          </li>
        ))}
      </ul> : <p className="empty-state">You are all caught up. New alerts and request updates will appear here.</p>}
    </section>
  );
}

function TrainingSection({
  assignments,
  onReload,
  setError,
  setNotice,
}: {
  assignments: StaffTrainingAssignment[];
  onReload: () => Promise<void>;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [savingId, setSavingId] = useState('');

  async function complete(event: FormEvent<HTMLFormElement>, assignment: StaffTrainingAssignment) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingId(assignment.id);
    try {
      const result = await apiJson<{ score: number; passed: boolean }>(
        `/staff-portal/training/${assignment.id}/completions`,
        { method: 'POST', body: JSON.stringify({ answers: answers[assignment.id] ?? [] }) },
      );
      setNotice(result.passed ? `Course completed with a score of ${result.score}%.` : `Your score was ${result.score}%. Review the course and try again.`);
      await onReload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your training quiz.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="content-panel">
      <div className="panel-heading"><div><p className="eyebrow">SECURITY AWARENESS</p><h2>Assigned training</h2></div><span className="muted">{assignments.length} courses</span></div>
      {assignments.length ? <div className="training-courses">
        {assignments.map((assignment) => (
          <article className="training-course" key={assignment.id}>
            <div className="panel-heading"><div><h3>{assignment.course.title}</h3><p className="muted">{assignment.course.summary}</p></div>
              {assignment.completion && <span className={`status-badge status-${assignment.completion.passed ? 'active' : 'attention'}`}>{assignment.completion.passed ? `Passed · ${assignment.completion.score}%` : `Score · ${assignment.completion.score}%`}</span>}
            </div>
            {assignment.dueAt && <p className="muted">Due {new Date(assignment.dueAt).toLocaleDateString()}</p>}
            <div className="training-content">{assignment.course.content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <form className="operations-form" onSubmit={(event) => void complete(event, assignment)}>
              <h4>Knowledge check</h4>
              {assignment.course.questions.map((question, questionIndex) => (
                <fieldset className="quiz-question" key={`${assignment.id}-${questionIndex}`}>
                  <legend>{questionIndex + 1}. {question.prompt}</legend>
                  {question.options.map((option, optionIndex) => (
                    <label className="quiz-option" key={optionIndex}>
                      <input
                        type="radio"
                        name={`${assignment.id}-question-${questionIndex}`}
                        checked={answers[assignment.id]?.[questionIndex] === optionIndex}
                        onChange={() => setAnswers((current) => {
                          const currentAnswers = current[assignment.id] ?? [];
                          const nextAnswers = [...currentAnswers];
                          nextAnswers[questionIndex] = optionIndex;
                          return { ...current, [assignment.id]: nextAnswers };
                        })}
                        required
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div className="form-actions"><button className="button primary" disabled={savingId === assignment.id} type="submit">{savingId === assignment.id ? 'Submitting…' : assignment.completion ? 'Retake quiz' : 'Complete training'}</button></div>
            </form>
          </article>
        ))}
      </div> : <p className="empty-state">No training has been assigned to your account.</p>}
    </section>
  );
}

function AccountSection({
  data,
  sessions,
  loginEvents,
  saving,
  setSaving,
  setError,
  setNotice,
  onProfileSubmit,
  onRevokeSession,
}: {
  data: StaffPortalOverview;
  sessions: OwnSession[];
  loginEvents: OwnLoginEvent[];
  saving: boolean;
  setSaving: (value: boolean) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  onProfileSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRevokeSession: (id: string) => Promise<void>;
}) {
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    formElement.reset();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/staff-portal/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setNotice('Password changed. Other active sessions were signed out.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Unable to change your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">PROFILE</p><h2>Your details</h2></div></div>
        <form className="operations-form" onSubmit={(event) => void onProfileSubmit(event)}>
          <div className="field-grid">
            <label>Display name<input name="displayName" required minLength={2} maxLength={80} defaultValue={data.profile.displayName} /></label>
            <label>Work email<input value={data.profile.email} disabled readOnly /></label>
            <label>Job title<input name="jobTitle" maxLength={100} defaultValue={data.profile.jobTitle ?? ''} /></label>
            <label>Department<input value={data.profile.department?.name ?? 'Not assigned'} disabled readOnly /></label>
          </div>
          <fieldset className="preference-options"><legend>Notification preferences</legend>
            <label><input name="inAppNotifications" type="checkbox" defaultChecked={data.profile.notificationPreferences.inApp !== false} /> In-app notifications</label>
            <label><input name="emailNotifications" type="checkbox" defaultChecked={data.profile.notificationPreferences.email === true} /> Email notifications (delivery is not configured)</label>
          </fieldset>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">Save profile</button></div>
        </form>
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">PASSWORD</p><h2>Change your password</h2></div></div>
        <form className="operations-form" onSubmit={(event) => void changePassword(event)}>
          <div className="field-grid">
            <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
            <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          </div>
          <p className="muted">Use at least 12 characters. Passwords are sent only to the API over the authenticated request and are not retained in the page after submission.</p>
          <div className="form-actions"><button className="button primary" disabled={saving} type="submit">Change password</button></div>
        </form>
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">MULTI-FACTOR AUTHENTICATION</p><h2>MFA status</h2></div></div>
        <div className="integration-notice"><strong>MFA is not configured</strong><p>This deployment uses local passwords and does not have an identity provider or MFA service connected. StayShield does not collect or store MFA secrets.</p></div>
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">ACTIVE SESSIONS</p><h2>Your sessions</h2></div></div>
        {sessions.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Started</th><th>Expires</th><th>Session</th><th>Action</th></tr></thead>
          <tbody>{sessions.map((session) => <tr key={session.id}>
            <td>{new Date(session.createdAt).toLocaleString()}</td><td>{new Date(session.expiresAt).toLocaleString()}</td>
            <td>{session.current ? 'This session' : 'Other session'}</td>
            <td>{session.current ? 'Current' : <button className="button secondary" onClick={() => void onRevokeSession(session.id)} type="button">Sign out</button>}</td>
          </tr>)}</tbody>
        </table></div> : <p className="empty-state">No active sessions.</p>}
      </section>
      <section className="content-panel">
        <div className="panel-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2>Recent login history</h2></div></div>
        {loginEvents.length ? <div className="table-scroll"><table className="operations-table">
          <thead><tr><th>Activity</th><th>Date and time</th><th>Source IP</th></tr></thead>
          <tbody>{loginEvents.map((event) => <tr key={event.id}>
            <td>{displayStatus(event.action.replace('auth.', ''))}</td>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
            <td>{event.sourceIp ?? 'Not available'}</td>
          </tr>)}</tbody>
        </table></div> : <p className="empty-state">No login history is available for your account.</p>}
      </section>
    </>
  );
}

function displayStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function departmentAllows(data: StaffPortalOverview, permission: string) {
  const department = data.profile.department;
  return !department || (department.isActive && department.permissions.includes(permission));
}
