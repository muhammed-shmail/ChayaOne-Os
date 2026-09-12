# ChayaOne Owner Dashboard (`Owner-chayaone`)

A modern, standalone, multi-tenant, and multi-store management application for **ChayaOne OS**. Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM**, designed to be deployed independently to **Vercel** with full **PWA** and **offline-first read** capabilities.

---

## 🚀 Key Features

- **Multi-Tenant & Multi-Organization**: Scoped strictly to the authenticated owner's organization (`tenantId`).
- **Multi-Store / Multi-Branch**:
  - Global overview across all authorized outlets or drill-down into an individual store.
  - Interactive store switcher with zero page reload.
- **Strict Separation from Shop OS**:
  - **Zero** POS, KDS, waiter, or customer ordering dependencies.
  - **Zero** thermal printer, ESC/POS, or local hardware drivers.
  - Runs in the cloud with read-optimized queries against the PostgreSQL replica.
- **Offline-First PWA**:
  - Installable on iOS, Android, macOS, and Windows.
  - Tenant-scoped **IndexedDB** local cache (`lib/cache/idb.ts`).
  - Graceful fallback with "Last updated" timestamps when internet is unavailable.
  - Instant automatic refetch upon network reconnection.
- **Real-Time Shop Connectivity**:
  - Monitors local shop heartbeats (`Device.lastSeenAt`).
  - Displays pending sync queue counts from `SyncOutbox`.
- **Comprehensive Analytics & Reporting**:
  - Today vs. yesterday KPIs (Revenue, Orders, Avg Order Value, Store online count).
  - 7-day sales trend bar chart with daily comparisons.
  - Real-time sales transactions, orders, live product menu toggles, inventory levels, supplier expenses, staff records, and daily sales/payment mode reports with CSV export.

---

## 🏗️ Architecture & Security Model

```
                    ┌─────────────────────────┐
                    │   ChayaOne Shop POS     │
                    │   (Local PC / SQLite /  │
                    │    Embedded Postgres)   │
                    └───────────┬─────────────┘
                                │ SyncOutbox
                                ▼
                    ┌─────────────────────────┐
                    │   Cloud PostgreSQL DB   │
                    │   (Supabase / Neon)     │
                    └───────────┬─────────────┘
                                │ Prisma ORM
                                ▼
      ┌─────────────────────────────────────────────────────┐
      │             Owner Dashboard (Next.js 14)            │
      │                  (Owner-chayaone/)                  │
      │                                                     │
      │  ┌─────────────────┐       ┌──────────────────────┐ │
      │  │ Edge Middleware │ ────> │ API Route Guards     │ │
      │  │ (Session Verify)│       │ (Tenant & Store Auth)│ │
      │  └─────────────────┘       └──────────────────────┘ │
      │            │                                        │
      │            ▼                                        │
      │  ┌─────────────────┐       ┌──────────────────────┐ │
      │  │ React App Shell │ <───> │ IndexedDB Cache      │ │
      │  │ (Tailwind UI)   │       │ (Tenant-Scoped Keys) │ │
      │  └─────────────────┘       └──────────────────────┘ │
      └─────────────────────────────────────────────────────┘
```

### Authorization Chain
Every request to `/api/owner/*` undergoes a 4-tier verification:
1. **JWT Verification**: Decodes the `owner_session` cookie via `jose`.
2. **Staff Role Guard**: Ensures role is `owner` or `manager`.
3. **Outlet Access Guard**: If an `outletId` is queried, verifies that the user either has tenant-wide access (`user.outletId === null`) or is explicitly assigned to that outlet.
4. **Data Isolation**: Injects `tenantId` and authorized `outletId`s into every Prisma query.

---

## 📁 Project Structure

```
Owner-chayaone/
├── app/
│   ├── (app)/                       # Authenticated routes with shared Sidebar layout
│   │   ├── layout.tsx               # App layout with Sidebar & MobileBottomNav
│   │   ├── dashboard/               # Main overview, KPIs, and trend charts
│   │   ├── sales/                   # Sales transactions & filters
│   │   ├── orders/                  # Order management & status
│   │   ├── products/                # Menu items & availability
│   │   ├── inventory/               # Stock levels & low-stock alerts
│   │   ├── expenses/                # Purchase orders & vendor payouts
│   │   ├── staff/                   # Team directory & permissions
│   │   ├── reports/                 # Daily sales, payments & CSV export
│   │   ├── stores/                  # Store network & terminal heartbeats
│   │   └── settings/                # Profile, multi-org, & cache tools
│   ├── api/
│   │   ├── auth/                    # login, logout, refresh
│   │   └── owner/                   # context, dashboard, sales, orders, etc.
│   ├── login/                       # Dedicated owner login screen
│   ├── globals.css                  # Tailwind styles & custom variables
│   ├── layout.tsx                   # Root HTML layout with PWA meta
│   ├── manifest.ts                  # Web App Manifest
│   └── page.tsx                     # Gateway redirect
├── components/
│   ├── dashboard/                   # KpiCard, SalesTrend, StoreStatusGrid, TopProducts
│   ├── navigation/                  # Sidebar, MobileNav
│   ├── organization-selector/       # OrgSelector
│   ├── store-selector/              # StoreSelector
│   └── ui/                          # OfflineBanner, StatusBadge, LoadingSpinner
├── lib/
│   ├── api/                         # permissions, analytics, owner-context
│   ├── auth.ts                      # JWT authentication utilities
│   ├── cache/                       # IndexedDB cache & deterministic key builders
│   ├── db.ts                        # Standalone Prisma client
│   ├── hooks/                       # useOnlineStatus, useOwnerData
│   ├── tenant/                      # TenantProvider context
│   └── utils/                       # currency (paise->INR), dates
├── prisma/
│   └── schema.prisma                # Database schema
├── public/
│   ├── icons/                       # PWA icons
│   ├── offline.html                 # Offline fallback page
│   └── sw.js                        # App shell Service Worker
├── middleware.ts                    # Edge session protection
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                      # Vercel deployment configuration
└── .env.example
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js 18.17+ or Node.js 20+
- PostgreSQL database URL (cloud instance or local development DB)

### 2. Install Dependencies
```bash
cd Owner-chayaone
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your configuration:
```env
DATABASE_URL="postgresql://user:password@host:5432/chayaone?sslmode=require"
JWT_SECRET="your-32-character-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Deploying to Vercel

The `Owner-chayaone` directory is completely decoupled from the rest of the repository and can be deployed to Vercel with zero modifications to other packages.

### Step-by-Step Vercel Deployment:
1. Connect your repository to **Vercel**.
2. Set **Root Directory** to `Owner-chayaone`.
3. Set **Framework Preset** to **Next.js**.
4. Configure Environment Variables in the Vercel Dashboard:
   - `DATABASE_URL`: Your production PostgreSQL connection string.
   - `JWT_SECRET`: A secure random secret (min 32 characters).
   - `NEXT_PUBLIC_APP_URL`: Your Vercel production domain (e.g. `https://owner.chayaone.com`).
5. Click **Deploy**. Vercel will automatically run `npm install`, `prisma generate`, and `next build`.

---

## 📱 PWA Installation
- **Chrome / Edge (Desktop & Android)**: Click the "Install" icon in the address bar or tap "Add to Home Screen" in browser options.
- **Safari (iOS)**: Tap the Share button and select "Add to Home Screen".
