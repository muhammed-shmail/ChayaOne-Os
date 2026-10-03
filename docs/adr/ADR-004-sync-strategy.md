# ADR-004: Hub runs the cafe, cloud keeps the records (Petpooja model)

**Status:** Accepted · **Date:** 2026-10-03

## Context
Cafes need to work without internet; owners need a live multi-outlet view. Some cafes use a PC, others only a tablet.

## Decision
Each cafe has a hub (PC today, tablet later) holding its own copy and serving waiter/KDS devices over Wi-Fi. Hubs sync to the cloud through an outbox (idempotent, ordered, versioned events); menu/price/staff changes flow cloud → hub.

## Consequences
- Orders/bills: creator wins (never edited in two places). Menu/prices/staff: cloud wins. Stock: apply deltas.
- Needs `/api/sync/ingest` in `apps/cloud-api` (not built yet).
