# StayShield

StayShield is a privacy-aware hotel network and cybersecurity management platform. It is designed to integrate with existing security products and does not intercept encrypted web traffic or collect private content.

## Current implementation status

This repository starts from an empty workspace. The initial foundation includes:

- Next.js / React / TypeScript web application with landing, sign-in, and protected workspace pages.
- NestJS REST API with Swagger documentation, request validation, security headers, CORS allowlisting, and rate-limiter support.
- PostgreSQL / Prisma data model for tenants, properties, users, roles, invitations, sessions, and audit events.
- Argon2id password hashing, database-backed opaque sessions, secure HttpOnly cookies, login lockout, and server-side role guard foundations.
- Staff-account provisioning and a tenant-scoped audit trail for authenticated API reads, authentication, permission denials, and operational changes, with recent-activity review flags on administrator and auditor dashboards.
- Role-specific dashboards: staff use a simplified home and role-based work areas; the administrator console owns staff provisioning and network inventory.
- Employee self-service portal for personal device-registration requests, support and access requests, security reports, announcements, assigned quiz training, notifications, profile settings, password changes, login history, and session revocation.
- Tenant-scoped department configuration and administrator workflows for reviewing employee requests, device registrations, announcements, and training assignments.
- Manual, tenant-scoped operations for network-device inventory, security-event triage, policy records, and incident response, with role-based access and audit entries.
- Docker Compose services for PostgreSQL and Redis.

This is an early-stage foundation, not a production-ready security platform. The employee portal returns only records owned by the authenticated user; administrator review endpoints are separately role-gated and tenant-scoped. The operations pages use manually entered records; they do not discover devices, ingest monitoring feeds, or connect to third-party systems. The employee portal therefore marks network/IP activity, website policy enforcement, endpoint protection, encryption verification, email delivery, MFA, and identity-provider flows as unavailable until a real provider is configured. Website request approval is a local workflow only and does not change network filtering. Invitations and SSO, live monitoring connectors, automated alerts, report generation, retention workflows, and production hardening remain future implementation work.

## Repository structure

- `apps/web/app/` — Next.js App Router with `(public)`, `(auth)`, `(setup)`, and `(console)` route groups; individual future routes are scaffolded under these groups.
- `apps/web/components/`, `features/`, `hooks/`, `lib/`, `styles/`, and `tests/` — frontend presentation, feature, and shared code.
- `apps/api/src/` — NestJS API modules for authentication, health, users, roles, network, policies, integrations, alerts, incidents, audit, privacy, and reporting.
- `apps/worker/src/` — reserved for BullMQ jobs, processors, schedulers, and event processing; no jobs are consumed yet.
- `connectors/` — vendor-specific Microsoft 365, firewall/DNS, Wi-Fi/NAC, EDR/MDM, and syslog/flow adapters.
- `packages/` — shared UI, contracts, configuration, security, and integration SDK packages.
- `prisma/` — central Prisma schema, migrations, and local development seed.
- `infrastructure/`, `docs/`, `tests/`, `scripts/`, and `.github/workflows/` — deployment, architecture/operations, test, automation, and CI areas.

Directories containing only `.gitkeep` are structural placeholders, not implemented product features.

## Prerequisites

- Node.js 20.11 or newer and npm.
- Docker Desktop with Docker Compose.

## Local setup

1. Copy `.env.example` to `.env` and set a unique owner password of at least 16 characters.
2. Set `POSTGRES_PASSWORD` in `.env` to a local-only password and update `DATABASE_URL` to match it.
3. Start dependencies with `docker compose up -d`.
4. Install packages with `npm install`.
5. Generate Prisma Client and apply the database schema with `npm run db:generate` and `npm run db:migrate`. Re-run both commands after pulling schema changes. Stop the API process before regenerating Prisma Client on Windows to avoid a locked query-engine file.
6. Create the local owner and default property with `npm run db:seed`.
7. Start the API and web application with `npm run dev`.
8. Open `http://localhost:3000`; API documentation is at `http://localhost:4000/api/docs`.

The seed command is only for local development. Do not use default credentials or expose local database ports in production.

## Environment and deployment notes

`docker-compose.yml` provides only PostgreSQL and Redis for local development. The API and web app are run from the host. A production deployment still needs TLS termination, secrets management, database backups, Redis access controls, monitoring, dependency scanning, and a reviewed deployment topology. Do not expose the database or Redis to public networks.

Sessions use random opaque values in an HttpOnly, SameSite=Strict cookie; only a SHA-256 digest is stored in PostgreSQL. Passwords use Argon2id. Authentication changes are recorded in the audit table. Use HTTPS in production (`NODE_ENV=production` enables the Secure cookie flag). Account invitations must be provisioned through a future authenticated invitation workflow; public registration is intentionally absent.

The audit trail records successful authenticated API reads by route, existing audited changes, authentication events, and role-based permission denials. Authorized administrators and auditors can browse the tenant's accounts in administrator/user groups and review each account's complete activity history in pages. It does not record request bodies, query strings, or arbitrary UI clicks. Accounts are flagged for human review after 5 failed sign-ins in 15 minutes, 3 denied requests in 10 minutes, or 10 audited record changes in 5 minutes. These are review signals, not determinations of misconduct, and are limited to the active time windows.

## Privacy and security

Only connect synthetic development data until you have explicit authorisation and an approved privacy/legal basis. Guest and corporate network policies must remain distinct. Network metadata may identify destination domains but does not reveal every action within encrypted websites. Do not deploy covert agents, capture private communications, or store provider credentials in logs.

Before any real hotel or Microsoft tenant integration, complete least-privilege permission review, data-protection impact assessment, notice/retention configuration, incident notification procedures, and security testing. Legal notification duties, including any applicable Zambian statutory timelines, must be assessed by the organisation's DPO and legal adviser.

## Development

Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`. The current test command runs the API role-guard unit tests; frontend and end-to-end suites are not implemented yet.

No live hotel network or Microsoft tenant is accessed by this application. Integrations will be added in later phases as clearly marked connector implementations.

## Employee portal notes

- Apply the `20261116194000_staff_security_portal` migration before starting the updated API; `npm run db:seed` provisions the configurable department defaults for the development tenant.
- Administrators can assign departments and permissions, review employee device and support requests, publish announcements, and create and assign training courses.
- Staff-owned API reads and updates are scoped by both the authenticated user and tenant. Staff submissions cannot set their owner, tenant, approval state, or administrator response.
- Local session history contains only sessions owned by the signed-in user. MFA controls, network activity, website filtering, and endpoint posture are not simulated or presented as live integrations.
