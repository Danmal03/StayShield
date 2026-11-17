import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function MyActivityPage() {
  return <ConsolePage active="/app/activity" adminOnly eyebrow="NETWORK MONITORING" title="Network activity"><StaffPortalWorkspace section="activity" /></ConsolePage>;
}
