import { ConsolePage } from '../../../../components/console-provider';
import { AuditTrailPage } from '../../../../components/operations/audit-trail';

export default function AuditPage() {
  return (
    <ConsolePage active="/app/audit" eyebrow="ACTIVITY RECORDS" title="Audit trail">
      <AuditTrailPage />
    </ConsolePage>
  );
}
