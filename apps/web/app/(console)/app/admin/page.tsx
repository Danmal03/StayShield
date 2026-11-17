import { ConsolePage } from '../../../../components/console-provider';
import { NetworkDevicesPage } from '../../../../components/operations/network-devices';
import { StaffAccountsPage } from '../../../../components/operations/staff-accounts';
import { StaffPortalAdmin } from '../../../../components/operations/staff-portal-admin';

export default function AdminPage() {
  return (
    <ConsolePage active="/app/admin" adminOnly eyebrow="ADMINISTRATION" title="Administration">
      <nav className="admin-section-nav" aria-label="Administration sections">
        <a href="#staff-accounts">Staff accounts</a>
        <a href="#device-inventory">Network inventory</a>
        <a href="#employee-requests">Employee requests</a>
        <a href="#device-approvals">Device registrations</a>
        <a href="#employee-portal">Employee portal</a>
      </nav>
      <section id="staff-accounts" className="admin-section">
        <StaffAccountsPage />
      </section>
      <section id="device-inventory" className="admin-section">
        <NetworkDevicesPage />
      </section>
      <section id="employee-portal" className="admin-section">
        <StaffPortalAdmin />
      </section>
    </ConsolePage>
  );
}
