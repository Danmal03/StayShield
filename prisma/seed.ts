import * as argon2 from 'argon2';
import { PrismaClient, SystemRole } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env') });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const tenantName = process.env.SEED_TENANT_NAME?.trim();

  if (!email || !password || !tenantName || password.length < 16) {
    throw new Error(
      'Set SEED_OWNER_EMAIL, SEED_TENANT_NAME, and a SEED_OWNER_PASSWORD of at least 16 characters.',
    );
  }

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: { name: tenantName },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: tenantName,
    },
  });
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { displayName: 'StayShield System Owner', passwordHash, isActive: true },
    create: {
      tenantId: tenant.id,
      email,
      displayName: 'StayShield System Owner',
      passwordHash,
    },
  });

  await prisma.roleAssignment.upsert({
    where: {
      userId_tenantId_role: {
        userId: user.id,
        tenantId: tenant.id,
        role: SystemRole.SYSTEM_OWNER,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: SystemRole.SYSTEM_OWNER,
    },
  });

  const propertyName = 'Main Hotel';
  await prisma.property.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: propertyName } },
    update: {},
    create: { tenantId: tenant.id, name: propertyName },
  });

  const departmentPermissions = [
    'websiteAccessRequest',
    'deviceRegistration',
    'networkSupport',
    'accountAssistance',
    'lostDeviceReport',
    'securityReport',
    'supportRequest',
    'training',
  ];
  const departments = [
    'Reception',
    'Finance',
    'Human Resources',
    'Housekeeping',
    'Management',
    'Food and Beverage',
    'Maintenance',
    'IT',
  ];
  for (const name of departments) {
    await prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name,
        description: `${name} department`,
        permissions: departmentPermissions,
      },
    });
  }

  const existingDevice = await prisma.networkDevice.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!existingDevice) {
    const now = Date.now();
    await prisma.networkDevice.createMany({
      data: [
        { tenantId: tenant.id, name: 'Front desk POS', category: 'Point of sale', location: 'Reception', ipAddress: '10.20.1.10', status: 'online', lastSeenAt: new Date(now - 2 * 60_000) },
        { tenantId: tenant.id, name: 'Guest Wi-Fi controller', category: 'Network', location: 'Comms room', ipAddress: '10.20.1.2', status: 'online', lastSeenAt: new Date(now - 60_000) },
        { tenantId: tenant.id, name: 'CCTV recorder', category: 'Physical security', location: 'Security office', ipAddress: '10.20.4.15', status: 'attention', lastSeenAt: new Date(now - 45 * 60_000) },
        { tenantId: tenant.id, name: 'Door access panel', category: 'Access control', location: 'Staff entrance', ipAddress: '10.20.4.21', status: 'online', lastSeenAt: new Date(now - 5 * 60_000) },
      ],
    });
    await prisma.securityEvent.createMany({
      data: [
        { tenantId: tenant.id, title: 'Repeated sign-in failures on the property system', source: 'Front desk POS', severity: 'high', status: 'open', occurredAt: new Date(now - 35 * 60_000) },
        { tenantId: tenant.id, title: 'Guest network device joined an unexpected segment', source: 'Guest Wi-Fi controller', severity: 'medium', status: 'open', occurredAt: new Date(now - 3 * 60 * 60_000) },
        { tenantId: tenant.id, title: 'Door access panel checked in', source: 'Door access panel', severity: 'low', status: 'closed', occurredAt: new Date(now - 26 * 60 * 60_000) },
      ],
    });
    await prisma.securityPolicy.createMany({
      data: [
        { tenantId: tenant.id, name: 'Guest network isolation', summary: 'Guest Wi-Fi stays separate from payments, door access, and staff systems.', status: 'active' },
        { tenantId: tenant.id, name: 'Privileged staff access', summary: 'Administrator accounts are named, approved, and removed when a role changes.', status: 'active' },
        { tenantId: tenant.id, name: 'Camera retention', summary: 'CCTV is kept only for the agreed retention window and reviewed by authorised staff.', status: 'review' },
      ],
    });
    await prisma.incident.createMany({
      data: [
        { tenantId: tenant.id, title: 'CCTV recorder needs attention', summary: 'The recorder missed its last check-in. IT support should confirm power and storage.', severity: 'medium', status: 'investigating', openedAt: new Date(now - 50 * 60_000) },
        { tenantId: tenant.id, title: 'After-hours door held open', summary: 'Staff entrance stayed open past the allowed window. Closed after a security walk-through.', severity: 'low', status: 'closed', openedAt: new Date(now - 2 * 24 * 60 * 60_000) },
      ],
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorId: user.id,
      action: 'system.seeded',
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
