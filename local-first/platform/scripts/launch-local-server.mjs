/**
 * ChayaOne OS — Main PC Local Server Launcher
 * Terminal-free local server launcher for Windows Cafe Main PC.
 *
 * 1. Checks if server is already running on port 3000 (auto-opens POS without crashing)
 * 2. Checks and starts embedded PostgreSQL (port 5433) via ensure-db.mjs
 * 3. Starts Next.js Web Platform (port 3000)
 * 4. Auto-opens POS in the browser
 * 5. Keeps the process alive and responsive to Ctrl+C
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const dbDir = join(platformDir, 'packages', 'db');
const webDir = join(platformDir, 'apps', 'web');

console.log('=================================================================');
console.log('            CHAYAONE OS — MAIN PC LOCAL SERVER & POS             ');
console.log('=================================================================\n');

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: 'inherit',
    });
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

import { openDesktopApp } from './open-desktop-app.mjs';

async function launchDesktopPOS(url = 'http://localhost:3000/pos') {
  await openDesktopApp(url, {
    width: 1440,
    height: 900,
    title: 'ChayaOne POS (Main PC)',
  });
}

async function main() {
  try {
    // 0. Check if already running on port 3000
    const alreadyRunning = await probeHttp('http://localhost:3000/api/server/info');
    if (alreadyRunning) {
      console.log('✅ ChayaOne Local Server is ALREADY running on http://localhost:3000');
      await launchDesktopPOS('http://localhost:3000/pos');
      console.log('\n💡 The server is running in another process/window.');
      console.log('👉 Access POS:       http://localhost:3000/pos');
      console.log('👉 Kitchen Display: http://localhost:3000/kds');
      console.log('👉 Dashboard:       http://localhost:3000/dashboard\n');
      return;
    }

    // 1. Ensure Local PostgreSQL Server is running
    console.log('🐘 Step 1: Probing & starting embedded PostgreSQL daemon (port 5433)…');
    await runCommand('node', ['scripts/ensure-db.mjs'], dbDir);

    // 2. Launch Next.js Platform Server
    console.log('▲ Step 2: Starting ChayaOne Web Platform Server (port 3000)…');
    const standaloneServer = join(webDir, '.next', 'standalone', 'server.js');
    let serverProc;

    if (existsSync(standaloneServer)) {
      console.log('📦 Launching production standalone bundle…');
      serverProc = spawn('node', ['.next/standalone/server.js'], {
        cwd: webDir,
        shell: true,
        stdio: 'inherit',
      });
    } else {
      console.log('⚡ Launching Next.js server…');
      serverProc = spawn('npm', ['run', 'dev'], {
        cwd: webDir,
        shell: true,
        stdio: 'inherit',
      });
    }

    // 3. Poll server readiness and open browser
    console.log('⏳ Waiting for ChayaOne Local Server readiness…');
    let ready = false;
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ready = await probeHttp('http://localhost:3000/api/server/info');
      if (ready) break;
    }

    if (ready) {
      console.log('\n=================================================================');
      console.log('✅ ChayaOne OS Local Server is LIVE on http://localhost:3000');
      console.log('👉 Cashier POS:     http://localhost:3000/pos');
      console.log('👉 Kitchen Display: http://localhost:3000/kds');
      console.log('👉 Table Billing:   http://localhost:3000/t-billing');
      console.log('👉 Dashboard:       http://localhost:3000/dashboard');
      console.log('=================================================================\n');
      console.log('💡 Keep this window open while using ChayaOne OS.');
      console.log('   Press Ctrl+C to stop the server.\n');
      await launchDesktopPOS('http://localhost:3000/pos');
    } else {
      console.warn('⚠️ Server is still initializing. Navigate to http://localhost:3000/pos in your browser.');
    }

    // 4. KEEP PROCESS ALIVE while serverProc is running
    await new Promise((resolve, reject) => {
      serverProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Server process exited with code ${code}`));
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
  } catch (err) {
    console.error('❌ ChayaOne Local Server error:', err?.message || err);
    process.exit(1);
  }
}

main();
