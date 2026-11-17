import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function MyDevicesPage() {
  return <ConsolePage active="/app/devices" eyebrow="EMPLOYEE PORTAL" title="My devices"><StaffPortalWorkspace section="devices" /></ConsolePage>;
}
