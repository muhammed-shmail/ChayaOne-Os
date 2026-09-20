/**
 * ChayaOne OS — Waiter Tablet & Mobile POS Launcher
 *
 * Connects directly to the Main PC Server POS on Port 3000.
 * Displays local LAN IP for waiter tablets on the café Wi-Fi.
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const webDir = join(platformDir, 'apps', 'web');

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
  console.log(`🌐 Opening Waiter POS in browser: ${url}`);
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
  console.log('       CHAYAONE OS — WAITER POS & MOBILE ORDERING (PORT 3000)    ');
  console.log('=================================================================');
  console.log(`💻 Local Main PC POS:  http://localhost:3000/pos`);
  console.log(`📲 Waiter Tablet LAN:  http://${lanIp}:3000/pos`);
  console.log(`🔑 Waiter Staff Login: http://${lanIp}:3000/login`);
  console.log('=================================================================\n');

  // Check if Main PC Server is already online
  const isOnline = await probeHttp('http://127.0.0.1:3000/api/server/info');
  if (isOnline) {
    console.log('✅ Main PC Server is ONLINE and running on port 3000!');
    console.log(`👉 Open on your waiter tablet: http://${lanIp}:3000/pos\n`);
    await openBrowser('http://localhost:3000/pos');
    return;
  }

  console.log('⚡ Main PC Server on port 3000 is starting...');
  const serverProc = spawn('npm', ['run', 'dev'], {
    cwd: webDir,
    shell: true,
    windowsHide: true,
    stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
    env: {
      ...process.env,
      PORT: '3000',
    },
  });

  // Wait for port 3000 readiness
  console.log('⏳ Waiting for Waiter POS to initialize on port 3000…');
  let ready = false;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await probeHttp('http://127.0.0.1:3000/api/server/info');
    if (ready) break;
  }

  if (ready) {
    console.log('\n=================================================================');
    console.log('✅ ChayaOne Waiter POS is READY on Port 3000!');
    console.log(`👉 Open on any tablet/phone on your Wi-Fi: http://${lanIp}:3000/pos`);
    console.log('=================================================================\n');
    console.log('💡 Keep this window open while waitstaff are taking orders.');
    console.log('   Press Ctrl+C to stop.\n');
    await openBrowser('http://localhost:3000/pos');
  } else {
    console.log(`⚠️ Server is still starting... navigate to http://localhost:3000/pos or http://${lanIp}:3000/pos`);
  }

  // Keep process alive
  await new Promise((resolve, reject) => {
    serverProc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Server exited with code ${code}`));
    });
    serverProc.on('error', reject);

    const cleanup = () => {
      try {
        serverProc.kill();
      } catch {}
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

main();
