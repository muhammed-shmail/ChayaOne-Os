# ChayaOne OS — Complete Step-by-Step Installation & Multi-App Setup Guide

This guide provides the complete, end-to-end instructions for installing, configuring, seeding, and running **ChayaOne OS** on your Main PC, as well as launching the **Main PC App**, **Waiter App**, **Customer App**, and **Owner Management Portal** independently or concurrently.

---

## 📋 Table of Contents
1. [Architecture & 5 Dedicated Apps / Sub-Apps](#1-architecture--5-dedicated-apps--sub-apps)
2. [System Requirements & Prerequisites](#2-system-requirements--prerequisites)
3. [Step 1: Install Dependencies](#step-1-install-dependencies)
4. [Step 2: Environment Configuration](#step-2-environment-configuration)
5. [Step 3: Initialize Database & Seed Menu Data](#step-3-initialize-database--seed-menu-data)
6. [Step 4: Launching the Apps & Sub-Apps](#step-4-launching-the-apps--sub-apps)
   * [App 1: Main PC (Server, Database, POS Till, KDS & Dashboard)](#app-1-main-pc-server-database-pos-kds--dashboard)
   * [App 2: Waiter App (Tablets & Handhelds)](#app-2-waiter-app-tablets--handhelds)
   * [App 3: Customer App (Table QR Ordering & PWA)](#app-3-customer-app-table-qr-ordering--pwa)
   * [App 4: Owner Portal (Remote Multi-Store Analytics)](#app-4-owner-portal-remote-multi-store-analytics)
   * [Sub-App: Kitchen Display Station (KDS)](#sub-app-kitchen-display-station-kds)
   * [Master Launcher: Start All Apps Concurrently](#master-launcher-start-all-apps-concurrently)
7. [Step 5: Run the First-Time Setup Wizard](#step-5-run-the-first-time-setup-wizard)
8. [Step 6: Connecting Devices on Cafe Local Wi-Fi (LAN)](#step-6-connecting-devices-on-cafe-local-wi-fi-lan)
9. [Troubleshooting & Common Fixes](#troubleshooting--common-fixes)

---

## 1. Architecture & 5 Dedicated Apps / Sub-Apps

ChayaOne OS is organized into dedicated, collision-free applications:

```
                          ┌────────────────────────────────────────────────────────┐
                          │                MAIN PC (LOCAL SERVER)                  │
                          │   • Embedded PostgreSQL Database (Port 5433)           │
                          │   • Local API & WebSocket Engine (Port 3000 / 3001)    │
                          │   • Cashier POS Till (/pos)                            │
                          │   • Kitchen Display System (/kds)                      │
                          │   • Owner Dashboard (/dashboard)                       │
                          │   • Setup Wizard & Print Spooler (/setup)              │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │
                                   Local Wi-Fi Network / LAN
                                                     │
      ┌───────────────────────────────┬──────────────┴────────────────┬───────────────────────────────┐
      │                               │                               │                               │
┌─────▼─────────┐             ┌───────▼───────┐               ┌───────▼───────┐               ┌───────▼───────┐
│  WAITER APP   │             │ CUSTOMER APP  │               │  KDS STATION  │               │ OWNER PORTAL  │
│ • Port 3002   │             │ • Port 3003   │               │ • Port 3000   │               │ • Port 3004   │
│ • Tablet POS  │             │ • Mobile QR   │               │ • /kds Route  │               │ • Standalone  │
│ • Tables Map  │             │ • PWA Menu    │               │ • Ticket Bump │               │ • Multi-Store │
│ • Approvals   │             │ • Mini-Games  │               │ • Prep Timers │               │ • Analytics   │
└───────────────┘             └───────────────┘               └───────────────┘               └───────────────┘
```

---

## 2. System Requirements & Prerequisites

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

## Step 4: Launching the Apps & Sub-Apps

You can launch each application individually, or run all of them simultaneously.

### App 1: Main PC (Server, Database, POS, KDS & Dashboard)
The core local brain of the café. Manages PostgreSQL, processes orders, and runs the Cashier POS Till.

* **1-Click Launch (Windows)**:
  ```
  START-MAIN-PC.bat
  ```
* **Terminal Command**:
  ```powershell
  npm run start:main-pc
  ```
* **Access URLs**:
  * **Cashier POS Till**: [`http://localhost:3000/pos`](http://localhost:3000/pos)
  * **Kitchen Display (KDS)**: [`http://localhost:3000/kds`](http://localhost:3000/kds)
  * **Table Billing**: [`http://localhost:3000/t-billing`](http://localhost:3000/t-billing)
  * **Owner Dashboard**: [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard)
  * **Setup Wizard**: [`http://localhost:3000/setup`](http://localhost:3000/setup)

---

### App 2: Waiter App (Tablets & Handhelds)
Designed specifically for waitstaff on tablets or smartphones taking orders at tables, managing transfers, and approving QR orders.

* **1-Click Launch (Windows)**:
  ```
  START-WAITER-APP.bat
  ```
* **Terminal Command**:
  ```powershell
  npm run start:waiter
  ```
* **Access URLs**:
  * **Local Waiter Screen**: [`http://localhost:3002`](http://localhost:3002)
  * **LAN Tablet URL**: `http://<MAIN_PC_IP>:3002` (Auto-detected and displayed in console)
  * **Main PC Route**: [`http://localhost:3000/waiter`](http://localhost:3000/waiter)

---

### App 3: Customer App (Table QR Ordering & PWA)
The customer-facing digital menu and self-ordering PWA. Customers scan table QR codes to view items, customize orders, and pay.

#### A. Customer 4G/5G Cellular Data Mode (Recommended — Zero Café Wi-Fi Traffic)
Customers scan table QR codes using **their own mobile data (4G/5G)**. Zero customer traffic touches your café Wi-Fi router, keeping the internal network fast and free for billing, waiter tablets, and KDS tickets.

* **1-Click Launch (Windows)**:
  ```
  START-CUSTOMER-4G-TUNNEL.bat
  ```
* **Behind-the-Scenes**: Starts a secure, free Cloudflare Tunnel that exposes your local server (`http://localhost:3000`) to a public HTTPS address (e.g. `https://xxxx.trycloudflare.com` or your custom domain `https://order.mycafe.com`). Table QR codes automatically encode this public URL.
* **Customer Access**: Open camera on any phone (Jio, Airtel, Vi) $\rightarrow$ Scan Table QR $\rightarrow$ Menu opens over 4G/5G mobile internet $\rightarrow$ Order arrives instantly at Main PC POS & Kitchen KDS.

#### B. Local Wi-Fi Network Mode (Internal / Offline Fallback)
For cafés with no internet or when using café guest tablets:
* **1-Click Launch (Windows)**:
  ```
  START-CUSTOMER-APP.bat
  ```
* **Access URLs**:
  * **Local Customer Test**: [`http://localhost:3003/t/demo`](http://localhost:3003/t/demo)
  * **LAN Phone URL**: `http://<MAIN_PC_IP>:3000/app?t=<tableToken>`
  * **Main PC Route**: [`http://localhost:3000/app?t=demo`](http://localhost:3000/app?t=demo)

---

### App 4: Owner Portal (Remote Multi-Store Analytics)
A standalone multi-store management portal for café owners.

* **1-Click Launch (Windows)**:
  ```
  START-OWNER-APP.bat
  ```
* **Terminal Command**:
  ```powershell
  npm run start:owner
  ```
* **Access URL**:
  * **Owner Portal**: [`http://localhost:3004`](http://localhost:3004)

---

### Sub-App: Kitchen Display Station (KDS)
Dedicated screen for the kitchen or barista pass showing real-time KOT tickets and prep timers.

* **1-Click Launch (Windows)**:
  ```
  START-KDS-APP.bat
  ```
* **Access URL**:
  * **Kitchen Station**: [`http://localhost:3000/kds`](http://localhost:3000/kds)

---

### Master Launcher: Start All Apps Concurrently
To start the entire cafe network (Database + Main PC POS + Waiter App + Customer App + Owner Portal) in one click:

* **1-Click Launch (Windows)**:
  ```
  START-ALL-APPS.bat
  ```
* **Terminal Command**:
  ```powershell
  npm run start:all
  ```

---

### Native Android APKs (Waiter & Customer Tablets/Phones)

Standalone installable `.apk` packages are built and ready in `android/release-apks/`:

| Android App | Package Name | APK File | Description |
| :--- | :--- | :--- | :--- |
| **ChayaOne Waiter** | `com.chayaone.waiter` | [`ChayaOne-Waiter.apk`](file:///c:/nuro%207/CHAYAONE/CHAYAONE%20OS/android/release-apks/ChayaOne-Waiter.apk) | Dedicated staff tablet order-taking app with IP configuration dialog |
| **ChayaOne Customer** | `com.chayaone.customer` | [`ChayaOne-Customer.apk`](file:///c:/nuro%207/CHAYAONE/CHAYAONE%20OS/android/release-apks/ChayaOne-Customer.apk) | Customer Wi-Fi digital menu and table self-ordering app |

#### How to Install on Any Android Device:
1. **Option A (Direct File Transfer)**:
   - Copy `ChayaOne-Waiter.apk` or `ChayaOne-Customer.apk` to your phone/tablet via USB cable, Bluetooth, or Google Drive.
   - Tap the APK file on your Android device to install (allow "Install from Unknown Sources" if prompted).
2. **Option B (1-Click USB ADB Installer)**:
   - Connect your Android phone or tablet to this PC with a USB cable.
   - Enable **USB Debugging** under Android Developer Options.
   - Double-click [`INSTALL-APK-TO-DEVICE.bat`](file:///c:/nuro%207/CHAYAONE/CHAYAONE%20OS/INSTALL-APK-TO-DEVICE.bat) and choose option 1, 2, or 3.

#### How to Connect on the Cafe Wi-Fi:
* **Waiter App**:
  - Open the app on your Android tablet/phone.
  - Enter the Main PC Wi-Fi IP address (defaults to `10.46.182.152`) and port (`3000`).
  - Tap **Test Ping** to confirm connectivity, then tap **Connect**.
  - The tablet will load the live Waiter ordering interface and remember the IP permanently. Tap the top-right `⚙️` badge anytime to change the IP.
* **Customer App**:
  - Ensure the tablet or phone is connected to the cafe's Wi-Fi network.
  - Open the app, confirm the Main PC IP (`10.46.182.152`), and set the Table Token (e.g. `demo` or table number).
  - Customers can browse the digital menu, play mini-games, and submit orders directly over Wi-Fi.

#### How to Recompile APKs:
* Double-click [`BUILD-APKS.bat`](file:///c:/nuro%207/CHAYAONE/CHAYAONE%20OS/BUILD-APKS.bat) to recompile both APKs locally.


## Step 5: Run the First-Time Setup Wizard

If onboarding a new cafe or configuring an outlet for the first time:

1. Open your browser and navigate to:
   ```
   http://localhost:3000/setup
   ```
2. **Step 1 (Business Profile)**: Select your venue type (`Café / Tea Shop`, `Restaurant / Hotel`, `Hotel Management`, `Juice Shop`, `Meals / Rice Shop`, `Multi-category`).
3. **Step 2 (Operating Modules)**: Toggles for modules (Core is mandatory; recommended modules are pre-selected with auto-dependency resolution).
4. **Step 3 (Cafe Identity)**: Enter your Cafe Name (e.g. *ChayaOne Bistro*) and Subdomain.
5. **Step 4 (Staff Security)**: Set your 4-digit **Owner PIN** and **Manager PIN**.
6. **Step 5 (Hardware)**: Enter your thermal network printer IP (e.g. `192.168.1.200`) and click **Test LAN** to verify ESC/POS test printing.
7. Click **Complete & Launch POS** — your cafe is initialized and redirected to the POS till!

---

## Step 6: Connecting Devices on Cafe Local Wi-Fi (LAN)

To allow customer phones and waiter tablets to connect to the Main PC over local Wi-Fi without internet:

### 1. Find Your Main PC's Local IP Address
Open PowerShell and run:
```powershell
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi or Ethernet adapter (e.g. `192.168.1.50`).

### 2. Allow Inbound Traffic in Windows Defender Firewall
Run this PowerShell command as Administrator to permit incoming tablet & smartphone traffic:
```powershell
New-NetFirewallRule -DisplayName "ChayaOne Main PC Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ChayaOne Waiter App" -Direction Inbound -LocalPort 3002 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ChayaOne Customer App" -Direction Inbound -LocalPort 3003 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ChayaOne Owner Portal" -Direction Inbound -LocalPort 3004 -Protocol TCP -Action Allow
```

### 3. Open on Guest Phones & Waiter Tablets
Ensure the smartphone or tablet is connected to the same Wi-Fi network:
* **Waiter Tablets**: `http://192.168.1.50:3002`
* **Customer Table Menu**: `http://192.168.1.50:3003/t/<tableToken>`
* **Kitchen Screen (KDS)**: `http://192.168.1.50:3000/kds`
* **Owner Dashboard**: `http://192.168.1.50:3004`

---

## Troubleshooting & Common Fixes

### 1. Port 3000, 3002, 3003, 3004 or 5433 Already in Use
If another process is occupying ports, stop lingering Node processes:
```powershell
Stop-Process -Name "node" -Force
```
Then restart using `START-ALL-APPS.bat` or `START-MAIN-PC.bat`.

### 2. Reset / Wipe Local Database
To completely clear and re-initialize the local database from scratch:
```powershell
npm run db:push
npm run db:seed:full
```

### 3. Database Studio (Visual Table Explorer)
To view raw orders, customers, and menu items directly in your browser:
```powershell
npm run db:studio
```
Opens Prisma Studio on `http://localhost:5555`.

### 4. Windows 1-Click Desktop Shortcuts
To create convenient 1-click shortcuts directly on your Windows Desktop:
1. Double-click `CREATE-DESKTOP-SHORTCUTS.bat` in the project root.
2. The following shortcuts will instantly appear on your Windows Desktop:
   * **ChayaOne POS (Main PC)**
   * **ChayaOne Kitchen Display (KDS)**
   * **ChayaOne Waiter App**
   * **ChayaOne Customer QR Menu**
   * **ChayaOne Owner Portal**
   * **ChayaOne Master Launcher (All Apps)**
3. You can double-click any shortcut directly from your desktop at any time.

### 5. Build Production Desktop Bundle
To build a production standalone Windows installer:
```powershell
npm run build:installer
```
Installer outputs are generated in `local-first/installer/output/`.

