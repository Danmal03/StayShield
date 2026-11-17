import { ConsolePage } from '../../../../components/console-provider';
import { SecurityEventsPage } from '../../../../components/operations/security-events';

export default function EventsPage() {
  return (
    <ConsolePage active="/app/events" eyebrow="DETECTION & TRIAGE" title="Security events">
      <SecurityEventsPage />
    </ConsolePage>
  );
}
