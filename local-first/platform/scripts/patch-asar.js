const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const asarPath = path.resolve(__dirname, '../apps/desktop/dist-installers-v6/win-unpacked/resources/app.asar');
const installedAsarPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', '@cafeosdesktop', 'resources', 'app.asar');
const distSrc = path.resolve(__dirname, '../apps/desktop/dist');
const tempDir = path.resolve(__dirname, '../apps/desktop/.temp_asar');

console.log('Patching app.asar with freshly compiled desktop main code...');

if (!fs.existsSync(asarPath)) {
  console.error('Source asar not found:', asarPath);
  process.exit(1);
}

// 1. Clean temp dir
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// 2. Extract asar
console.log('Extracting asar...');
execSync(`npx --yes @electron/asar extract "${asarPath}" "${tempDir}"`, { stdio: 'inherit' });

// 3. Copy updated dist
console.log('Overwriting temp/dist with freshly compiled desktop code...');
fs.cpSync(distSrc, path.join(tempDir, 'dist'), { recursive: true, force: true });

// 4. Repack asar
console.log('Repacking asar to win-unpacked...');
execSync(`npx --yes @electron/asar pack "${tempDir}" "${asarPath}"`, { stdio: 'inherit' });
console.log('✓ win-unpacked app.asar updated.');

if (fs.existsSync(installedAsarPath)) {
  console.log('Copying updated asar to installed app location...');
  fs.copyFileSync(asarPath, installedAsarPath);
  console.log('✓ installed app.asar updated.');
}

// 5. Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✅ app.asar successfully patched with second-instance handler!');
