# Architecture overview

The repository is a pnpm/npm-workspaces monorepo. `apps/web` contains the Next.js interface, `apps/api` contains the NestJS REST API and Prisma schema is centralized under `prisma/`. `apps/worker` is reserved for BullMQ background processing. Vendor adapters live under `connectors/`, reusable packages under `packages/`, and deployment material under `infrastructure/`.

The active runtime in this foundation phase consists of the web application, API, PostgreSQL, and Redis. Redis is provisioned for later jobs; no worker currently consumes queues. Connector directories are scaffolding only, and the application makes no claim of live integrations.

Authentication uses an Argon2id password hash and a random, opaque session cookie. The raw session token is returned only as a Secure/HttpOnly/SameSite cookie and the database stores its SHA-256 digest. The API resolves user roles from tenant-scoped role assignments and applies authentication and role guards server-side.

All integration payloads and development test fixtures should be synthetic until a specific live integration is authorised. Network and identity events should store only necessary metadata, with property/tenant scoping enforced in every query.
