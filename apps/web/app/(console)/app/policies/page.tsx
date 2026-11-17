import { ConsolePage } from '../../../../components/console-provider';
import { PoliciesPage } from '../../../../components/operations/policies';

export default function PoliciesRoute() {
  return (
    <ConsolePage active="/app/policies" eyebrow="SECURITY GOVERNANCE" title="Policies">
      <PoliciesPage />
    </ConsolePage>
  );
}
