import 'reflect-metadata';
import { SystemRole } from '@prisma/client';
import { IS_PUBLIC, REQUIRED_ROLES } from '../src/auth/auth.constants';
import {
  NetworkMonitoringController,
  NetworkProviderController,
} from '../src/network-monitoring/network-monitoring.controller';

describe('NetworkMonitoringController permissions', () => {
  it('exposes staff endpoints without employee-id parameters', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.current)).toBeUndefined();
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.history)).toBeUndefined();
    expect(NetworkMonitoringController.prototype.current.length).toBe(1);
    expect(NetworkMonitoringController.prototype.history.length).toBe(1);
  });

  it('limits tenant-wide monitoring and integration setup to authorised administrators', () => {
    const expected = [
      SystemRole.SYSTEM_OWNER,
      SystemRole.SECURITY_ADMINISTRATOR,
      SystemRole.NETWORK_ADMINISTRATOR,
    ];
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.adminSessions)).toEqual(expected);
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.adminIntegrations)).toEqual(expected);
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.createIntegration)).toEqual(expected);
    expect(Reflect.getMetadata(REQUIRED_ROLES, NetworkMonitoringController.prototype.disableIntegration)).toEqual(expected);
  });

  it('allows provider events only through the dedicated public token-authenticated endpoint', () => {
    expect(Reflect.getMetadata(IS_PUBLIC, NetworkProviderController.prototype.ingest)).toBe(true);
  });
});
