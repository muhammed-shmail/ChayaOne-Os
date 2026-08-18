/**
 * ChayaOne OS — Main PC Local Server Launcher
 * Terminal-free local server launcher for Windows Cafe Main PC.
 *
 * 1. Checks and starts embedded PostgreSQL (port 5433) via ensure-db.mjs
 * 2. Starts Next.js Web Platform (port 3000)
 * 3. Auto-opens POS in the browser
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const dbDir = join(platformDir, 'packages', 'db');

console.log('🚀  Initializing ChayaOne OS Local Server Runtime…');

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
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function openBrowser(url) {
  console.log(`🌐 Opening POS Till in browser: ${url}`);
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(`${startCmd} ${url}`, { shell: true });
}

async function main() {
  try {
    // 1. Ensure Local PostgreSQL Server is running
    console.log('🐘 Step 1: Probing & starting embedded PostgreSQL daemon…');
    await runCommand('node', ['scripts/ensure-db.mjs'], dbDir);

    // 2. Launch Next.js Platform Server
    console.log('▲ Step 2: Starting ChayaOne Web Platform Server…');
    const webDir = join(platformDir, 'apps', 'web');
    
    // Check if standalone build exists, otherwise run dev mode
    const standaloneServer = join(webDir, '.next', 'standalone', 'server.js');
    let serverProc;

    if (existsSync(standaloneServer)) {
      console.log('📦 Launching production standalone bundle…');
      serverProc = spawn('node', ['.next/standalone/server.js'], { cwd: webDir, shell: true, stdio: 'inherit' });
    } else {
      console.log('⚡ Launching Next.js server…');
      serverProc = spawn('npm', ['run', 'dev'], { cwd: webDir, shell: true, stdio: 'inherit' });
    }

    // 3. Poll server readiness and open browser
    console.log('⏳ Waiting for ChayaOne Local Server readiness…');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ready = await probeHttp('http://localhost:3000/api/server/info');
      if (ready) break;
    }

    if (ready) {
      console.log('✅ ChayaOne OS Local Server is LIVE on http://localhost:3000');
      await openBrowser('http://localhost:3000/pos');
    } else {
      console.warn('⚠️ Server took longer than expected to start. Please navigate to http://localhost:3000 manually.');
    }
  } catch (err) {
    console.error('❌ Failed to launch ChayaOne Local Server:', err);
    process.exit(1);
  }
}

main();
