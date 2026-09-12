# ChayaOne OS — Complete Step-by-Step Installation & Setup Guide

This guide provides the complete, end-to-end instructions for installing, configuring, seeding, and running **ChayaOne OS** on your Main PC or server.

---

## 📋 Table of Contents
1. [System Requirements & Prerequisites](#1-system-requirements--prerequisites)
2. [Step 1: Install Dependencies](#step-1-install-dependencies)
3. [Step 2: Environment Configuration](#step-2-environment-configuration)
4. [Step 3: Initialize Database & Seed Menu Data](#step-3-initialize-database--seed-menu-data)
5. [Step 4: Launch ChayaOne OS](#step-4-launch-chayaone-os)
6. [Step 5: Run the First-Time Setup Wizard](#step-5-run-the-first-time-setup-wizard)
7. [Step 6: Accessing Cafe Surfaces (POS, KDS, Customer App, Waiter)](#step-6-accessing-cafe-surfaces)
8. [Step 7: Connecting Customer Phones & Waiter Tablets (LAN / Wi-Fi)](#step-7-connecting-customer-phones--waiter-tablets-lan--wi-fi)
9. [Troubleshooting & Common Fixes](#troubleshooting--common-fixes)

---

## 1. System Requirements & Prerequisites

* **Operating System**: Windows 10/11 (64-bit), macOS, or Ubuntu/Linux
* **Node.js**: `>= 20.0.0` (LTS recommended). Check with:
  ```powershell
  node -v
  ```
* **npm**: `>= 10.8.0`. Check with:
  ```powershell
  npm -v
  ```
* **Git**: Installed and available in terminal
* **Database**: **No manual PostgreSQL or Docker installation is needed**. ChayaOne OS includes an automated embedded PostgreSQL engine (`embedded-postgres`) that runs locally on port `5433`.

---

## Step 1: Install Dependencies

Open PowerShell or terminal in the project root directory:

```powershell
# Navigate to the workspace root
cd "c:\nuro 7\CHAYAONE\CHAYAONE OS"

# Install all workspace dependencies across all packages
npm install
```

---

## Step 2: Environment Configuration

Verify that the local environment configuration exists at `local-first/platform/.env`.

If it does not exist, create `local-first/platform/.env` with the following default configuration:

```env
# Local Embedded PostgreSQL Database
DATABASE_URL="postgresql://cafeos:cafeos@localhost:5433/cafeos"
DIRECT_URL="postgresql://cafeos:cafeos@localhost:5433/cafeos"

# Runtime Environment
NODE_ENV="development"
CHAYAONE_RUNTIME_MODE="local"
PORT=3000

# Security & Auth Tokens
JWT_SECRET="chayaone-local-server-secret-jwt-key-32chars"
PLATFORM_JWT_SECRET="chayaone-platform-secret-jwt-key-32chars"

# Default Demo Tenant
DEV_TENANT_SUBDOMAIN="kahwa"

# Feature Flags
NEXT_PUBLIC_ENABLE_GAMES="true"
NEXT_PUBLIC_ENABLE_LOYALTY="true"
```

---

## Step 3: Initialize Database & Seed Menu Data

Run the database setup commands from the root directory:

### 3.1 Push Database Schema
Sync your Prisma database schema to the local embedded PostgreSQL:
```powershell
npm run db:push
```
*Expected Output:*
```
✔ Generated Prisma Client
Your database is now in sync with your Prisma schema.
```

### 3.2 Seed Cafe Menu & Staff Accounts
Seed initial cafe categories (Coffee, Chai, Coolers, Bakery), items, and default staff PINs:
```powershell
npm run db:seed:full
```

*Default Seed Credentials:*
* **Owner PIN**: `1111` (Full access to Dashboard, Financials, Settings, POS)
* **Cashier PIN**: `2222` (Billing till, Takeaway, Table settlements)
* **Kitchen PIN**: `3333` (KDS display & ticket bump operations)
* **Manager PIN**: `4444` (Approvals, table splits/merges, discount overrides)

---

## Step 4: Launch ChayaOne OS

You can launch ChayaOne OS using either of two methods:

### Option A: One-Click Launch (Windows — Recommended for Cafe Till)
Simply double-click the file:
```
local-first\START_CHAYAONE.bat
```
This batch script will automatically:
1. Start the embedded PostgreSQL daemon on port `5433`.
2. Start the ChayaOne Web Platform, WebSocket, and Thermal Print Engine on port `3000`.
3. Auto-open the POS interface in your browser.

---

### Option B: Terminal Dev Mode (For Developers)
From the root workspace directory, run:
```powershell
npm run dev
```

Once running, your local server is live at:
```
http://localhost:3000
```

---

## Step 5: Run the First-Time Setup Wizard

If onboarding a new cafe or configuring an outlet for the first time:

1. Open your browser and navigate to:
   ```
   http://localhost:3000/setup
   ```
2. **Step 1 (Cafe Identity)**: Enter your Cafe Name (e.g. *ChayaOne Bistro*) and Subdomain.
3. **Step 2 (Staff Security)**: Set your 4-digit **Owner PIN** and **Manager PIN**.
4. **Step 3 (Hardware)**: Enter your thermal network printer IP (e.g. `192.168.1.200`) or leave empty to use Windows default printing.
5. Click **Complete & Launch POS** — your cafe is initialized and redirected to the POS till!

---

## Step 6: Accessing Cafe Surfaces

All surfaces run on the unified **"Roasted Daylight"** brand UI on port `3000`:

| Surface | Direct URL | Description |
| :--- | :--- | :--- |
| **Customer QR Menu** | [`http://localhost:3000/app`](http://localhost:3000/app) | Digital menu, self-ordering, cafe mini-games, order tracking, and rewards |
| **Table QR Simulator** | [`http://localhost:3000/t/demo`](http://localhost:3000/t/demo) | Simulated table QR scan (bounces to `/app?t=demo`) |
| **Cashier POS Till** | [`http://localhost:3000/pos`](http://localhost:3000/pos) | Fast billing, KOT punching, floor tables, and payment settlement |
| **Express Table Billing**| [`http://localhost:3000/t-billing`](http://localhost:3000/t-billing)| Quick table invoice settlement and GST receipts |
| **Kitchen Display (KDS)**| [`http://localhost:3000/kds`](http://localhost:3000/kds) | Real-time kitchen tickets, prep timers, and order bump station |
| **Waiter Approvals** | [`http://localhost:3000/approvals`](http://localhost:3000/approvals)| Waiter screen to accept/confirm guest QR orders and table requests |
| **Owner Dashboard** | [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard)| Sales reports, floor plan editor, table QR printouts, and inventory |
| **Staff Login** | [`http://localhost:3000/login`](http://localhost:3000/login) | Fast PIN pad and username/password login |

---

## Step 7: Connecting Customer Phones & Waiter Tablets (LAN / Wi-Fi)

To allow customer phones and waiter tablets to connect to the Main PC over local Wi-Fi:

### 1. Find Your Main PC's Local IP Address
Open PowerShell and run:
```powershell
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi or Ethernet adapter (e.g. `192.168.1.50`).

### 2. Allow Port 3000 in Windows Defender Firewall
Run this PowerShell command as Administrator to permit incoming tablet & smartphone traffic:
```powershell
New-NetFirewallRule -DisplayName "ChayaOne Cafe Local Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 3. Open on Guest Phones & Waiter Tablets
Ensure the smartphone or tablet is connected to the cafe Wi-Fi network, then open:
* **Customer Table Menu**: `http://192.168.1.50:3000/app?t=<tableToken>`
* **Waiter Floor Terminal**: `http://192.168.1.50:3000/approvals`
* **Kitchen Screen (KDS)**: `http://192.168.1.50:3000/kds`

---

## Troubleshooting & Common Fixes

### 1. Port 3000 or Port 5433 Already in Use
If another process is occupying port 3000 or the database port 5433, stop lingering Node processes:
```powershell
# In PowerShell:
Stop-Process -Name "node" -Force
```
Then restart using `npm run dev` or `START_CHAYAONE.bat`.

### 2. Reset / Wipe Local Database
To completely clear and re-initialize the local database from scratch:
```powershell
# 1. Stop server if running
# 2. Push fresh schema
npm run db:push

# 3. Seed fresh menu and accounts
npm run db:seed:full
```

### 3. Database Studio (Visual Table Explorer)
To view raw orders, customers, and menu items directly in your browser:
```powershell
npm run db:studio
```
Opens Prisma Studio on `http://localhost:5555`.

### 4. Build Production Desktop Bundle
To build a production standalone Windows installer:
```powershell
npm run build:installer
```
Installer outputs are generated in `local-first/installer/output/`.
