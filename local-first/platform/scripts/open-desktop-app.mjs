import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Open a URL as a standalone, borderless Windows Desktop Application window
 * (no browser tabs, address bar, or navigation controls).
 */
export async function openDesktopApp(url, options = {}) {
  const {
    width = 1440,
    height = 900,
    title = 'ChayaOne OS',
  } = options;

  console.log(`💻 Launching ${title} in Desktop App Window: ${url}`);

  if (process.platform === 'win32') {
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];

    // Prefer Chrome, then Edge
    let browserExe = null;
    for (const p of [...chromePaths, ...edgePaths]) {
      if (existsSync(p)) {
        browserExe = p;
        break;
      }
    }

    if (browserExe) {
      const args = [
        `--app=${url}`,
        `--window-size=${width},${height}`,
        '--new-window',
      ];
      spawn(browserExe, args, { detached: true, stdio: 'ignore' }).unref();
      return;
    }
  }

  // Graceful fallback to default browser
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (e) {
    console.warn(`Could not open app: ${e.message}`);
  }
}
