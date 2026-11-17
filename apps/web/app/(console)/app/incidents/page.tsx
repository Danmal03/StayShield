import { ConsolePage } from '../../../../components/console-provider';
import { IncidentsPage } from '../../../../components/operations/incidents';

export default function IncidentsRoute() {
  return (
    <ConsolePage active="/app/incidents" eyebrow="RESPONSE MANAGEMENT" title="Incidents">
      <IncidentsPage />
    </ConsolePage>
  );
}
