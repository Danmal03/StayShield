import { ConsolePage } from '../../../../components/console-provider';
import { StaffPortalWorkspace } from '../../../../components/staff-portal/staff-portal-workspace';

export default function TrainingPage() {
  return <ConsolePage active="/app/training" eyebrow="EMPLOYEE PORTAL" title="Security training"><StaffPortalWorkspace section="training" /></ConsolePage>;
}
