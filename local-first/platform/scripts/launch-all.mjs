/**
 * ChayaOne OS — Master All-in-One Multi-Device Launcher
 *
 * Concurrently starts:
 * 1. Embedded Postgres Database (Port 5433)
 * 2. Main PC Server & POS Platform (Port 3000)
 * 3. Waiter Tablet App (Port 3002)
 * 4. Customer PWA App (Port 3003)
 * 5. Owner Management Portal (Port 3004)
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const rootDir = join(platformDir, '..', '..');
const dbDir = join(platformDir, 'packages', 'db');
const webDir = join(platformDir, 'apps', 'web');
const waiterDir = join(platformDir, 'apps', 'waiter');
const customerDir = join(platformDir, 'apps', 'customer');
const ownerDir = join(rootDir, 'Owner-chayaone');

function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (lower.includes('vmware') || lower.includes('virtual') || lower.includes('vethernet') || lower.includes('wsl')) {
      continue;
    }
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        let priority = 10;
        if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan') || lower.includes('wireless')) {
          priority = 100;
        } else if (lower.includes('ethernet') || lower.includes('eth') || lower.includes('en')) {
          priority = 80;
        }
        candidates.push({ name, address: iface.address, priority });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.address || '127.0.0.1';
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, shell: true, stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function probeHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function openBrowser(url) {
  console.log(`🌐 Opening in browser: ${url}`);
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    console.warn(`Could not auto-open browser: ${e.message}`);
  }
}

async function main() {
  const lanIp = getLocalLanIp();

  console.log('=================================================================');
  console.log('         CHAYAONE OS — COMPLETE LOCAL CAFE PLATFORM              ');
  console.log('=================================================================');
  console.log(`🐘 Local Database:     localhost:5433 (PostgreSQL)`);
  console.log(`💻 Main PC (POS/Server): http://localhost:3000/pos`);
  console.log(`📲 Waiter Tablet App:    http://${lanIp}:3002`);
  console.log(`📱 Customer QR App:      http://${lanIp}:3003/t/demo`);
  console.log(`📊 Owner Management:     http://localhost:3004`);
  console.log('=================================================================\n');

  try {
    // 1. Database
    console.log('🐘 Step 1: Starting embedded PostgreSQL...');
    await runCommand('node', ['scripts/ensure-db.mjs'], dbDir);

    // 2. Main PC Web Server & POS
    console.log('💻 Step 2: Starting Main PC Web Server & POS Till (port 3000)...');
    const webProc = spawn('npm', ['run', 'dev'], {
      cwd: webDir,
      shell: true,
      windowsHide: true,
      stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
    });

    // 3. Waiter App
    console.log('📲 Step 3: Starting Waiter Tablet App (port 3002)...');
    const waiterProc = spawn('npm', ['run', 'dev'], {
      cwd: waiterDir,
      shell: true,
      windowsHide: true,
      stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
      env: { ...process.env, PORT: '3002', NEXT_PUBLIC_SERVER_URL: `http://${lanIp}:3000` },
    });

    // 4. Customer App
    console.log('📱 Step 4: Starting Customer QR App (port 3003)...');
    const customerProc = spawn('npm', ['run', 'dev'], {
      cwd: customerDir,
      shell: true,
      windowsHide: true,
      stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
      env: { ...process.env, PORT: '3003', NEXT_PUBLIC_SERVER_URL: `http://${lanIp}:3000` },
    });

    // 5. Owner App
    console.log('📊 Step 5: Starting Owner Management Portal (port 3004)...');
    const ownerProc = spawn('npm', ['run', 'dev'], {
      cwd: ownerDir,
      shell: true,
      windowsHide: true,
      stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
      env: { ...process.env, PORT: '3004', NEXT_PUBLIC_APP_URL: 'http://localhost:3004' },
    });

    // Poll Main PC POS readiness
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ready = await probeHttp('http://localhost:3000/api/server/info');
      if (ready) break;
    }

    if (ready) {
      console.log('\n=================================================================');
      console.log('🎉 ALL CHAYAONE APPS & SUB-APPS ARE LIVE!');
      console.log(`👉 Main PC Till:     http://localhost:3000/pos`);
      console.log(`👉 Kitchen (KDS):     http://localhost:3000/kds`);
      console.log(`👉 Waiter App:       http://${lanIp}:3002`);
      console.log(`👉 Customer App:     http://${lanIp}:3003/t/demo`);
      console.log(`👉 Owner Portal:     http://localhost:3004`);
      console.log('=================================================================\n');
      await openBrowser('http://localhost:3000/pos');
    }

    const cleanup = () => {
      try { webProc.kill(); } catch {}
      try { waiterProc.kill(); } catch {}
      try { customerProc.kill(); } catch {}
      try { ownerProc.kill(); } catch {}
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    await new Promise((resolve) => {
      webProc.on('close', resolve);
    });
  } catch (err) {
    console.error('❌ Error starting ChayaOne apps:', err);
    process.exit(1);
  }
}

main();
