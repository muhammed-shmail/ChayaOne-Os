# ADR-002: Monorepo folder structure (Clean-lite)

**Status:** Accepted · **Date:** 2026-10-03

## Context
Logic lived inside Next.js route handlers (393 direct Prisma calls), the owner app was a copied fork with its own schema, and the same logic must later run on the PC hub (PostgreSQL), tablet hub (SQLite) and cloud.

## Decision
One monorepo:
- `apps/` — entry points only (screens, servers).
- `modules/` — business logic (service + repository interface); complex modules use domain/application/events.
- `adapters/` — database, printer, realtime, payments, integrations.
- `contracts/` — shared API and sync shapes.
- `packages/` — core (GST, money), kernel, hub-server, ui, config.

Stage A (done): folders moved, no behaviour change. Stage B: logic moves into `modules/` one module at a time, each with characterisation tests.

## Consequences
- Same business logic on every hub and the cloud; only adapters change.
- Placeholders exist for folders whose code has not moved yet (see each README / stub header).
- Rules: apps never import adapters except their container; modules never import Prisma/Next/fs/net.
