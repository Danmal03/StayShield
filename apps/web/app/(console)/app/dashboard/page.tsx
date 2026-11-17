'use client';

import Link from 'next/link';
import { ConsolePage, useConsoleContext } from '../../../../components/console-provider';
import { StaffPortalDashboard } from '../../../../components/staff-portal/staff-portal-dashboard';
import { AuditDashboardSummary } from '../../../../components/operations/audit-dashboard-summary';
import { isAdmin } from '../../../../lib/roles';

export default function DashboardPage() {
  const { user, workspace } = useConsoleContext();
  const summary = workspace?.summary;

  if (!user) {
    return <ConsolePage active="/app/dashboard" eyebrow="YOUR WORKSPACE" title="My dashboard">{null}</ConsolePage>;
  }

  if (!isAdmin(user.roles) && user.roles.includes('AUDITOR')) {
    return (
      <ConsolePage active="/app/dashboard" eyebrow="SECURITY OPERATIONS" title="Audit overview">
        <AuditDashboardSummary />
      </ConsolePage>
    );
  }

  if (!isAdmin(user.roles)) {
    return (
      <ConsolePage active="/app/dashboard" eyebrow="YOUR WORKSPACE" title="My dashboard">
        <StaffPortalDashboard />
      </ConsolePage>
    );
  }

  return (
    <ConsolePage active="/app/dashboard" eyebrow="SECURITY OPERATIONS" title="Overview">
      <div className="welcome-panel dashboard-welcome">
        <div className="status-dot" aria-hidden="true" />
        <div>
          <p className="eyebrow">{workspace?.tenantName ?? 'SECURE WORKSPACE'}</p>
          <h2>{workspace?.propertyName ?? 'Operations overview'}</h2>
          <p>Manage staff access, oversee the device inventory, and review hotel security operations.</p>
        </div>
      </div>

      <div className="metric-grid">
      <Link className="metric-card metric-link" href="/app/admin#device-inventory"><span>Devices online</span><strong>{summary?.devicesOnline ?? 0}</strong><small>{summary?.devicesAttention ?? 0} needing attention</small></Link>
        <Link className="metric-card metric-link" href="/app/events"><span>Open security events</span><strong>{summary?.openEvents ?? 0}</strong><small>Review and triage</small></Link>
        <Link className="metric-card metric-link" href="/app/incidents"><span>Open incidents</span><strong>{summary?.openIncidents ?? 0}</strong><small>Track response work</small></Link>
        <Link className="metric-card metric-link" href="/app/policies"><span>Security policies</span><strong>{summary?.policies ?? 0}</strong><small>Manage policy records</small></Link>
      </div>

      <AuditDashboardSummary />

      <section className="content-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">WORKSPACE</p><h2>Operational areas</h2></div>
        </div>
        <div className="area-grid">
          <Link className="area-card" href="/app/admin#device-inventory"><strong>Network &amp; devices</strong><span>Maintain the local device inventory and status.</span></Link>
          <Link className="area-card" href="/app/events"><strong>Security events</strong><span>Record security observations and manage triage.</span></Link>
          <Link className="area-card" href="/app/policies"><strong>Policies</strong><span>Draft, activate, review, or archive policy records.</span></Link>
          <Link className="area-card" href="/app/incidents"><strong>Incidents</strong><span>Open incidents and track response through closure.</span></Link>
          <Link className="area-card" href="/app/admin#employee-requests"><strong>Employee requests</strong><span>Review website access, support requests, and pending device registrations.</span></Link>
        </div>
        <p className="privacy-note">These are manual, in-app records. No network devices or external monitoring systems are queried automatically.</p>
      </section>
    </ConsolePage>
  );
}
