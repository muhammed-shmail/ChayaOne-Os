/**
 * ChayaOne OS — Commercial License Service
 *
 * Implements:
 * 1. Dual-persistence: PostgreSQL License model + local encrypted/signed JSON file.
 * 2. Monotonic clock tampering protection against system clock rollbacks.
 * 3. Offline-first resilience: normal shop operation continues without internet.
 * 4. Expiry countdown & 10-day warning threshold calculation.
 * 5. Safe operational gating on expiry without deleting any historical data.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import net from 'net';
import { prisma, LicenseStatus as DbLicenseStatus } from '@cafeos/db';
import type {
  LicenseRecord,
  LicenseStatus,
  LicensePeriod,
  LicenseStatusResponse,
} from '@cafeos/types';
import { getInstallationId } from './installation';
import {
  signLicensePayload,
  verifyLicenseSignature,
  verifyAdminActivationCredential,
  parseAndVerifyOfflineLicenseToken,
} from './crypto';
import { resolveSystemPaths } from '../system/paths';

const TTL_MS = 8_000;
const CLOCK_ROLLBACK_TOLERANCE_MS = 15 * 60 * 1000; // 15 minutes grace for NTP adjustments
const OFFLINE_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

let isDbAvailable: boolean | null = null;
let lastDbCheck = 0;

async function checkDbAvailable(): Promise<boolean> {
  if (isDbAvailable !== null && Date.now() - lastDbCheck < 10_000) {
    return isDbAvailable;
  }
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    socket.setTimeout(400);
    socket.once('connect', () => {
      resolved = true;
      socket.destroy();
      isDbAvailable = true;
      lastDbCheck = Date.now();
      resolve(true);
    });
    const onError = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        isDbAvailable = false;
        lastDbCheck = Date.now();
        resolve(false);
      }
    };
    socket.once('timeout', onError);
    socket.once('error', onError);
    socket.connect(5433, '127.0.0.1');
  });
}

let memoryCache: { response: LicenseStatusResponse; at: number } | null = null;
let cachedWatermark: number = 0;

function getLicenseFilePath(): string {
  try {
    const paths = resolveSystemPaths();
    return path.join(paths.configDir, 'license.json');
  } catch {
    return path.resolve(process.cwd(), '.chayaone-data', 'config', 'license.json');
  }
}

function getWatermarkFilePath(): string {
  try {
    const paths = resolveSystemPaths();
    return path.join(paths.configDir, 'watermark.bin');
  } catch {
    return path.resolve(process.cwd(), '.chayaone-data', 'config', 'watermark.bin');
  }
}

function readMonotonicWatermark(): number {
  if (cachedWatermark > 0) return cachedWatermark;
  const filePath = getWatermarkFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8').trim();
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) {
        cachedWatermark = num;
        return cachedWatermark;
      }
    } catch {}
  }
  cachedWatermark = Date.now();
  return cachedWatermark;
}

function writeMonotonicWatermark(timestamp: number): void {
  cachedWatermark = timestamp;
  const filePath = getWatermarkFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, String(timestamp), 'utf8');
  } catch {}
}

export class LicenseService {
  /**
   * Reads persistent license record from local file.
   */
  public static readLocalLicenseFile(): LicenseRecord | null {
    const filePath = getLicenseFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: LicenseRecord = JSON.parse(content);
      if (parsed && parsed.licenseId && parsed.signature) {
        return parsed;
      }
    } catch (err) {
      console.warn('[LICENSE] Failed to parse license.json:', err);
    }
    return null;
  }

  /**
   * Writes persistent license record to local file for offline validation.
   */
  public static writeLocalLicenseFile(record: LicenseRecord): void {
    const filePath = getLicenseFilePath();
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch (err) {
      console.warn('[LICENSE] Failed to write license.json:', err);
    }
  }

  /**
   * Invalidate runtime license cache.
   */
  public static invalidateCache(): void {
    memoryCache = null;
  }

  public static writeWatermark(timestamp: number): void {
    writeMonotonicWatermark(timestamp);
  }

  public static readWatermark(): number {
    return readMonotonicWatermark();
  }

  public static checkClockTampered(): boolean {
    const watermark = readMonotonicWatermark();
    const now = Date.now();
    return now < watermark - CLOCK_ROLLBACK_TOLERANCE_MS;
  }

  /**
   * Retrieve and evaluate current license status.
   */
  public static async getStatus(): Promise<LicenseStatusResponse> {
    const now = Date.now();
    if (memoryCache && now - memoryCache.at < TTL_MS) {
      return memoryCache.response;
    }

    const installationId = getInstallationId();
    let licenseRecord: LicenseRecord | null = null;
    let businessId: string | null = null;

    // 1. Try reading from PostgreSQL if online
    const dbUp = await checkDbAvailable();
    if (dbUp) {
      try {
        const tenant = await prisma.tenant.findFirst({
          select: { id: true },
        });
        if (tenant) {
          businessId = tenant.id;
          const dbLicense = await prisma.license.findFirst({
            where: { businessId: tenant.id },
            orderBy: { createdAt: 'desc' },
          });

          if (dbLicense) {
            licenseRecord = {
              id: dbLicense.id,
              licenseId: dbLicense.licenseId,
              businessId: dbLicense.businessId,
              installationId: dbLicense.installationId,
              deviceId: dbLicense.deviceId,
              licenseType: dbLicense.licenseType,
              startDate: dbLicense.startDate.toISOString(),
              expiryDate: dbLicense.expiryDate.toISOString(),
              status: dbLicense.status as LicenseStatus,
              signature: dbLicense.signature,
              lastValidatedAt: dbLicense.lastValidatedAt.toISOString(),
              lastServerTime: dbLicense.lastServerTime ? dbLicense.lastServerTime.toISOString() : null,
              activatedAt: dbLicense.activatedAt.toISOString(),
              activatedBy: dbLicense.activatedBy,
              meta: (dbLicense.meta as Record<string, unknown>) ?? null,
              createdAt: dbLicense.createdAt.toISOString(),
              updatedAt: dbLicense.updatedAt.toISOString(),
            };
          }
        }
      } catch (err) {
        // Offline fallback
      }
    }

    // 2. Fallback to local persistent license file
    if (!licenseRecord) {
      licenseRecord = this.readLocalLicenseFile();
    } else {
      // Sync DB record to local file for future offline boots
      this.writeLocalLicenseFile(licenseRecord);
    }

    if (licenseRecord && !businessId) {
      businessId = licenseRecord.businessId;
    }

    // 3. Evaluate Clock Rollback Tampering
    const watermark = readMonotonicWatermark();
    let clockTampered = false;
    if (now < watermark - CLOCK_ROLLBACK_TOLERANCE_MS) {
      console.warn(
        `[LICENSE] CLOCK TAMPERING DETECTED! Current clock (${new Date(now).toISOString()}) is older than watermark (${new Date(watermark).toISOString()})`
      );
      clockTampered = true;
    } else if (now > watermark) {
      writeMonotonicWatermark(now);
    }

    // 4. Default unconfigured state
    if (!licenseRecord) {
      const resp: LicenseStatusResponse = {
        isConfigured: false,
        license: null,
        installationId,
        businessId,
        status: 'EXPIRED',
        daysRemaining: 0,
        hoursRemaining: 0,
        isExpiringSoon: false,
        isExpired: true,
        clockTampered,
        isOfflineGraceActive: false,
        offlineGraceRemainingHours: 0,
        serverTime: new Date().toISOString(),
      };
      memoryCache = { response: resp, at: now };
      return resp;
    }

    // 5. Verify cryptographic signature
    const isValidSignature = verifyLicenseSignature(
      {
        licenseId: licenseRecord.licenseId,
        businessId: licenseRecord.businessId,
        installationId: licenseRecord.installationId,
        licenseType: licenseRecord.licenseType,
        startDate: licenseRecord.startDate,
        expiryDate: licenseRecord.expiryDate,
      },
      licenseRecord.signature
    );

    if (!isValidSignature) {
      console.error('[LICENSE] Cryptographic signature invalid or corrupted!');
      const resp: LicenseStatusResponse = {
        isConfigured: true,
        license: licenseRecord,
        installationId,
        businessId,
        status: 'REVOKED',
        daysRemaining: 0,
        hoursRemaining: 0,
        isExpiringSoon: false,
        isExpired: true,
        clockTampered,
        isOfflineGraceActive: false,
        offlineGraceRemainingHours: 0,
        serverTime: new Date().toISOString(),
      };
      memoryCache = { response: resp, at: now };
      return resp;
    }

    // 6. Calculate Remaining Time & Status
    const expiryTime = new Date(licenseRecord.expiryDate).getTime();
    const effectiveTime = clockTampered ? watermark : now; // Prevent clock rollback bypass
    const diffMs = expiryTime - effectiveTime;

    const daysRemaining = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    const hoursRemaining = Math.max(0, Math.floor(diffMs / (60 * 60 * 1000)));

    let status: LicenseStatus = licenseRecord.status;
    let isExpired = false;
    let isExpiringSoon = false;

    if (status === 'REVOKED' || status === 'SUSPENDED') {
      isExpired = true;
    } else if (diffMs <= 0 || clockTampered) {
      status = 'EXPIRED';
      isExpired = true;
    } else if (daysRemaining <= 10) {
      status = 'EXPIRING_SOON';
      isExpiringSoon = true;
    } else {
      status = 'ACTIVE';
    }

    // 7. Calculate Offline Grace State
    const lastValidatedTime = new Date(licenseRecord.lastValidatedAt).getTime();
    const offlineElapsedMs = effectiveTime - lastValidatedTime;
    const offlineGraceRemainingHours = Math.max(
      0,
      Math.floor((OFFLINE_GRACE_PERIOD_MS - offlineElapsedMs) / (60 * 60 * 1000))
    );
    const isOfflineGraceActive = offlineElapsedMs < OFFLINE_GRACE_PERIOD_MS && !isExpired;

    const response: LicenseStatusResponse = {
      isConfigured: true,
      license: licenseRecord,
      installationId,
      businessId,
      status,
      daysRemaining,
      hoursRemaining,
      isExpiringSoon,
      isExpired,
      clockTampered,
      isOfflineGraceActive,
      offlineGraceRemainingHours,
      serverTime: new Date().toISOString(),
    };

    memoryCache = { response, at: now };
    return response;
  }

  /**
   * Fast check for operational operations (returns boolean).
   */
  public static async isLicenseActive(): Promise<{ active: boolean; reason?: string }> {
    const status = await this.getStatus();
    if (!status.isConfigured) {
      return { active: false, reason: 'License not activated. Please complete setup.' };
    }
    if (status.clockTampered) {
      return { active: false, reason: 'System clock tampering detected. System locked.' };
    }
    if (status.isExpired) {
      return { active: false, reason: 'ChayaOne license has expired. Operational actions are locked.' };
    }
    return { active: true };
  }

  /**
   * Activate or renew a license.
   *
   * Validates admin credentials server-side, constructs license duration,
   * cryptographically signs the record, and commits to database + local file.
   */
  public static async activateLicense(params: {
    businessId: string;
    adminPassphrase?: string;
    offlineToken?: string;
    period: LicensePeriod;
    licenseType?: string;
    customStartDate?: string;
    customEndDate?: string;
    activatedBy?: string;
  }): Promise<{ ok: boolean; license?: LicenseRecord; message?: string }> {
    const installationId = getInstallationId();

    // 1. Authenticate via Offline Token OR Server-Side Admin Password
    let isOfflineImport = false;
    let importedPayload: any = null;

    if (params.offlineToken && params.offlineToken.trim()) {
      const parseRes = parseAndVerifyOfflineLicenseToken(params.offlineToken.trim());
      if (!parseRes.valid || !parseRes.license) {
        return { ok: false, message: parseRes.error || 'Invalid or tampered offline license token.' };
      }
      if (parseRes.license.installationId !== installationId) {
        return {
          ok: false,
          message: `This license token was issued for installation ${parseRes.license.installationId}, not this computer (${installationId}).`,
        };
      }
      isOfflineImport = true;
      importedPayload = parseRes.license;
    } else {
      if (!params.adminPassphrase) {
        return { ok: false, message: 'Administrative activation credential or offline token is required.' };
      }
      const isAuthorized = verifyAdminActivationCredential(params.adminPassphrase);
      if (!isAuthorized) {
        return { ok: false, message: 'Unauthorized: Invalid administrative activation key.' };
      }
    }

    const now = new Date();
    let startDate: Date;
    let expiryDate: Date;
    let licenseType: string = params.licenseType || params.period;

    if (isOfflineImport) {
      startDate = new Date(importedPayload.startDate);
      expiryDate = new Date(importedPayload.expiryDate);
      licenseType = importedPayload.licenseType;
    } else {
      startDate = params.customStartDate ? new Date(params.customStartDate) : now;

      if (params.period === '1_month') {
        expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (params.period === '2_months') {
        expiryDate = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
      } else if (params.period === '3_months') {
        expiryDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
      } else if (params.period === 'custom' && params.customEndDate) {
        expiryDate = new Date(params.customEndDate);
      } else {
        expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (expiryDate.getTime() <= startDate.getTime()) {
      return { ok: false, message: 'Expiry date must be after the start date.' };
    }

    const licenseId = isOfflineImport
      ? importedPayload.licenseId
      : `LIC-${now.getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Cryptographic signature
    const signature = isOfflineImport
      ? importedPayload.signature
      : signLicensePayload({
          licenseId,
          businessId: params.businessId,
          installationId,
          licenseType,
          startDate: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
        });

    const licenseData = {
      licenseId,
      businessId: params.businessId,
      installationId,
      deviceId: installationId,
      licenseType,
      startDate,
      expiryDate,
      status: DbLicenseStatus.ACTIVE,
      signature,
      lastValidatedAt: now,
      lastServerTime: now,
      monotonicWatermark: BigInt(now.getTime()),
      activatedAt: now,
      activatedBy: params.activatedBy || 'nuro7_admin',
      meta: {
        activatedAtIso: now.toISOString(),
        durationDays: Math.round((expiryDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
      },
    };

    let savedRecord: LicenseRecord;

    const dbUp = await checkDbAvailable();
    if (dbUp) {
      try {
        const dbRow = await prisma.license.create({
          data: licenseData,
        });

        savedRecord = {
          id: dbRow.id,
          licenseId: dbRow.licenseId,
          businessId: dbRow.businessId,
          installationId: dbRow.installationId,
          deviceId: dbRow.deviceId,
          licenseType: dbRow.licenseType,
          startDate: dbRow.startDate.toISOString(),
          expiryDate: dbRow.expiryDate.toISOString(),
          status: dbRow.status as LicenseStatus,
          signature: dbRow.signature,
          lastValidatedAt: dbRow.lastValidatedAt.toISOString(),
          lastServerTime: dbRow.lastServerTime?.toISOString() || null,
          activatedAt: dbRow.activatedAt.toISOString(),
          activatedBy: dbRow.activatedBy,
          meta: (dbRow.meta as Record<string, unknown>) ?? null,
          createdAt: dbRow.createdAt.toISOString(),
          updatedAt: dbRow.updatedAt.toISOString(),
        };
      } catch (err) {
        savedRecord = {
          id: crypto.randomUUID(),
          licenseId: licenseData.licenseId,
          businessId: licenseData.businessId,
          installationId: licenseData.installationId,
          deviceId: licenseData.deviceId,
          licenseType: licenseData.licenseType,
          startDate: licenseData.startDate.toISOString(),
          expiryDate: licenseData.expiryDate.toISOString(),
          status: 'ACTIVE',
          signature: licenseData.signature,
          lastValidatedAt: now.toISOString(),
          lastServerTime: now.toISOString(),
          activatedAt: now.toISOString(),
          activatedBy: licenseData.activatedBy,
          meta: licenseData.meta,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      }
    } else {
      savedRecord = {
        id: crypto.randomUUID(),
        licenseId: licenseData.licenseId,
        businessId: licenseData.businessId,
        installationId: licenseData.installationId,
        deviceId: licenseData.deviceId,
        licenseType: licenseData.licenseType,
        startDate: licenseData.startDate.toISOString(),
        expiryDate: licenseData.expiryDate.toISOString(),
        status: 'ACTIVE',
        signature: licenseData.signature,
        lastValidatedAt: now.toISOString(),
        lastServerTime: now.toISOString(),
        activatedAt: now.toISOString(),
        activatedBy: licenseData.activatedBy,
        meta: licenseData.meta,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    }

    // Update monotonic watermark to current activation time
    writeMonotonicWatermark(now.getTime());

    // Write to persistent local file
    this.writeLocalLicenseFile(savedRecord);

    // Invalidate caches
    this.invalidateCache();

    return {
      ok: true,
      license: savedRecord,
      message: 'License activated successfully.',
    };
  }
}
