export type Account = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: string[];
};

export type StaffAccount = {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
  department: { id: string; name: string } | null;
};

export type Device = {
  id: string;
  name: string;
  category: string;
  location: string;
  ipAddress: string;
  status: string;
  lastSeenAt: string;
};

export type SecurityEvent = {
  id: string;
  title: string;
  description: string;
  source: string;
  severity: string;
  status: string;
  occurredAt: string;
};

export type Policy = {
  id: string;
  name: string;
  summary: string;
  status: string;
};

export type Incident = {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  openedAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId?: string | null;
  sourceIp: string | null;
  createdAt: string;
  actor?: { displayName: string } | null;
};

export type AuditFlag = {
  userId: string;
  displayName: string;
  signals: Array<{
    type: 'failed_sign_ins' | 'denied_requests' | 'record_changes';
    count: number;
    threshold: number;
    windowMinutes: number;
    lastOccurredAt: string;
  }>;
};

export type AuditActor = {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
  actionCount: number;
};

export type AuditActors = {
  administrators: AuditActor[];
  users: AuditActor[];
};

export type AuditActorHistory = {
  entries: AuditEntry[];
  nextCursor: string | null;
};

export type Workspace = {
  tenantName: string;
  propertyName: string;
  summary: {
    staff: number;
    devicesOnline: number;
    devicesAttention: number;
    openEvents: number;
    openIncidents: number;
    policies: number;
  };
  devices: Device[] | null;
  events: SecurityEvent[] | null;
  policies: Policy[] | null;
  incidents: Incident[] | null;
  audit: AuditEntry[] | null;
};

export type StaffRequest = {
  id: string;
  category: string;
  description: string;
  website: string | null;
  websiteCategory: string | null;
  temporaryUntil: string | null;
  status: string;
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assignedAdmin?: { displayName: string } | null;
};

export type StaffNotification = {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NetworkConnection = {
  id: string;
  source: string;
  connectionType: string;
  ssid: string | null;
  carrierName: string | null;
  ipAddress: string | null;
  networkSegment: string | null;
  accessPoint: string | null;
  securityStatus: string;
  status: string;
  verificationStatus: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSeenAt: string;
};

export type CurrentNetworkConnection = {
  status: 'connected' | 'disconnected' | 'unverified' | 'not_configured';
  connection: NetworkConnection | null;
  updatedAt: string | null;
};

export type NetworkIntegrationStatus = {
  status: 'available' | 'unverified' | 'not_configured';
  configured: boolean;
  sources: string[];
  lastEventAt: string | null;
  freshnessSeconds: number;
};

export type NetworkConnectionHistoryItem = NetworkConnection & {
  status: 'connected' | 'disconnected' | 'unverified';
};

export type PersonalSecurityReport = {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  reportCategory: string | null;
  openedAt: string;
};

export type TrainingQuestion = {
  prompt: string;
  options: string[];
};

export type StaffTrainingAssignment = {
  id: string;
  dueAt: string | null;
  createdAt: string;
  completion: { score: number; passed: boolean; completedAt: string } | null;
  course: {
    id: string;
    title: string;
    summary: string;
    content: string;
    passingScore: number;
    questions: TrainingQuestion[];
    isPublished: boolean;
  };
};

export type StaffPortalOverview = {
  profile: {
    id: string;
    displayName: string;
    email: string;
    createdAt: string;
    jobTitle: string | null;
    department: { id: string; name: string; permissions: string[]; isActive: boolean } | null;
    notificationPreferences: Record<string, boolean>;
  };
  summary: {
    registeredDevices: number;
    pendingRequests: number;
    unreadNotifications: number;
    assignedTraining: number;
    activeSessions: number;
  };
  devices: Array<{
    id: string;
    name: string;
    deviceType: string;
    operatingSystem: string;
    status: string;
    connectionStatus: string;
    endpointProtectionStatus: string;
    encryptionStatus: string;
    complianceStatus: string;
    assignedIp?: string | null;
    networkSegment?: string | null;
    createdAt: string;
  }>;
  requests: StaffRequest[];
  trainingAssignments: StaffTrainingAssignment[];
  notifications: StaffNotification[];
  announcements: Array<{ id: string; title: string; body: string; createdAt: string }>;
  securityScore: { score: number; calculatedAt: string } | null;
  webAccess: { providerConnected: boolean; policyStatus: string; message: string };
  recentActivity: Array<{ id: string; title: string; category: string; status: string; occurredAt: string }>;
};
