/**
 * Creates or updates the desktop shortcut for ChayaOne OS
 * Directly launches ChayaOne App.exe with 0 terminal windows.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const installedExe = path.join(localAppData, 'Programs', '@cafeosdesktop', 'ChayaOne App.exe');
const desktopDir = path.join(process.env.USERPROFILE || '', 'Desktop');
const shortcutPath = path.join(desktopDir, 'ChayaOne.lnk');

const rootDir = path.resolve(__dirname, '../../..');
const fallbackVbs = path.join(rootDir, 'START-CHAYAONE.vbs');
const iconIco = path.resolve(__dirname, '../apps/desktop/resources/icon.ico');

const unpackedExe = path.resolve(__dirname, '../apps/desktop/dist-installers-v6/win-unpacked/ChayaOne App.exe');

let targetPath = '';
let targetArgs = '--route=/pos';
let iconLocation = '';

if (fs.existsSync(installedExe)) {
  targetPath = installedExe;
  iconLocation = installedExe;
} else if (fs.existsSync(unpackedExe)) {
  targetPath = unpackedExe;
  iconLocation = unpackedExe;
} else if (fs.existsSync(fallbackVbs)) {
  targetPath = fallbackVbs;
  targetArgs = '';
  if (fs.existsSync(iconIco)) iconLocation = iconIco;
}

if (!targetPath) {
  console.error('Target executable not found.');
  process.exit(1);
}

const psScript = `
$WshShell = New-Object -ComObject WScript.Shell;
$desktopPaths = @(
  [Environment]::GetFolderPath("Desktop"),
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\\Desktop"),
  (Join-Path $env:PUBLIC "Desktop")
) | Select-Object -Unique;

$startMenuPaths = @(
  [Environment]::GetFolderPath("Programs"),
  (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs")
) | Select-Object -Unique;

foreach ($d in $desktopPaths) {
  if (Test-Path $d) {
    try {
      $sc = $WshShell.CreateShortcut((Join-Path $d "ChayaOne.lnk"));
      $sc.TargetPath = '${targetPath}';
      $sc.Arguments = '${targetArgs}';
      $sc.WorkingDirectory = '${path.dirname(targetPath)}';
      $sc.Description = 'ChayaOne OS — Main PC Desktop App';
      ${iconLocation ? `$sc.IconLocation = '${iconLocation}';` : ''}
      $sc.Save();
    } catch {}
  }
}

foreach ($s in $startMenuPaths) {
  if (Test-Path $s) {
    try {
      $sc = $WshShell.CreateShortcut((Join-Path $s "ChayaOne.lnk"));
      $sc.TargetPath = '${targetPath}';
      $sc.Arguments = '${targetArgs}';
      $sc.WorkingDirectory = '${path.dirname(targetPath)}';
      $sc.Description = 'ChayaOne OS — Main PC Desktop App';
      ${iconLocation ? `$sc.IconLocation = '${iconLocation}';` : ''}
      $sc.Save();
    } catch {}
  }
}
`;

const tmpPs1 = path.join(rootDir, 'temp-create-shortcut.ps1');
fs.writeFileSync(tmpPs1, psScript, 'utf-8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`, { stdio: 'inherit' });
  console.log(`✅ Desktop shortcut created successfully -> ${targetPath}`);
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
} finally {
  try { fs.unlinkSync(tmpPs1); } catch {}
}
