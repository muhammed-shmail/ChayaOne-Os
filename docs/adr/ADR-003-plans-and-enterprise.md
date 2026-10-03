# ADR-003: Plans (Basic / Pro / Enterprise) as data + signed entitlements

**Status:** Accepted · **Date:** 2026-10-03

## Context
Plan data exists (`PlanDefinition`, `Subscription`, `UsageCounter`, `lib/features.ts`, `lib/limits.ts`) but three separate on/off systems (features, modules, license) are not connected, and the local hub cannot know the cloud plan.

## Decision
The cloud decides the plan and issues a signed entitlement (plan, features, limits, expiry) that hubs verify offline. One check, `can(ctx, feature)`, everywhere. Enterprise is the same code with more features enabled — never a fork.

## Consequences
- Hide in UI and block on the server.
- Data is kept on downgrade.
- Never stop billing mid-service; grace period on expiry.
