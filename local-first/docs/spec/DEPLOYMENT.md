# Cafe OS — Deployment Guide

Cafe OS is one full-stack Next.js app (`platform/apps/web` in a Turborepo). It
deploys to **Vercel**, with **Neon/Supabase Postgres** for data and **Supabase**
for image storage + realtime (KDS / POS / owner bell / customer live status).

## 1. Database: Postgres (Neon or Supabase)

1. Create a Postgres database — [neon.tech](https://neon.tech) or the Postgres that
   ships with your Supabase project both work.
   - **Region:** closest to your users (e.g. AWS ap-southeast-1 / Singapore).
   - **Database name:** `cafeos`
2. Copy the two connection strings:
   - **Pooled** connection string → `DATABASE_URL` (app queries)
   - **Direct** connection string → `DIRECT_URL` (migrations)
3. Push the schema + seed once (from `platform/`):
   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npm run db:push
   npm run db:seed
   ```
4. Keep these strings safe — you'll paste them into Vercel.

## 2. Realtime + Storage: Supabase

The realtime spine (order tickets to the KDS/POS, owner-bell alerts, customer live
status) runs on **Supabase Realtime broadcast**. The server broadcasts events; the
browsers subscribe directly to **private** channels, so we need one-time setup.

1. In your Supabase project, **Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - **anon** key → `SUPABASE_ANON_KEY` (public)
   - **JWT Secret** → `SUPABASE_JWT_SECRET`
2. **Storage:** create a **public** bucket (e.g. `uploads`) and set `SUPABASE_BUCKET`.
3. **Realtime authorization (one-time SQL).** In **SQL Editor**, run the policy that
   scopes each private channel to the outlet (and table) in the client's token. Our
   token endpoints ([app/api/realtime/token](platform/apps/web/app/api/realtime/token/route.ts),
   [app/api/customer/realtime](platform/apps/web/app/api/customer/realtime/route.ts))
   mint a JWT with `outlet_id` (staff) or `outlet_id` + `table_id` (customer):

   ```sql
   -- Receive-only policy for private broadcast channels. A staff token (outlet
   -- only) reads exactly outlet:<id>; a customer token (outlet + table) reads
   -- exactly outlet:<id>:tbl:<tableId>. The service-role broadcast bypasses RLS.
   create policy "cafeos realtime read own channel"
   on realtime.messages for select
   to authenticated
   using (
     realtime.topic() =
       'outlet:' || (auth.jwt() ->> 'outlet_id')
       || coalesce(':tbl:' || (auth.jwt() ->> 'table_id'), '')
   );
   ```

   > No table replication or Realtime-per-table toggling is needed — we use
   > **broadcast**, not Postgres-changes. The policy above is the only Supabase-side
   > config beyond enabling Realtime (on by default for new projects).

## 3. App: Vercel

1. Go to [vercel.com](https://vercel.com), **Add New → Project**, import your repo.
2. Configure the project:
   - **Root Directory:** `platform`  ← important (the monorepo root, has `turbo.json`).
   - **Framework Preset:** Next.js (auto-detected). Build/install come from
     [platform/vercel.json](platform/vercel.json):
     - Install: `npm ci`
     - Build: `npm run db:generate` (Prisma client) → `npm run build`
     - Output: `apps/web/.next`
     - The build does **not** touch the database, so it never needs `DIRECT_URL`
       and can't apply a surprise migration. Sync the schema explicitly (below).
3. Add environment variables (Project → Settings → Environment Variables):

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Pooled Postgres connection string |
   | `DIRECT_URL` | Direct Postgres connection string |
   | `JWT_SECRET` | Long random string (`openssl rand -base64 48`) |
   | `PLATFORM_JWT_SECRET` | Long random string (super-admin sessions) |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_JWT_SECRET` | Supabase JWT secret (realtime tokens) |
   | `SUPABASE_BUCKET` | Storage bucket name (e.g. `uploads`) |
   | `GEMINI_API_KEY` | For the AI assistant (optional) |
   | `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | Payments (when ready) |
   | `DEV_TENANT_SUBDOMAIN` | Only for a single-tenant deploy whose host carries no tenant subdomain |

4. **Deploy.** First build takes 2–3 minutes.
5. Once live, test:
   - `/login` → login page renders.
   - Verify role-based landing page routing:
     - **Admin (Owner) / Manager / Cashier:** `/dashboard` (Dashboard and controls)
     - **Waiter:** `/pos` (POS billing flow)
     - **Kitchen:** `/kds` (KDS display)
     - **Platform Admin (Super-admin):** `/admin` (Platform controls and tenant setup; login is at `/admin/login`)
   - Open the KDS and POS in two tabs, fire an order → the ticket appears on the
     KDS live and the POS/owner-bell update (confirms realtime end-to-end).

### Seeded Default Credentials

Once the seed script has run (`npm run db:seed`), the following login credentials are standard across development and production:

* **Platform Admin (Super-admin):**
  - **URL:** `/admin/login`
  - **Email:** `admin@nuro7.com`
  - **Password:** `admin1234`

* **Admin (Owner):**
  - **URL:** `/login` (Switch to the Username/Password login tab)
  - **Username:** `owner`
  - **Password:** `cafe1234`

* **Floor Staff (PIN login):**
  - **URL:** `/login` (PIN pad screen)
  - **Cashier PIN:** `2222`
  - **Kitchen PIN:** `3333`

---

## 4. After deployment: the update loop

**Push code → Vercel auto-rebuilds → live in 2–3 minutes.**

```bash
git add .
git commit -m "description"
git push origin main
# Watch the deployment on the Vercel dashboard → done
```

**Schema changes (Prisma)?** The Vercel build no longer pushes the schema (that
kept it from mutating prod on every deploy). After changing `schema.prisma`, sync
the database once from your machine, then push code as usual:

```bash
# from platform/, pointed at the production DB
DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npm run db:push
git push origin main   # Vercel rebuilds the app against the now-synced schema
```

⚠️ `db:push` uses `--accept-data-loss`, so destructive diffs (renaming/dropping a
column) apply without a prompt. Additive changes are safe; for a genuinely lossy
migration, test it on a database branch first.

---

## 5. Monitoring & logs

In the Vercel dashboard:
- **Deployments** → each push, with build + function logs and one-click rollback.
- **Logs / Observability** → runtime logs and function invocations.
- **Realtime** usage lives in the Supabase dashboard (**Reports → Realtime**).

---

## 6. Custom domain

Vercel → **Settings → Domains** → add your domain and point DNS as instructed.
HTTPS is provisioned automatically. For multi-tenant subdomains (`kaava.yourdomain.com`),
add a wildcard `*.yourdomain.com` domain.

---

## Troubleshooting

**Build fails with a Prisma engine error:** the schema's generator includes
`rhel-openssl-3.0.x` for Vercel's runtime — if you changed it, restore that target.

**Realtime silent (KDS/POS not updating live):**
- Confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and
  `SUPABASE_JWT_SECRET` are all set. Without them, `publish()` is a no-op and the
  clients can't get a token.
- Confirm the **RLS policy** from §2 exists on `realtime.messages` — without it,
  private-channel subscribes are rejected and clients show "Offline".
- Check the browser console for a `/api/realtime/token` 503 (`realtime_not_configured`)
  → an env var is missing.

**A guest sees another table's order (or nothing):** verify the RLS policy's topic
expression matches exactly — staff = `outlet:<id>`, customer = `outlet:<id>:tbl:<tableId>`.

**Database migration errors:** use a database branch to test migrations before prod.

---

**That's it.** Vercel docs: https://vercel.com/docs · Supabase Realtime:
https://supabase.com/docs/guides/realtime.
