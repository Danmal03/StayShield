import { ConsolePage } from '../../../../components/console-provider';
import { NetworkMonitoringAdmin } from '../../../../components/operations/network-monitoring-admin';

export default function NetworkMonitoringPage() {
  return (
    <ConsolePage
      active="/app/network"
      eyebrow="NETWORK OPERATIONS"
      title="Network monitoring"
      networkAdminOnly
    >
      <NetworkMonitoringAdmin />
    </ConsolePage>
  );
}
