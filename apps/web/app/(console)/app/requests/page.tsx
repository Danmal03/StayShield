import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function RequestsPage() {
  return <ConsolePage active="/app/requests" eyebrow="EMPLOYEE PORTAL" title="Requests and support"><StaffPortalWorkspace section="requests" /></ConsolePage>;
}
