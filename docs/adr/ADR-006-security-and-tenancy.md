# ADR-006: Security and tenant isolation

**Status:** Accepted · **Date:** 2026-10-03

## Context
The audit (docs/ARCHITECTURE_AUDIT.md) found unauthenticated destructive endpoints, shared hardcoded secrets and credentials, and cross-tenant data access in the owner app.

## Decision
- Default-deny: every API route authenticates unless explicitly public.
- Identity (tenant, outlet, staff) comes from the session, never from the request body.
- Per-install secrets; no credentials in source.
- `tenantId` on every tenant table + forced Postgres RLS in the cloud, verified by isolation tests.

## Consequences
- Security fixes are tracked separately from the restructure and must land before exposing any hub to the internet.
