CREATE TABLE "NetworkIntegration" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEventAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NetworkIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NetworkConnectionSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID,
    "deviceId" UUID,
    "integrationId" UUID,
    "source" TEXT NOT NULL,
    "sourceSessionId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "ssid" TEXT,
    "carrierName" TEXT,
    "ipAddress" TEXT,
    "networkSegment" TEXT,
    "accessPoint" TEXT,
    "securityStatus" TEXT NOT NULL DEFAULT 'not_available',
    "status" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NetworkConnectionSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetworkIntegration_tokenHash_key" ON "NetworkIntegration"("tokenHash");
CREATE INDEX "NetworkIntegration_tenantId_isEnabled_source_idx" ON "NetworkIntegration"("tenantId", "isEnabled", "source");
CREATE INDEX "NetworkConnectionSession_tenantId_employeeId_status_lastSeenAt_idx" ON "NetworkConnectionSession"("tenantId", "employeeId", "status", "lastSeenAt");
CREATE INDEX "NetworkConnectionSession_tenantId_deviceId_status_lastSeenAt_idx" ON "NetworkConnectionSession"("tenantId", "deviceId", "status", "lastSeenAt");
CREATE INDEX "NetworkConnectionSession_tenantId_integrationId_sourceSessionId_lastSeenAt_idx" ON "NetworkConnectionSession"("tenantId", "integrationId", "sourceSessionId", "lastSeenAt");
CREATE INDEX "NetworkConnectionSession_tenantId_status_lastSeenAt_idx" ON "NetworkConnectionSession"("tenantId", "status", "lastSeenAt");

ALTER TABLE "NetworkIntegration" ADD CONSTRAINT "NetworkIntegration_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkIntegration" ADD CONSTRAINT "NetworkIntegration_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NetworkConnectionSession" ADD CONSTRAINT "NetworkConnectionSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkConnectionSession" ADD CONSTRAINT "NetworkConnectionSession_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NetworkConnectionSession" ADD CONSTRAINT "NetworkConnectionSession_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "PersonalDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NetworkConnectionSession" ADD CONSTRAINT "NetworkConnectionSession_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "NetworkIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
