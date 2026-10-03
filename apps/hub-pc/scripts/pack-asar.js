const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const stagingDir = path.join(desktopDir, 'temp-asar-staging');
const targetAsar = path.join(desktopDir, 'dist-installers-v6', 'win-unpacked', 'resources', 'app.asar');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

console.log('Extracting current asar to staging...');
execSync(`npx asar extract "${targetAsar}" "${stagingDir}"`, { stdio: 'inherit' });

console.log('Overlaying updated dist and resources...');
fs.cpSync(path.join(desktopDir, 'dist'), path.join(stagingDir, 'dist'), { recursive: true });
if (fs.existsSync(path.join(desktopDir, 'resources'))) {
  fs.cpSync(path.join(desktopDir, 'resources'), path.join(stagingDir, 'resources'), { recursive: true });
}

console.log('Repacking asar to:', targetAsar);
execSync(`npx asar pack "${stagingDir}" "${targetAsar}"`, { stdio: 'inherit' });

// Also sync to installed folder if it exists
const installedAsar = path.join(process.env.LOCALAPPDATA || '', 'Programs', '@cafeosdesktop', 'resources', 'app.asar');
if (fs.existsSync(path.dirname(installedAsar))) {
  console.log('Syncing to installed directory:', installedAsar);
  fs.copyFileSync(targetAsar, installedAsar);
}

fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('Asar update completed successfully.');
