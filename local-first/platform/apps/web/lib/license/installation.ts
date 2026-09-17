/**
 * ChayaOne OS — Main PC Installation Identifier Service
 *
 * Generates and securely persists a unique, immutable Installation ID
 * for this Main PC deployment.
 * Format: CHAYAONE-INSTALL-XXXXXXXX
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { resolveSystemPaths } from '../system/paths';

export interface InstallationConfig {
  installationId: string;
  machineFingerprint: string;
  installedAt: string;
  osPlatform: string;
  osRelease: string;
  hostname: string;
  initialVersion: string;
}

let cachedInstallationId: string | null = null;

function getInstallationFilePath(): string {
  try {
    const paths = resolveSystemPaths();
    return path.join(paths.configDir, 'installation.json');
  } catch {
    return path.resolve(process.cwd(), '.chayaone-data', 'config', 'installation.json');
  }
}

/**
 * Computes a hardware/environment seed (not solely reliant on MAC or user).
 */
function computeMachineFingerprint(): string {
  try {
    const networkInterfaces = os.networkInterfaces();
    const macs: string[] = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (net.mac && net.mac !== '00:00:00:00:00:00' && !net.internal) {
          macs.push(net.mac);
        }
      }
    }
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || 'unknown-cpu';
    const totalMem = os.totalmem() || 0;
    const raw = `${macs.sort().join(',')}|${cpuModel}|${totalMem}|${os.arch()}|${os.platform()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  } catch {
    return crypto.randomBytes(16).toString('hex');
  }
}

/**
 * Generate a new structured installation ID.
 */
function generateNewInstallationId(): string {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timeHex = (Date.now() % 0xffffff).toString(16).toUpperCase().padStart(6, '0');
  return `CHAYAONE-INSTALL-${randomHex}${timeHex}`.substring(0, 24);
}

/**
 * Retrieve the persistent Installation ID for this Main PC.
 * Automatically generates and persists if not already present.
 */
export function getInstallationId(): string {
  if (cachedInstallationId) return cachedInstallationId;

  const filePath = getInstallationFilePath();

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: InstallationConfig = JSON.parse(content);
      if (parsed && parsed.installationId && parsed.installationId.startsWith('CHAYAONE-INSTALL-')) {
        cachedInstallationId = parsed.installationId;
        return cachedInstallationId;
      }
    } catch (err) {
      console.warn('[INSTALLATION] Failed to read existing installation.json, re-creating:', err);
    }
  }

  // Generate new installation record
  const newId = generateNewInstallationId();
  const config: InstallationConfig = {
    installationId: newId,
    machineFingerprint: computeMachineFingerprint(),
    installedAt: new Date().toISOString(),
    osPlatform: process.platform,
    osRelease: os.release(),
    hostname: os.hostname(),
    initialVersion: '1.2.0',
  };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.warn('[INSTALLATION] Could not write installation.json to primary path, writing local fallback:', err);
    try {
      const fallbackPath = path.resolve(process.cwd(), '.chayaone-data', 'config', 'installation.json');
      const fallbackDir = path.dirname(fallbackPath);
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
      fs.writeFileSync(fallbackPath, JSON.stringify(config, null, 2), 'utf8');
    } catch {}
  }

  cachedInstallationId = newId;
  return cachedInstallationId;
}

/**
 * Retrieve full installation metadata.
 */
export function getInstallationMetadata(): InstallationConfig {
  const filePath = getInstallationFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {}
  }
  const id = getInstallationId();
  return {
    installationId: id,
    machineFingerprint: computeMachineFingerprint(),
    installedAt: new Date().toISOString(),
    osPlatform: process.platform,
    osRelease: os.release(),
    hostname: os.hostname(),
    initialVersion: '1.2.0',
  };
}
