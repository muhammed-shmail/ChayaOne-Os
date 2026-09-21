/**
 * ChayaOne OS — Native Android Waiter APK Builder
 *
 * Compiles the high-performance ChayaOne Waiter Android App into an installable .apk
 * and places it in dist/ and the web server public download folder for instant Wi-Fi sideloading.
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const platformDir = join(__dirname, '..');
const androidDir = join(platformDir, 'apps', 'waiter-android');
const distDir = join(platformDir, 'dist');
const webDownloadsDir = join(platformDir, 'apps', 'web', 'public', 'downloads');

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

function resolveJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21',
    'C:\\Program Files\\Java\\jdk-21',
    'C:\\Program Files\\Java\\jdk-17',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

async function main() {
  console.log('=================================================================');
  console.log('      CHAYAONE OS — NATIVE ANDROID WAITER APK BUILDER           ');
  console.log('=================================================================\n');

  const javaHome = resolveJavaHome();
  if (javaHome) {
    console.log(`☕ Using JDK at: ${javaHome}`);
  } else {
    console.warn('⚠️ JAVA_HOME not found explicitly, falling back to system PATH.');
  }

  console.log(`📁 Android Project: ${androidDir}`);
  console.log('⚡ Running Gradle assembleRelease…\n');

  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const env = {
    ...process.env,
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  };

  const gradleProc = spawn(gradlew, ['assembleRelease'], {
    cwd: androidDir,
    shell: true,
    stdio: 'inherit',
    env,
  });

  const exitCode = await new Promise((resolve) => {
    gradleProc.on('close', resolve);
    gradleProc.on('error', (err) => {
      console.error('Failed to start gradlew:', err);
      resolve(1);
    });
  });

  if (exitCode !== 0) {
    console.error(`\n❌ Gradle build failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }

  const generatedApkPath = join(
    androidDir,
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk'
  );

  if (!fs.existsSync(generatedApkPath)) {
    console.error(`\n❌ APK file not found at expected path: ${generatedApkPath}`);
    process.exit(1);
  }

  // Ensure output directories exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  if (!fs.existsSync(webDownloadsDir)) {
    fs.mkdirSync(webDownloadsDir, { recursive: true });
  }

  const targetDistApk = join(distDir, 'ChayaOne-Waiter.apk');
  const targetWebApk1 = join(webDownloadsDir, 'ChayaOne-Waiter.apk');
  const targetWebApk2 = join(webDownloadsDir, 'waiter.apk');
  const rootReleaseApksDir = join(platformDir, '..', '..', 'android', 'release-apks');
  const targetRootApk = join(rootReleaseApksDir, 'ChayaOne-Waiter-Release.apk');

  fs.copyFileSync(generatedApkPath, targetDistApk);
  fs.copyFileSync(generatedApkPath, targetWebApk1);
  fs.copyFileSync(generatedApkPath, targetWebApk2);
  if (!fs.existsSync(rootReleaseApksDir)) {
    fs.mkdirSync(rootReleaseApksDir, { recursive: true });
  }
  fs.copyFileSync(generatedApkPath, targetRootApk);

  const stats = fs.statSync(targetDistApk);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const lanIp = getLocalLanIp();

  console.log('\n=================================================================');
  console.log('      🎉 CHAYAONE WAITER ANDROID APK BUILT SUCCESSFULLY!         ');
  console.log('=================================================================');
  console.log(`📦 Local File:    ${targetDistApk}`);
  console.log(`📊 Size:          ${sizeMb} MB`);
  console.log(`📱 Package:       com.chayaone.waiter`);
  console.log(`⚡ Version:       1.0.0`);
  console.log('-----------------------------------------------------------------');
  console.log('📲 How to Install on Waiter Phones / Tablets:');
  console.log(` 1. Connect phone/tablet to the SAME Café Wi-Fi router.`);
  console.log(` 2. On phone browser, download directly:`);
  console.log(`    👉 http://${lanIp}:3000/downloads/waiter.apk`);
  console.log(` 3. Or copy ${targetDistApk} via USB / WhatsApp.`);
  console.log(` 4. Tap the APK to install, enter POS Server IP, and start serving!`);
  console.log('=================================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during APK build:', err);
  process.exit(1);
});
