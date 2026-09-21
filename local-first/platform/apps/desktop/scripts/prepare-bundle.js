const fs = require('fs');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const platformDir = path.resolve(desktopDir, '../..');
const bundleDir = path.join(desktopDir, 'bundle');

console.log('====================================================');
console.log('📦 Preparing ChayaOne Desktop Production Bundle');
console.log('====================================================');

// 1. Clean & recreate bundle directory
if (fs.existsSync(bundleDir)) {
  console.log('Cleaning old bundle directory...');
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// Helper to copy recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// 2. Copy Next.js Standalone
const standaloneSrc = path.join(platformDir, 'apps', 'web', '.next', 'standalone');
const webServerDest = path.join(bundleDir, 'web-server');
console.log(`Copying Next.js standalone from:\n  ${standaloneSrc}\n  to: ${webServerDest}`);
copyDir(standaloneSrc, webServerDest);

// 3. Copy Next.js Static Assets (.next/static)
const staticSrc = path.join(platformDir, 'apps', 'web', '.next', 'static');
const staticDest = path.join(webServerDest, 'apps', 'web', '.next', 'static');
console.log(`Copying Next.js static assets from:\n  ${staticSrc}\n  to: ${staticDest}`);
copyDir(staticSrc, staticDest);
copyDir(staticSrc, path.join(webServerDest, '.next', 'static'));

// 4. Copy Public Folder
const publicSrc = path.join(platformDir, 'apps', 'web', 'public');
const publicDest = path.join(webServerDest, 'apps', 'web', 'public');
if (fs.existsSync(publicSrc)) {
  console.log(`Copying public assets from:\n  ${publicSrc}\n  to: ${publicDest}`);
  copyDir(publicSrc, publicDest);
  copyDir(publicSrc, path.join(webServerDest, 'public'));
}

// 4a. Also copy static & public directly to apps/web/.next/standalone for dev/standalone execution
try {
  copyDir(staticSrc, path.join(standaloneSrc, 'apps', 'web', '.next', 'static'));
  copyDir(staticSrc, path.join(standaloneSrc, '.next', 'static'));
  if (fs.existsSync(publicSrc)) {
    copyDir(publicSrc, path.join(standaloneSrc, 'apps', 'web', 'public'));
    copyDir(publicSrc, path.join(standaloneSrc, 'public'));
  }
} catch (err) {
  console.warn('Could not copy to dev standalone:', err.message);
}

// 4b. Copy .env if present in platform
const envSrc = path.join(platformDir, '.env');
const envDest = path.join(webServerDest, 'apps', 'web', '.env');
if (fs.existsSync(envSrc)) {
  console.log(`Copying production .env from:\n  ${envSrc}\n  to: ${envDest}`);
  fs.copyFileSync(envSrc, envDest);
}

// Helper to convert PE subsystem from Console (3) to GUI (2) to eliminate Windows Terminal popups
function patchToGuiSubsystem(exePath) {
  try {
    if (!fs.existsSync(exePath)) return;
    const buf = fs.readFileSync(exePath);
    if (buf.length < 0x200) return;
    const peOffset = buf.readInt32LE(0x3C);
    if (peOffset <= 0 || peOffset + 24 + 70 > buf.length) return;
    if (buf.readUInt32LE(peOffset) !== 0x00004550) return; // 'PE\0\0'
    const subsystemOffset = peOffset + 4 + 20 + 68;
    const currentSubsystem = buf.readUInt16LE(subsystemOffset);
    if (currentSubsystem === 3) {
      console.log(`Patching ${path.basename(exePath)} PE subsystem: Console (3) -> GUI (2)...`);
      buf.writeUInt16LE(2, subsystemOffset);
      fs.writeFileSync(exePath, buf);
      console.log(`✅ Patched ${path.basename(exePath)} to GUI subsystem (zero console windows).`);
    } else if (currentSubsystem === 2) {
      console.log(`✓ ${path.basename(exePath)} is already GUI subsystem.`);
    }
  } catch (err) {
    console.warn(`Warning: Could not patch PE subsystem for ${exePath}: ${err.message}`);
  }
}

// 5. Copy Embedded Postgres Native Binaries
const postgresSrc = path.join(platformDir, 'node_modules', '@embedded-postgres', 'windows-x64', 'native');
const postgresDest = path.join(bundleDir, 'postgres');
console.log(`Copying PostgreSQL native binaries from:\n  ${postgresSrc}\n  to: ${postgresDest}`);
copyDir(postgresSrc, postgresDest);

// 5b. Patch all native executables to GUI subsystem (Subsystem 2)
// This guarantees that neither PostgreSQL nor its 7 worker child processes
// will ever trigger Windows 11 Windows Terminal popups.
const nativeExesToPatch = [
  path.join(postgresDest, 'bin', 'postgres.exe'),
  path.join(postgresDest, 'bin', 'pg_ctl.exe'),
  path.join(postgresDest, 'bin', 'initdb.exe'),
  path.join(postgresSrc, 'bin', 'postgres.exe'),
  path.join(postgresSrc, 'bin', 'pg_ctl.exe'),
  path.join(desktopDir, 'resources', 'bin', 'cloudflared.exe'),
  path.join(platformDir, '../../bin', 'cloudflared.exe'),
];
for (const exe of nativeExesToPatch) {
  patchToGuiSubsystem(exe);
}

// 6. Copy Default Database Template (.localdb)
const defaultDbSrc = path.join(platformDir, 'packages', 'db', '.localdb');
const defaultDbDest = path.join(bundleDir, 'default-db');
console.log(`Copying default database cluster template from:\n  ${defaultDbSrc}\n  to: ${defaultDbDest}`);
copyDir(defaultDbSrc, defaultDbDest);

// 7. Ensure every PostgreSQL subdirectory exists with a .keep file so archivers don't drop empty directories
const pgDirs = [
  'base',
  'global',
  'pg_commit_ts',
  'pg_dynshmem',
  'pg_logical',
  path.join('pg_logical', 'mappings'),
  path.join('pg_logical', 'snapshots'),
  'pg_multixact',
  path.join('pg_multixact', 'members'),
  path.join('pg_multixact', 'offsets'),
  'pg_notify',
  'pg_replslot',
  'pg_serial',
  'pg_snapshots',
  'pg_stat',
  'pg_stat_tmp',
  'pg_subtrans',
  'pg_tblspc',
  'pg_twophase',
  'pg_wal',
  path.join('pg_wal', 'archive_status'),
  path.join('pg_wal', 'summaries'),
  'pg_xact',
];

for (const dir of pgDirs) {
  const dirPath = path.join(defaultDbDest, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 8. Clean stale PID and log files from default-db
const pidFile = path.join(defaultDbDest, 'postmaster.pid');
if (fs.existsSync(pidFile)) {
  try {
    fs.unlinkSync(pidFile);
    console.log('Removed postmaster.pid from default-db template.');
  } catch {}
}
const logFile = path.join(defaultDbDest, 'pg.log');
if (fs.existsSync(logFile)) {
  try {
    fs.unlinkSync(logFile);
    console.log('Removed pg.log from default-db template.');
  } catch {}
}

console.log('====================================================');
console.log('✅ Bundle preparation complete!');
console.log('====================================================');
