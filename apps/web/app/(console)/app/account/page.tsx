import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function MyAccountPage() {
  return <ConsolePage active="/app/account" eyebrow="EMPLOYEE PORTAL" title="My security account"><StaffPortalWorkspace section="account" /></ConsolePage>;
}
