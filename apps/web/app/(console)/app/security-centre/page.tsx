import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function SecurityCentrePage() {
  return <ConsolePage active="/app/security-centre" eyebrow="EMPLOYEE PORTAL" title="Security centre"><StaffPortalWorkspace section="security" /></ConsolePage>;
}
