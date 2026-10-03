# ADR-001: Keep TypeScript / Next.js / Prisma / PostgreSQL

**Status:** Accepted · **Date:** 2026-10-03

## Context
ChayaOne runs one cafe today and must grow to 100–1,000+. About 84k lines of working TypeScript exist, and the GST engine in `packages/core` is shared by the tablet, the cafe PC and the cloud. Estimated peak load at 1,000 cafes is ~300 req/s — far below what one Node.js server handles.

## Decision
Keep the current stack. Improve structure (modules, adapters) instead of changing language. Rewrite only a specific part later if measured load or team size requires it.

## Consequences
- Fast delivery; one language across POS, KDS, owner app, hubs and cloud.
- Same billing code offline and online.
- Revisit if sustained traffic > ~2,000 req/s, heavy real-time multiplayer, or team > ~10 developers.
