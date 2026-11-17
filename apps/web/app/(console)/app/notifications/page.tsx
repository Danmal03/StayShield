import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function NotificationsPage() {
  return <ConsolePage active="/app/notifications" eyebrow="EMPLOYEE PORTAL" title="Notifications"><StaffPortalWorkspace section="notifications" /></ConsolePage>;
}
