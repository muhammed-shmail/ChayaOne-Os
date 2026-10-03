# Database

- **Schema:** `adapters/db-postgres/prisma/schema.prisma` (package `@cafeos/db`). Full design notes: [spec/03-DATABASE-SCHEMA.md](spec/03-DATABASE-SCHEMA.md).
- **Migrations:** `adapters/db-postgres/prisma/migrations/` (hand-written, additive SQL). Do not edit applied migration files.
- **Row-Level Security script:** `adapters/db-postgres/prisma/rls.sql` (not applied automatically).
- **Local development DB:** embedded PostgreSQL on port 5433, data in `adapters/db-postgres/.localdb` — start with `npm run db:local`.
- **Money:** integer paise everywhere.
- **Owner app:** still has its own schema copy in `apps/owner/prisma/` (to be merged).
