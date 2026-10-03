# Sync (hub ↔ cloud)

Design: [ADR-004](adr/ADR-004-sync-strategy.md).

- **Hub side (exists):** `SyncOutbox` table and worker in `apps/pos-ui/lib/sync/` and `lib/outbox.ts`.
- **Cloud side (missing):** the worker posts to `/api/sync/ingest`, which does not exist yet — planned in `apps/cloud-api`.
- **Contracts:** `contracts/sync/` (placeholders).
