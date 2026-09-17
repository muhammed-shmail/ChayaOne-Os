/**
 * ChayaOne OS — Waiter Tablet / Mobile App Launcher
 *
 * Starts the Waiter App on port 3002 and connects to the Main PC Server.
 * Displays local LAN IP for waiter tablets on the café Wi-Fi.
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const waiterDir = join(platformDir, 'apps', 'waiter');

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
  console.log(`🌐 Opening Waiter App in browser: ${url}`);
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
  console.log('            CHAYAONE OS — WAITER TABLET APP (PORT 3002)          ');
  console.log('=================================================================');
  console.log(`📡 Local Main PC Server: http://${lanIp}:3000`);
  console.log(`📱 Local Waiter URL:     http://localhost:3002`);
  console.log(`📲 Waiter Tablet LAN:    http://${lanIp}:3002`);
  console.log('=================================================================\n');

  // Check if already running
  const alreadyRunning = await probeHttp('http://localhost:3002/tables');
  if (alreadyRunning) {
    console.log('✅ Waiter App is ALREADY running on http://localhost:3002');
    console.log(`👉 Open on your tablet: http://${lanIp}:3002\n`);
    await openBrowser('http://localhost:3002/tables');
    return;
  }

  console.log('⚡ Starting Waiter App runtime on port 3002…');
  const waiterProc = spawn('npm', ['run', 'dev'], {
    cwd: waiterDir,
    shell: true,
    windowsHide: true,
    stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
    env: {
      ...process.env,
      PORT: '3002',
      NEXT_PUBLIC_SERVER_URL: `http://${lanIp}:3000`,
    },
  });

  // Wait for port 3002 readiness
  console.log('⏳ Waiting for Waiter App to initialize…');
  let ready = false;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await probeHttp('http://localhost:3002/tables');
    if (ready) break;
  }

  if (ready) {
    console.log('\n=================================================================');
    console.log('✅ ChayaOne Waiter App is READY!');
    console.log(`👉 Open on any tablet/phone on your Wi-Fi: http://${lanIp}:3002`);
    console.log('=================================================================\n');
    console.log('💡 Keep this window open while waitstaff are taking orders.');
    console.log('   Press Ctrl+C to stop the Waiter App.\n');
    await openBrowser('http://localhost:3002/tables');
  } else {
    console.log(`⚠️ Waiter App is still starting... navigate to http://localhost:3002 or http://${lanIp}:3002`);
  }

  // Keep process alive
  await new Promise((resolve, reject) => {
    waiterProc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Waiter App exited with code ${code}`));
    });
    waiterProc.on('error', reject);

    const cleanup = () => {
      try {
        waiterProc.kill();
      } catch {}
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

main();
