import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function WebAccessPage() {
  return <ConsolePage active="/app/web-access" eyebrow="EMPLOYEE PORTAL" title="My web access"><StaffPortalWorkspace section="web-access" /></ConsolePage>;
}
