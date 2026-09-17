# ChayaOne OS — Local-First Migration Analysis & Strategy

**Document Version:** 1.0.0  
**Date:** August 14, 2026  
**Status:** Audit Completed & Prepared for Local-First Implementation  

---

## A. Current Architecture Summary

ChayaOne OS (currently residing in `current-online/platform`) is built as a high-performance Next.js 14 monorepo using npm workspaces and Turbo. It is designed around a cloud-first, multi-tenant architecture.

### Key Technology Stack & Structure
* **Framework:** Next.js `14.2.15` (App Router, Edge Middleware, Node.js runtime for API route handlers)
* **Language:** TypeScript 5.6
* **UI & Styling:** React `18.3.1`, TailwindCSS 3.4, Framer Motion, Lucide React
* **Monorepo Packages (`platform/`):**
  * `apps/web`: Next.js web application (POS, KDS, Customer PWA, Owner Dashboard, Waiter Approvals, Platform Admin)
  * `packages/db`: Prisma ORM `5.x`, PostgreSQL schema, migrations, seeders, PGlite local dev scripts
  * `packages/core`: Shared Zod validation schemas, business math (GST calculation, bill item logic)
  * `packages/ui`: Shared UI components and icons
* **Data Layer:** PostgreSQL accessed via Prisma ORM (`@cafeos/db`). Idempotency is built-in using `Order.clientUuid`.
* **Auth System:** Dual-layer JWT authentication using `jose` with HTTP-only cookies (`cafeos_session` for 30-min access, `cafeos_refresh` for 30-day session persistence linked to `StaffSession` DB rows).
* **Realtime Layer:** Cloud Supabase Realtime Broadcast REST API for event fan-out, consumed via `@supabase/supabase-js` WebSockets in browser clients.
* **Storage Layer:** Dual-mode upload system (`/api/dashboard/upload`) — Supabase Object Storage (`SUPABASE_BUCKET="uploads"`) with fallback to local static disk (`public/uploads`).
* **Integrations & Cloud Services:** Google Gemini 2.5 Flash API for natural language sales assistant, Razorpay API credentials for tenant payment routing, Web Push (`web-push`) VAPID notifications.

---

## B. Current Data Flow

In the current production/online implementation, all clients communicate with cloud infrastructure:

```text
[ POS Till ] ────┐
                 ├─► HTTP POST /api/orders ──► [ Next.js Server ] ──► [ Cloud PostgreSQL ]
[ Waiter PWA ] ──┤                                    │
                 │                                    ├─► HTTP POST /realtime/v1/api/broadcast
[ Customer PWA] ─┘                                    │        │
                                                      ▼        ▼
                                                [ Storage ]  [ Supabase Realtime ]
                                                      │        │
                                                      ▼        ▼
                                                [ Dish Imgs] [ KDS / POS Live Display ]
```

### Flow Breakdown:
1. **POS Order Placement:** Staff submits cart to `POST /api/orders`. Server computes GST, updates stock via `StockLedger`, writes `Order` & `Kot` rows to Cloud Postgres, and triggers Supabase Realtime broadcast.
2. **Customer QR Ordering:** Customer scans table QR, posts to `POST /api/qr-order`. Order enters `pending_approval` state. Realtime broadcasts `order.pending` to Waiter app (`/approvals`). Waiter approves via `POST /api/approvals`, which converts status to `in_kitchen` and broadcasts `order.new` to the KDS.
3. **KDS Display:** KDS page (`/kds`) loads initial open orders via `GET /api/orders?status=in_kitchen` and listens for `order.new` / `order.updated` events over Supabase WebSockets.
4. **Printing:** KDS/POS triggers browser native `window.print()` popups rendering dynamic HTML document strings.

---

## C. Cloud Dependency Matrix

| Component / Dependency | Current Implementation | Local Operational Requirement | Local-First Classification | Proposed Local Replacement |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | Remote Postgres (Neon / Supabase) via `DATABASE_URL` | Mandatory for all core cafe ops | **LOCAL REPLACEMENT REQUIRED** | Local PostgreSQL 16 on Main Cafe PC |
| **Realtime Events** | Supabase Realtime Broadcast REST API + WebSockets | Mandatory for KDS, POS, Waiter & QR updates | **LOCAL REPLACEMENT REQUIRED** | Local WebSocket Server (Node.js `ws` / Socket.io) |
| **Media / File Storage** | Supabase Storage (`SUPABASE_BUCKET`) | Required for dish images, logos, banners | **LOCAL REPLACEMENT REQUIRED** | Local Disk Storage served via Express / static Next.js (`public/uploads`) |
| **Staff Authentication** | JWT in httpOnly cookie + DB `StaffSession` lookup | Mandatory for POS/KDS/Waiter login | **LOCAL REQUIRED** | Local DB verification on Main PC |
| **Owner AI Assistant** | Google Gemini API (`GEMINI_API_KEY`) | Non-essential for operational ordering | **OPTIONAL CLOUD** | Graceful fallback to heuristic sales analytics engine when offline |
| **Digital Payments** | Razorpay PG API (`RAZORPAY_KEY_SECRET`) | Required for online card/UPI PG | **EXTERNAL SERVICE** / **OPTIONAL CLOUD** | Cash, manual UPI QR, and offline card terminal logging operate offline |
| **Web Push Notifications**| VAPID Push Service (`web-push`) | Helpful for background device alerts | **OPTIONAL CLOUD** | Local WebSocket live alerts to connected LAN devices |
| **SaaS Control Plane** | Platform Admin (`/admin`), Subscriptions | SaaS billing & multi-tenant provisioning | **CLOUD ONLY** | Retained on ChayaOne Cloud |

---

## D. API Classification

Every API route in `current-online/platform/apps/web/app/api` has been audited and classified:

### 1. LOCAL-FIRST (Must operate 100% offline on Cafe LAN)
* `POST /api/orders` — POS & offline order creation (Idempotent via `clientUuid`)
* `GET /api/orders` — KDS active order list fetch
* `POST /api/orders/[id]/status` — KDS ticket bump / status progression
* `POST /api/qr-order` — Customer table QR order submission (`pending_approval`)
* `GET /api/approvals`, `POST /api/approvals` — Waiter order confirmation/rejection
* `GET /api/menu` — Menu item & modifier catalog retrieval
* `GET /api/tables`, `POST /api/tables/order` — Table map status & bill fetching
* `POST /api/pos/customer/lookup` — Customer phone search & loyalty lookup
* `POST /api/auth/login`, `/api/auth/login/password` — Staff PIN & password authentication
* `POST /api/auth/refresh`, `/api/auth/logout` — Staff session management
* `POST /api/attendance` — Staff clock-in / clock-out logging
* `GET /api/notifications` — Local operational alert feeds
* `GET /api/dashboard/inventory`, `POST /api/dashboard/inventory` — Stock items & recipe management
* `GET /api/dashboard/revenue`, `/api/dashboard/floor`, `/api/dashboard/tables` — Local operational analytics
* `GET /api/dashboard/reports/gst` — Tax report generator
* `GET /api/suppliers`, `POST /api/suppliers` — Purchase orders & vendor payments
* `GET /api/realtime/token` — Local realtime connection authorization

### 2. CLOUD-OPTIONAL (Enhances functionality when connected; degrades gracefully offline)
* `POST /api/dashboard/assistant` — Gemini AI chat (Falls back to local heuristic response engine when offline)
* `POST /api/dashboard/upload` — Dish image & logo uploads (Writes to local disk when Supabase is disconnected)
* `POST /api/customer/otp/start`, `/api/customer/otp/verify` — SMS OTP login (Local PIN / guest session used offline)

### 3. CLOUD-ONLY (Executed only between Cafe Server and ChayaOne Cloud)
* `GET /api/admin/*`, `POST /api/admin/*` — Platform admin tenant management & support tickets
* `GET /api/billing/subscription` — SaaS subscription verification & license checks
* `POST /api/sync/*` — Sync engine outbox push and inbound catalog pull

---

## E. Database Classification

The Prisma schema (`schema.prisma`) contains **43 models**. Every model has been audited for local-first sync requirements:

| Model Category | Key Models | Local Database Role | Sync Behavior |
| :--- | :--- | :--- | :--- |
| **Tenancy & Staff** | `Tenant`, `Outlet`, `StaffUser`, `StaffSession`, `Role` | Operational Source of Truth | Read-heavy local cache; synced from Cloud on setup/update |
| **Catalog & Menu** | `Category`, `MenuItem`, `ModifierGroup`, `Modifier`, `Combo` | Operational Source of Truth | Primary edits on Main PC; synced bidirectionally |
| **Orders & Billing** | `TableMap`, `Order`, `OrderItem`, `Kot`, `Payment`, `Refund` | Operational Source of Truth | Created locally; queued in Outbox for asynchronous Cloud Sync |
| **Inventory & Supply**| `StockItem`, `Recipe`, `StockLedger`, `WasteLog`, `Vendor`, `PurchaseOrder`, `SupplierPayment` | Operational Source of Truth | Managed locally; stock ledger delta synced to Cloud |
| **Customers & Loyalty**| `Customer`, `LoyaltyLedger`, `RewardCatalog`, `Coupon` | Operational Source of Truth | Lookups local; loyalty balance synced to cloud for multi-outlet support |
| **Gamification** | `Game`, `GameSession`, `GameRoom`, `Streak`, `Badge` | Operational Source of Truth | Local sessions logged offline; synced asynchronously |
| **Staff Ops & Audit** | `Attendance`, `Shift`, `SalaryPayment`, `AuditLog` | Operational Source of Truth | Logged locally; pushed to cloud audit logs |
| **Cloud / Control Plane**| `PlatformAdmin`, `PlanDefinition`, `Subscription`, `SubInvoice`, `SupportTicket` | Cloud Only / Read-Only | Cached read-only locally for quota checking |

---

## F. Realtime Classification

Current transport uses `lib/realtime.ts` to POST events to Supabase Realtime Broadcast. In local-first mode, events will be published locally on the Main Cafe PC:

| Event Name | Producer | Consumer | Current Transport | Future Local Transport |
| :--- | :--- | :--- | :--- | :--- |
| `order.new` | POS / Waiter Approval | KDS, POS, Dashboard | Supabase Broadcast (`outlet:<id>`) | Local WebSocket Broadcast (`outlet:<id>`) |
| `order.updated` | KDS / POS | KDS, POS, Customer PWA | Supabase Broadcast (`outlet:<id>`) | Local WebSocket Broadcast (`outlet:<id>`) |
| `order.pending` | Customer PWA | Waiter App (`/approvals`) | Supabase Broadcast (`outlet:<id>`) | Local WebSocket Broadcast (`outlet:<id>`) |
| `notify` | Server / Alerts | Staff Bell / Owner Monitor | Supabase Broadcast (`outlet:<id>`) | Local WebSocket Broadcast (`outlet:<id>`) |

---

## G. Printing Analysis

### Current Implementation & Gaps
* **Current mechanism:** Browsers invoke `printDoc()` in `PosClient.tsx`, which opens a popup window containing raw HTML CSS and calls `window.print()`.
* **Gaps:**
  1. Requires human manual interaction (clicking Print on OS dialogs).
  2. Cannot perform silent, background printing directly from KDS or POS.
  3. No support for raw ESC/POS thermal printer commands (drawer kick, paper cut, line spacing, raster logos).
  4. Lacks physical multi-printer routing (e.g. splitting a KOT automatically between Kitchen Printer, Bar Printer, and Juice Printer).

### Target Architecture
A dedicated **Local Print Service** running on the Main Cafe PC:
```text
Order Created / Status Changed
       │
       ▼
Printer Router Engine (Main PC)
       │
       ├──► Kitchen KOT ──► ESC/POS TCP (192.168.1.100:9100) ──► Kitchen Thermal Printer
       ├──► Bar KOT     ──► ESC/POS USB (COM3 / /dev/usb/lp0)  ──► Bar Thermal Printer
       └──► Receipt     ──► ESC/POS TCP (192.168.1.101:9100) ──► Billing Counter Printer
```

---

## H. KDS Analysis

### Current Flow
1. KDS mounts at `/kds`, loads initial active tickets (`in_kitchen`) from `GET /api/orders?status=in_kitchen`.
2. Connects to Supabase Realtime channel `outlet:<outletId>`.
3. Listens for `order.new` and `order.updated`.
4. Supports station filtering (`all`, `kitchen`, `bar`, `dessert`).
5. Supports line-item batching ("Make once" totals across active tables).
6. Line cooks tap ticket to progress: `NEW` (acknowledged locally) → `PREPARING` → `READY` → `SERVED`.

### Local-First Requirements
* KDS must run inside the Cafe LAN without requiring external domain resolution.
* Ticket state transitions must persist immediately to Local PostgreSQL.
* Realtime updates must broadcast over LAN WebSockets with sub-50ms latency.

---

## I. Authentication Analysis

### Current Flow
* Staff authenticates via PIN or Username/Password against `/api/auth/login`.
* Server returns short-lived access JWT cookie (`cafeos_session`, 30 min) and long-lived refresh cookie (`cafeos_refresh`, 30 days).
* Next.js `middleware.ts` inspects cookies on protected routes (`/pos`, `/kds`, `/dashboard`).

### Local-First Preparation
* Auth must run entirely against Local PostgreSQL on the Main Cafe PC.
* PIN hash verification (`pinHash`) and scrypt password verification (`passwordHash`) happen locally.
* Staff devices on Cafe Wi-Fi stay logged in offline for up to 30 days via local `StaffSession` records.

---

## J. Storage Analysis

### Current Flow
* Uploads hit `/api/dashboard/upload/route.ts`.
* If `SUPABASE_URL` is set, uploads to Supabase Storage bucket (`uploads`).
* If Supabase is unset, saves file to local disk (`public/uploads/...`).

### Local-First Strategy
* Set Local Disk as the primary operational storage on the Main Cafe PC.
* Image URLs resolve relative to local host (`http://192.168.x.x:3000/uploads/...`).
* Background sync engine optionally mirror uploaded assets to Cloud Storage when Internet is active.

---

## K. Recommended Migration Architecture

```text
                                CHAYAONE OS
                                     │
                          ┌──────────▼──────────┐
                          │   MAIN CAFE PC      │
                          │  ChayaOne Server    │
                          │                     │
                          │ Next.js App Server  │
                          │ Local PostgreSQL 16 │
                          │ Local WS Realtime   │
                          │ Local Outbox Sync   │
                          │ Local Print Service │
                          └──────────┬──────────┘
                                     │
                              LOCAL CAFE LAN / WIFI
                                     │
           ┌──────────┬──────────────┼──────────────┬──────────┐
           ▼          ▼              ▼              ▼          ▼
          POS       WAITER          KDS           STAFF     CUSTOMER
          TILL       PWA          SCREENS          PWA        PWA (Wi-Fi)
       (Browser)   (Mobile)      (Tablet/TV)     (Mobile)   (Mobile)

                                     │
                             OPTIONAL CLOUD SYNC
                                     │
                           ┌─────────▼─────────┐
                           │ ChayaOne Cloud    │
                           │ Cloud Backup DB   │
                           │ Remote Dashboard  │
                           │ Multi-Outlet Agg  │
                           └───────────────────┘
```

---

## L. Core Local-First Guarantees

1. **Local Source of Truth:** Local PostgreSQL running on the Main Cafe PC handles 100% of read/write operations for daily cafe transactions.
2. **Zero-Downtime Offline Capability:** Internet loss has zero impact on POS order taking, billing, KDS display, waiter approvals, inventory deduction, and printing.
3. **Dual Network Customer PWA:** Customers on Cafe Wi-Fi hit the Main PC directly (`192.168.x.x`). Customers on mobile data hit ChayaOne Cloud, which relays orders down via the Sync Engine.
4. **Idempotent Outbox Sync:** All local data changes record an append-only outbox event. The sync engine pushes queued events to the Cloud when connected without blocking local transactions.
5. **Native Silent Thermal Printing:** Direct network/USB ESC/POS printing bypasses browser popups.

---

## M. Prepared Files for Phase 3 Implementation

### Files That Will Need Modification in Next Phase:
* `platform/apps/web/lib/realtime.ts` — Add local WebSocket publisher fallback.
* `platform/apps/web/lib/realtime-client.ts` — Add local WebSocket client subscriber fallback.
* `platform/apps/web/lib/devices.ts` — Expand printer definitions for direct ESC/POS hardware routing.
* `platform/apps/web/app/api/dashboard/upload/route.ts` — Ensure local disk storage is default fallback.

### Files That Must NOT Be Modified (Preserved Core Contracts):
* `platform/packages/db/prisma/schema.prisma` (Schema structure & models remain intact)
* `platform/apps/web/middleware.ts` (Authentication contracts preserved)
* `platform/packages/core/src/*` (GST bill calculations & Zod schemas preserved)
* `platform/apps/web/app/pos/PosClient.tsx` (UI layout preserved)
* `platform/apps/web/app/kds/KdsClient.tsx` (UI layout preserved)
