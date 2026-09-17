/**
 * ChayaOne OS — Owner Cloud / Remote Portal Launcher
 *
 * Starts the standalone Owner Dashboard on port 3004.
 * Provides remote multi-store management, revenue reports, and store oversight.
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..', '..');
const ownerDir = join(rootDir, 'Owner-chayaone');

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
  console.log(`🌐 Opening Owner Portal in browser: ${url}`);
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
  console.log('=================================================================');
  console.log('          CHAYAONE OS — OWNER MANAGEMENT PORTAL (PORT 3004)      ');
  console.log('=================================================================');
  console.log('📊 Multi-Store Revenue Analytics & Live Operations');
  console.log('🔗 URL: http://localhost:3004');
  console.log('=================================================================\n');

  // Check if already running
  const alreadyRunning = await probeHttp('http://localhost:3004/login');
  if (alreadyRunning) {
    console.log('✅ Owner Portal is ALREADY running on http://localhost:3004\n');
    await openBrowser('http://localhost:3004');
    return;
  }

  console.log('⚡ Starting Owner Dashboard runtime on port 3004…');
  const ownerProc = spawn('npm', ['run', 'dev'], {
    cwd: ownerDir,
    shell: true,
    windowsHide: true,
    stdio: process.stdout?.isTTY ? 'inherit' : 'ignore',
    env: {
      ...process.env,
      PORT: '3004',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3004',
    },
  });

  // Wait for port 3004 readiness
  console.log('⏳ Waiting for Owner Portal to initialize…');
  let ready = false;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await probeHttp('http://localhost:3004/login');
    if (ready) break;
  }

  if (ready) {
    console.log('\n=================================================================');
    console.log('✅ ChayaOne Owner Management Portal is READY!');
    console.log('👉 Open in browser: http://localhost:3004');
    console.log('=================================================================\n');
    console.log('💡 Keep this window open while managing your stores.');
    console.log('   Press Ctrl+C to stop the Owner Portal.\n');
    await openBrowser('http://localhost:3004');
  } else {
    console.log('⚠️ Owner Portal is still starting... navigate to http://localhost:3004');
  }

  // Keep process alive
  await new Promise((resolve, reject) => {
    ownerProc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Owner Portal exited with code ${code}`));
    });
    ownerProc.on('error', reject);

    const cleanup = () => {
      try {
        ownerProc.kill();
      } catch {}
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

main();
