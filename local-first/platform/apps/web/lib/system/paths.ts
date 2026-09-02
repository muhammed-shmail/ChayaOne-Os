/**
 * ChayaOne OS — System Paths & Filesystem Configuration
 *
 * Resolves standard Windows / local paths:
 * - Production:
 *     App:    C:\Program Files\ChayaOne
 *     Data:   C:\ProgramData\ChayaOne (data, backups, logs, config, updates)
 * - Development / Local-first:
 *     Data:   <platformRoot>/.localdata (or packages/db/.localdb)
 */
import path from 'path';
import fs from 'fs';

export interface SystemPaths {
  appDir: string;
  dataDir: string;
  dbDataDir: string;
  backupsDir: string;
  logsDir: string;
  configDir: string;
  updatesDir: string;
  updatesStagingDir: string;
  updatesDownloadedDir: string;
  updatesBackupDir: string;
  stateFile: string;
}

export function resolveSystemPaths(): SystemPaths {
  const isProdWin = process.platform === 'win32' && process.env.NODE_ENV === 'production' && process.env.PROGRAMDATA;
  
  let baseDataDir: string;
  if (isProdWin && process.env.PROGRAMDATA) {
    baseDataDir = path.join(process.env.PROGRAMDATA, 'ChayaOne');
  } else {
    // Development fallback inside workspace
    baseDataDir = path.resolve(process.cwd(), '.chayaone-data');
  }

  const appDir = isProdWin && process.env['ProgramFiles']
    ? path.join(process.env['ProgramFiles'], 'ChayaOne')
    : path.resolve(process.cwd());

  const dbDataDir = path.join(baseDataDir, 'data');
  const backupsDir = path.join(baseDataDir, 'backups');
  const logsDir = path.join(baseDataDir, 'logs');
  const configDir = path.join(baseDataDir, 'config');
  const updatesDir = path.join(baseDataDir, 'updates');
  const updatesStagingDir = path.join(updatesDir, 'staging');
  const updatesDownloadedDir = path.join(updatesDir, 'downloaded');
  const updatesBackupDir = path.join(updatesDir, 'backup');
  const stateFile = path.join(configDir, 'update-state.json');

  // Ensure directories exist
  for (const dir of [
    baseDataDir,
    dbDataDir,
    backupsDir,
    logsDir,
    configDir,
    updatesDir,
    updatesStagingDir,
    updatesDownloadedDir,
    updatesBackupDir,
  ]) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Ignore if already created or permission-handled
      }
    }
  }

  return {
    appDir,
    dataDir: baseDataDir,
    dbDataDir,
    backupsDir,
    logsDir,
    configDir,
    updatesDir,
    updatesStagingDir,
    updatesDownloadedDir,
    updatesBackupDir,
    stateFile,
  };
}
