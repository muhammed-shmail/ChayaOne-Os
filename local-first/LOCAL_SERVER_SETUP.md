# ChayaOne OS — Local Server Setup & Runtime Guide

**Document Version:** 1.0.0  
**Date:** August 14, 2026  
**Runtime Mode:** `local`  
**Database:** Local PostgreSQL 16 (`embedded-postgres` on port 5433)  

---

## 1. Required Software & Prerequisites

* **Node.js:** `>=20.0.0` (LTS recommended)
* **Package Manager:** `npm` `>=10.8.0`
* **Operating System:** Windows 10/11, macOS, or Linux (Main Cafe PC)
* **Local Database:** Embedded PostgreSQL 16 (Managed automatically via `@cafeos/db` / `embedded-postgres` on port `5433`). No manual PostgreSQL system installation or Docker is required.

---

## 2. Local Database Configuration

The local runtime relies on an embedded PostgreSQL instance persisted in `local-first/platform/packages/db/.localdb`.

### Database Parameters
* **Host:** `localhost` (`127.0.0.1`)
* **Port:** `5433`
* **Database Name:** `cafeos`
* **User:** `cafeos`
* **Password:** `cafeos`
* **Connection String (`DATABASE_URL`):** `postgresql://cafeos:cafeos@localhost:5433/cafeos`

---

## 3. Step-by-Step Server Initialization

Navigate to the local-first application directory:

```bash
cd "local-first/platform"
```

### Step 3.1: Install Dependencies
```bash
npm install
```

### Step 3.2: Initialize Local PostgreSQL Engine
Start the local embedded PostgreSQL daemon (run in background or separate terminal):
```bash
npm run db:local
```
*Output confirmation:*
`🐘 Postgres running on localhost:5433`
`✅ Created database "cafeos"`

### Step 3.3: Push Prisma Schema to Local Database
```bash
npm run db:push
```
*Output confirmation:*
`Your database is now in sync with your Prisma schema.`

### Step 3.4: Seed Local Cafe Data
```bash
npm run db:seed:full
```
*Output confirmation:*
`✅ Seeded tenant Kahwa House (kahwa)`
`Staff PINs → Owner: 1111 | Cashier: 2222 | Kitchen: 3333 | Manager: 4444`

### Step 3.5: Start Local Next.js Application Server
```bash
npm run dev
```
*Output confirmation:*
`▲ Next.js 14.2.35`
`- Local:   http://localhost:3000`
`- Network: http://0.0.0.0:3000`

---

## 4. Environment Variables (`local-first/platform/.env`)

```env
# Local PostgreSQL
DATABASE_URL="postgresql://cafeos:cafeos@localhost:5433/cafeos"
DIRECT_URL="postgresql://cafeos:cafeos@localhost:5433/cafeos"

# Runtime Settings
CHAYAONE_RUNTIME_MODE="local"
CHAYAONE_CLOUD_ENABLED="false"
DEV_TENANT_SUBDOMAIN="kahwa"

# Session Security
JWT_SECRET="chayaone-local-jwt-secret-key-32-chars-long"
PLATFORM_JWT_SECRET="chayaone-local-platform-jwt-secret-key-admin"
OTP_DEV_ECHO="1"
```

---

## 5. Finding the Main PC LAN IP & Connecting Secondary Devices

To access ChayaOne from secondary devices (tablets, phones, POS tills, KDS monitors) on the cafe Wi-Fi:

### Step 5.1: Find the Main PC IP Address
On Windows PowerShell:
```powershell
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi** or **Ethernet adapter**:
`IPv4 Address. . . . . . . . . . . : 10.177.127.152`

### Step 5.2: Open App on Secondary Devices
On any device connected to the same Wi-Fi/LAN, navigate to:
* **Server Health:** `http://10.177.127.152:3000/api/health`
* **Server Info:** `http://10.177.127.152:3000/api/server/info`
* **POS Till:** `http://10.177.127.152:3000/pos`
* **Kitchen KDS:** `http://10.177.127.152:3000/kds`
* **Waiter App:** `http://10.177.127.152:3000/approvals`
* **Owner Dashboard:** `http://10.177.127.152:3000/dashboard`

---

## 6. Testing Operational Flows

### 6.1 Staff Authentication Test
* Navigate to `/login`.
* Enter PIN `1111` (Owner) or `2222` (Cashier).
* Session JWT cookie (`cafeos_session`) is created and verified against local PostgreSQL `staff_users` table.

### 6.2 POS Order Transaction Test
* Open `/pos`.
* Select table (e.g. `T1` or `Takeaway`).
* Add items (e.g. `Kahwa Special Tea`, `Samosa`).
* Pay via Cash or UPI.
* Order is created in local PostgreSQL `orders`, `order_items`, `kots`, `payments`, `stock_ledger`, and `audit_log`.

### 6.3 KDS Queue Test
* Open `/kds`.
* KDS loads active orders from local DB via `GET /api/orders?status=in_kitchen`.
* Progress ticket: `NEW` → `PREPARING` → `READY` → `SERVED`.

### 6.4 Waiter Approval Flow Test
* Customer submits QR order.
* Order written locally as `pending_approval`.
* Waiter opens `/approvals` and taps **Approve**.
* Order status advances to `in_kitchen` for KDS prep.

### 6.5 GST & Revenue Analytics Test
* Open `/dashboard`.
* View revenue metrics, GST tax summary (`/api/dashboard/reports/gst`), and stock item levels—all queried directly from local PostgreSQL.

---

## 7. Internet-Off Failure Test Procedure

To verify 100% local-first independence:

1. Disconnect the Main PC WAN connection (e.g., unplug Internet cable from router or disable cellular modem).
2. Keep Local LAN / Wi-Fi router powered **ON**.
3. Perform Staff Login, POS Order Placement, KDS Order Fetching, Waiter Approvals, and Dashboard Analytics.
4. **Expected Result:** All HTTP API routes, local database transactions, PIN logins, and GST calculations continue operating cleanly without errors.

---

## 8. Troubleshooting & Common Issues

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| `[ensure-db] Local database is not initialized yet` | Embedded Postgres data dir uncreated | Run `npm run db:local` once from `local-first/platform` |
| `Port 5433 already in use` | Another instance of Postgres is running | Terminate old node/postgres processes using Task Manager or `taskkill /F /IM postgres.exe` |
| `Cannot connect from mobile device` | Windows Firewall blocking port 3000 | Allow `Node.js` through Windows Defender Firewall for Private Networks |
| `Invalid session cookie` | System clock drift or missing JWT secret | Ensure `JWT_SECRET` is set in `.env` and system time is accurate |
