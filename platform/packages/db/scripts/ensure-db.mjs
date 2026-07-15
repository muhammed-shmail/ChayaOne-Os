/**
 * Cafe OS — ensure the local embedded Postgres is healthy before we touch it.
 *
 * The embedded cluster on :5433 is a persistent, stateful server. On Windows it
 * can end up in one of three states when a command tries to connect:
 *
 *   • healthy — accepts TCP *and* answers the Postgres startup handshake.
 *   • down    — nothing listening (connection refused). Cluster not started.
 *   • wedged  — accepts the TCP socket but never answers the startup packet.
 *               This is the nasty one: `pg_ctl status` and postmaster.pid both
 *               claim "ready", yet every new backend hangs. It happens after an
 *               unclean stop (terminal closed instead of Ctrl+C, sleep/hibernate,
 *               a killed `db:local` wrapper, or an AV/Prisma file lock).
 *
 * This script probes the real state with a raw startup packet (no `pg` dep, so it
 * always runs), then:
 *   healthy → do nothing.
 *   down    → start the cluster (crash-recovers automatically if needed).
 *   wedged  → graceful stop → force-kill our postgres.exe → start.
 *
 * It only manages the *local* embedded DB. If DATABASE_URL points at a remote
 * host it just probes reachability and never tries to start/kill anything.
 *
 * Run:  npm run db:ensure     (or automatically before npm run db:seed)
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPkgDir = join(__dirname, '..');
const dataDir = join(dbPkgDir, '.localdb');
const logFile = join(dataDir, 'pg.log');

const EXE = process.platform === 'win32' ? '.exe' : '';
const PLAT = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform] || process.platform;
const BIN_SUB = join('node_modules', '@embedded-postgres', `${PLAT}-${process.arch}`, 'native', 'bin');

// Path to the embedded pg_ctl binary; resolved once in main() before any use.
let binDir;

const log = (m) => console.log(`[ensure-db] ${m}`);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// --- connection target: default to the local embedded cluster, override from .env ---
function readDatabaseUrl() {
  const envPath = join(dbPkgDir, '..', '..', '.env');
  try {
    const m = readFileSync(envPath, 'utf8').match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let host = 'localhost', port = 5433, user = 'cafeos', database = 'cafeos';
const url = readDatabaseUrl();
if (url) {
  try {
    const u = new URL(url);
    host = u.hostname || host;
    port = Number(u.port) || port;
    user = decodeURIComponent(u.username) || user;
    database = u.pathname.replace(/^\//, '') || database;
  } catch { /* keep defaults */ }
}
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

// --- locate the embedded pg_ctl binary (walk up to the hoisting node_modules) ---
function findBinDir() {
  let dir = dbPkgDir;
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, BIN_SUB);
    if (existsSync(join(cand, `pg_ctl${EXE}`))) return cand;
    dir = dirname(dir);
  }
  return null;
}

// --- probe: healthy | wedged | down ---------------------------------------
// Sends a minimal protocol-3.0 StartupMessage. Any reply byte = the postmaster
// is servicing connections (healthy). TCP up but silent past the timeout = wedged.
function buildStartup() {
  const params = Buffer.from(`user\0${user}\0database\0${database}\0\0`, 'utf8');
  const buf = Buffer.alloc(8 + params.length);
  buf.writeInt32BE(buf.length, 0);
  buf.writeInt32BE(196608, 4); // protocol version 3.0
  params.copy(buf, 8);
  return buf;
}

function probe(timeoutMs = 4000) {
  return new Promise((resolve) => {
    let connected = false, settled = false;
    const sock = net.connect({ host, port });
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { sock.destroy(); } catch { /* ignore */ }
      resolve(v);
    };
    const timer = setTimeout(() => finish(connected ? 'wedged' : 'down'), timeoutMs);
    sock.on('connect', () => { connected = true; sock.write(buildStartup()); });
    sock.on('data', () => finish('healthy'));
    sock.on('error', () => finish(connected ? 'wedged' : 'down'));
    sock.on('close', () => finish(connected ? 'wedged' : 'down'));
  });
}

// --- our-cluster process control (never touches unrelated Postgres) --------
function ourPostgresPids(binDir) {
  if (process.platform === 'win32') {
    const script =
      `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | ` +
      `Where-Object { $_.ExecutablePath -like '${binDir.replace(/'/g, "''")}*' } | ` +
      `ForEach-Object { $_.ProcessId }`;
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    return (r.stdout || '').split(/\r?\n/).map((s) => Number(s.trim())).filter(Number.isInteger);
  }
  const r = spawnSync('pgrep', ['-f', join(binDir, 'postgres')], { encoding: 'utf8' });
  return (r.stdout || '').split(/\s+/).map((s) => Number(s.trim())).filter(Number.isInteger);
}

function forceKill(pids) {
  for (const pid of pids) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)]);
    else { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
  }
}

function pgctl(args, timeout) {
  return spawnSync(join(binDir, `pg_ctl${EXE}`), args, { encoding: 'utf8', timeout });
}

function startCluster() {
  log('Starting Postgres…');
  // stdio:'ignore' is deliberate: pg_ctl leaves a *detached* postgres running,
  // and if it inherited our stdout/stderr the server would hold those handles
  // open forever — hanging any parent that captures output (CI, `… | tail`).
  // Server output already goes to pg.log via -l; we confirm readiness by probing.
  spawnSync(join(binDir, `pg_ctl${EXE}`), ['start', '-D', dataDir, '-o', `-p ${port}`, '-l', logFile, '-w', '-t', '40'],
    { stdio: 'ignore', timeout: 60_000 });
}

async function waitHealthy(tries = 8, gap = 700) {
  for (let i = 0; i < tries; i++) {
    if (await probe(3000) === 'healthy') return true;
    await delay(gap);
  }
  return false;
}

// --- main ------------------------------------------------------------------
async function main() {
  if (!isLocal) {
    const status = await probe();
    if (status === 'healthy') { log(`Remote database at ${host}:${port} reachable — nothing to manage.`); return; }
    log(`Remote database at ${host}:${port} is not reachable (${status}). ensure-db only manages the local embedded DB — check your connection.`);
    process.exit(1);
  }

  binDir = findBinDir();
  if (!binDir) {
    log('Could not find the embedded Postgres binaries. Run `npm install`, then `npm run db:local` once.');
    process.exit(1);
  }

  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    log('Local database is not initialized yet. Run `npm run db:local` once to create it, then retry.');
    process.exit(1);
  }

  let status = await probe();
  if (status === 'healthy') { log(`Database healthy on :${port}.`); return; }

  if (status === 'wedged') {
    log('Database is wedged (accepts TCP but never answers the handshake) — restarting…');
    pgctl(['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '8'], 12_000); // best effort; wedged postmasters ignore this
    let pids = ourPostgresPids(binDir);
    if (pids.length) {
      log(`Force-stopping stuck postgres.exe (pid ${pids.join(', ')})…`);
      forceKill(pids);
      await delay(1000);
    } else {
      // Nobody of ours holds the port, yet it's occupied → a foreign process has :5433.
      log(`Port :${port} is held by another application (not our Postgres). Free it, then retry.`);
      process.exit(1);
    }
    try { rmSync(join(dataDir, 'postmaster.pid')); } catch { /* already gone */ }
  } else {
    log(`Database is not running.`);
  }

  startCluster();

  if (await waitHealthy()) { log(`Database healthy on :${port}.`); return; }

  log('Database did not become healthy after restart. Last server log lines:');
  try {
    const tail = readFileSync(logFile, 'utf8').trim().split(/\r?\n/).slice(-12).join('\n');
    console.log(tail);
  } catch { /* no log */ }
  process.exit(1);
}

main().catch((e) => { console.error('[ensure-db]', e); process.exit(1); });
