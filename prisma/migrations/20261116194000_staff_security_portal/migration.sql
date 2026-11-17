CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffSecurityProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID,
    "jobTitle" TEXT,
    "notificationPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffSecurityProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonalDevice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "operatingSystem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "connectionStatus" TEXT NOT NULL DEFAULT 'unknown',
    "endpointProtectionStatus" TEXT NOT NULL DEFAULT 'unknown',
    "encryptionStatus" TEXT NOT NULL DEFAULT 'unknown',
    "complianceStatus" TEXT NOT NULL DEFAULT 'pending',
    "assignedIp" TEXT,
    "networkSegment" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT,
    "websiteCategory" TEXT,
    "temporaryUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedAdminId" UUID,
    "adminResponse" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAnnouncement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceDepartmentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityTrainingCourse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 80,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityTrainingCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingAssignment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "assignedById" UUID,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingCompletion" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffNotification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requestId" UUID,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeSecurityScore" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeSecurityScore_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Incident"
ADD COLUMN "reporterUserId" UUID,
ADD COLUMN "reportCategory" TEXT;

CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");
CREATE UNIQUE INDEX "StaffSecurityProfile_userId_key" ON "StaffSecurityProfile"("userId");
CREATE INDEX "StaffSecurityProfile_tenantId_departmentId_idx" ON "StaffSecurityProfile"("tenantId", "departmentId");
CREATE INDEX "PersonalDevice_tenantId_userId_status_idx" ON "PersonalDevice"("tenantId", "userId", "status");
CREATE INDEX "StaffRequest_tenantId_userId_createdAt_idx" ON "StaffRequest"("tenantId", "userId", "createdAt");
CREATE INDEX "StaffRequest_tenantId_status_createdAt_idx" ON "StaffRequest"("tenantId", "status", "createdAt");
CREATE INDEX "SecurityAnnouncement_tenantId_isActive_createdAt_idx" ON "SecurityAnnouncement"("tenantId", "isActive", "createdAt");
CREATE INDEX "SecurityTrainingCourse_tenantId_isPublished_idx" ON "SecurityTrainingCourse"("tenantId", "isPublished");
CREATE UNIQUE INDEX "TrainingAssignment_userId_courseId_key" ON "TrainingAssignment"("userId", "courseId");
CREATE INDEX "TrainingAssignment_tenantId_userId_dueAt_idx" ON "TrainingAssignment"("tenantId", "userId", "dueAt");
CREATE UNIQUE INDEX "TrainingCompletion_assignmentId_key" ON "TrainingCompletion"("assignmentId");
CREATE INDEX "TrainingCompletion_userId_completedAt_idx" ON "TrainingCompletion"("userId", "completedAt");
CREATE INDEX "StaffNotification_tenantId_userId_readAt_createdAt_idx" ON "StaffNotification"("tenantId", "userId", "readAt", "createdAt");
CREATE INDEX "EmployeeSecurityScore_tenantId_userId_calculatedAt_idx" ON "EmployeeSecurityScore"("tenantId", "userId", "calculatedAt");
CREATE INDEX "Incident_tenantId_reporterUserId_openedAt_idx" ON "Incident"("tenantId", "reporterUserId", "openedAt");

ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSecurityProfile" ADD CONSTRAINT "StaffSecurityProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSecurityProfile" ADD CONSTRAINT "StaffSecurityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSecurityProfile" ADD CONSTRAINT "StaffSecurityProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonalDevice" ADD CONSTRAINT "PersonalDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalDevice" ADD CONSTRAINT "PersonalDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalDevice" ADD CONSTRAINT "PersonalDevice_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAnnouncement" ADD CONSTRAINT "SecurityAnnouncement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityAnnouncement" ADD CONSTRAINT "SecurityAnnouncement_audienceDepartmentId_fkey" FOREIGN KEY ("audienceDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAnnouncement" ADD CONSTRAINT "SecurityAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityTrainingCourse" ADD CONSTRAINT "SecurityTrainingCourse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityTrainingCourse" ADD CONSTRAINT "SecurityTrainingCourse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "SecurityTrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeSecurityScore" ADD CONSTRAINT "EmployeeSecurityScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSecurityScore" ADD CONSTRAINT "EmployeeSecurityScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
