# ChayaOne — Developer Guide (Simple Version)

This guide explains **where everything is** and **where to put new code**.
Read it once from top to bottom before you start.

---

## 1. How the app works (in 1 picture)

```
  SCREEN (browser / tablet / phone)
        │   asks for data:  fetch('/api/orders')
        ▼
  API (server code)
        │   checks login, runs the rules
        ▼
  DATABASE (PostgreSQL)
```

- The **screen** shows things and sends requests.
- The **API** does the work (checks, rules, saving).
- The **database** stores everything.

👉 **Screens never talk to the database directly. They always go through the API.**

---

## 2. The main folders

| Folder | What is inside | Do you work here? |
|---|---|---|
| `apps/pos-ui/` | **The main app.** All screens (POS, billing, KDS, dashboard) **and** all APIs | ✅ Most of the time |
| `apps/waiter/` | Waiter phone app (screens only) | Sometimes |
| `apps/customer/` | Customer QR ordering app (screens only) | Sometimes |
| `apps/owner/` | Owner app (separate app) | Sometimes |
| `apps/hub-pc/` | Desktop app for the cafe PC | Rarely |
| `adapters/db-postgres/` | **Database design** (`prisma/schema.prisma`) | When you add tables |
| `packages/core/` | **GST and money calculations** | When billing maths changes |
| `packages/ui/` | Colours and design tokens | Rarely |
| `tests/e2e/` | Test scripts | Yes, for new features |
| `tools/` | Build and helper scripts | Rarely |
| `docs/` | Documents (like this one) | To read |
| `modules/`, `contracts/`, `kernel/`, … | **Empty for now** (future structure) | ❌ Not yet |
| `archive/` | Old files kept for safety | ❌ Never |

---

## 3. Inside the main app: `apps/pos-ui/`

```
apps/pos-ui/
├── app/                ← SCREENS and APIs
│   ├── (billing)/pos/          → the /pos screen
│   ├── (t-billing)/t-billing/  → the /t-billing screen
│   ├── (dashboard)/dashboard/  → the /dashboard screen
│   ├── kds/, login/, setup/ …  → other screens
│   └── api/            ← ALL APIs (server code)
│       ├── orders/route.ts     → /api/orders
│       └── …
├── components/         ← reusable screen parts (buttons, cards, popups)
├── hooks/              ← reusable React hooks
└── lib/                ← SERVER LOGIC (rules, calculations, printing, login)
    └── services/       ← main business rules (orders, billing, stock …)
```

### Frontend or backend?

| If the file is in… | It is | It runs on |
|---|---|---|
| `app/(…)/…`, `components/`, `hooks/` | **Frontend** (screen) | Browser |
| `app/api/…`, `lib/` | **Backend** (server) | Server |

### Two small things to know
- **Folders in brackets** like `(billing)` are only for grouping. They are **not** part of the web address. `app/(billing)/pos/` opens at `/pos`.
- **Folder = web address.** `app/api/orders/route.ts` becomes `/api/orders`.

---

## 4. Example: what happens when a cashier sends an order

```
1. POS screen         app/(billing)/pos/PosClient.tsx       cashier taps "Send KOT"
2. API                app/api/orders/route.ts               checks login + checks the data
3. Business rules     lib/services/order.service.ts         prices, GST, saves order
4. Database           saves the order
5. Live update        KDS and waiter phones see the order instantly
6. Printer            KOT prints in the kitchen
7. Back to screen     POS shows "Order sent"
```

---

## 5. How to add something new

### ➕ A new screen
1. Make a folder in `apps/pos-ui/app/`. The folder name becomes the web address.
   - Example: `app/(dashboard)/dashboard/reservations/page.tsx` → opens at `/dashboard/reservations`
2. Put the screen code in that `page.tsx` (or a `…Client.tsx` file next to it).
3. Reusable parts go in `apps/pos-ui/components/`.
4. Get data by calling an API: `fetch('/api/…')`.

### ➕ A new API
1. Make a file: `apps/pos-ui/app/api/<name>/route.ts`
2. Copy this template:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// what the request must look like
const Body = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  // 1. Is the user logged in?
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 2. Is the data correct?
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  // 3. Do the work (call a service in lib/services)
  // Use session.tenantId / session.outletId — NEVER take them from the request.

  // 4. Send the answer
  return NextResponse.json({ ok: true });
}
```

### ➕ A new database table or column
1. Edit `adapters/db-postgres/prisma/schema.prisma`
   - Add `tenantId` (and `outletId` if it belongs to a branch).
   - Store money as whole numbers in **paise** (₹1 = 100).
2. Add a migration file: `adapters/db-postgres/prisma/migrations/00NN_<name>/migration.sql`
   (copy the style of the existing ones; never change old files).
3. Run:
   ```powershell
   npm run db:push
   npm run db:generate
   ```

### ➕ A complete new feature (example: Table Reservations)

Do these in order:

| # | What | Where |
|---|---|---|
| 1 | Database table | `adapters/db-postgres/prisma/schema.prisma` |
| 2 | Business rules | `apps/pos-ui/lib/services/reservation.service.ts` |
| 3 | API | `apps/pos-ui/app/api/reservations/route.ts` |
| 4 | Who is allowed | `apps/pos-ui/lib/rbac.ts` (add a permission) |
| 5 | Screen | `apps/pos-ui/app/(dashboard)/dashboard/reservations/page.tsx` |
| 6 | Live updates (optional) | `apps/pos-ui/lib/realtime.ts` |
| 7 | Printing (optional) | `apps/pos-ui/lib/print/` |
| 8 | Waiter phone (optional) | `apps/waiter/src/app/…` (calls the same API) |
| 9 | Test | `tests/e2e/test-reservations.ts` |

---

## 6. Quick "where do I put it?"

| I want to… | Put it in |
|---|---|
| Add a screen | `apps/pos-ui/app/…` |
| Add an API | `apps/pos-ui/app/api/…/route.ts` |
| Add business rules | `apps/pos-ui/lib/services/` |
| Add a reusable button/popup | `apps/pos-ui/components/` |
| Change GST / money maths | `packages/core/src/` |
| Add a database table | `adapters/db-postgres/prisma/schema.prisma` |
| Change printing | `apps/pos-ui/lib/print/` |
| Change the desktop app | `apps/hub-pc/src/` |
| Add a test | `tests/e2e/` |

---

## 7. Golden rules ✋

1. **Screens never use the database.** Always call an API.
2. **Every API checks login first.**
3. **Shop, branch and staff come from the login (`getSession()`),** never from what the screen sends.
4. **Check the incoming data** (use `zod`).
5. **Never trust prices sent by the screen.** Read them from the database.
6. **Money is always in paise** (whole numbers).
7. **No passwords or secret keys in code.** Use the `.env` file.
8. **Keep files small.** Split big files.

---

## 8. Run the project

```powershell
npm install            # first time
npm run db:generate    # first time, and after database changes

npm run db:local       # Terminal 1: start the database (keep it open)
npm run dev            # Terminal 2: start the apps
```

| Open | Address |
|---|---|
| POS / dashboard / KDS | http://localhost:3000 |
| Waiter app | http://localhost:3002 |
| Customer app | http://localhost:3003 |
| Owner app (`npm run dev:owner`) | http://localhost:3004 |

**Error 500 on login?** The database is not running. Start `npm run db:local`.

---

## 9. Words you will hear

| Word | Meaning |
|---|---|
| **Tenant** | One restaurant business |
| **Outlet** | One branch of that restaurant |
| **KOT** | Kitchen order slip |
| **KDS** | Kitchen screen |
| **T-billing** | Table billing screen |
| **Hub** | The device that runs the cafe (the cafe PC) |
| **Paise** | 1/100 of a rupee; all money is stored in paise |

---

## 10. Coming later (don't use yet)

The folders `modules/`, `contracts/`, `packages/kernel/`, `packages/hub-server/` and most of `adapters/` are **empty placeholders**.
Later, the business rules will move from `apps/pos-ui/lib/` into `modules/`.
Until then, **keep using `apps/pos-ui/lib/services/`** as shown above.

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [PRINTING.md](PRINTING.md) · [runbooks/](runbooks/)
