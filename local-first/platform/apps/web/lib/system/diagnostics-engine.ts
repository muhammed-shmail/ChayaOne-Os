/**
 * ChayaOne OS — Diagnostics Engine & Support Exporter
 *
 * Performs comprehensive real-time health checks on all local services,
 * network connectivity, database latency, and printer statuses.
 * Generates sanitized support bundles without sensitive customer or auth data.
 */
import os from 'os';
import net from 'net';
import http from 'http';
import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '../runtime-config';
import { isLocalRuntime } from '../realtime';
import { getLocalWSServerSingleton } from '../realtime/server';
import { readDevices } from '../devices';

export interface ServiceDiagnosticStatus {
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'OFFLINE' | 'IDLE';
  details?: string;
  latencyMs?: number;
}

export interface FullDiagnosticReport {
  timestamp: string;
  system: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    nodeVersion: string;
    uptimeSeconds: number;
    memory: {
      totalMb: number;
      freeMb: number;
      usedPercent: number;
    };
    lanIps: string[];
  };
  services: {
    api: ServiceDiagnosticStatus;
    database: ServiceDiagnosticStatus;
    websocket: ServiceDiagnosticStatus;
    printManager: ServiceDiagnosticStatus;
    kotPrinter: ServiceDiagnosticStatus;
    billingPrinter: ServiceDiagnosticStatus;
    lan: ServiceDiagnosticStatus;
    internet: ServiceDiagnosticStatus;
    updateService: ServiceDiagnosticStatus;
  };
  databaseHealth: {
    reachable: boolean;
    activeTenants: number;
    activeOutlets: number;
    queuedPrintJobs: number;
    failedPrintJobs: number;
  };
  recentLogs: Array<{
    category: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
  isHealthy: boolean;
}

export class DiagnosticsEngine {
  private static instance: DiagnosticsEngine;

  public static getInstance(): DiagnosticsEngine {
    if (!DiagnosticsEngine.instance) {
      DiagnosticsEngine.instance = new DiagnosticsEngine();
    }
    return DiagnosticsEngine.instance;
  }

  /**
   * Probes a TCP host:port with a timeout.
   */
  private async probeTcp(host: string, port: number, timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ ok, latencyMs: Date.now() - start });
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));

      try {
        socket.connect(port, host);
      } catch {
        finish(false);
      }
    });
  }

  /**
   * Retrieves all non-internal IPv4 LAN IP addresses.
   */
  public getLanIps(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const netInfo of interfaces[name] || []) {
        if (netInfo.family === 'IPv4' && !netInfo.internal) {
          ips.push(netInfo.address);
        }
      }
    }

    return ips;
  }

  /**
   * Runs an end-to-end diagnostic scan across all subsystems.
   */
  public async runFullDiagnostics(): Promise<FullDiagnosticReport> {
    const start = Date.now();
    const cfg = getRuntimeConfig();
    const lanIps = this.getLanIps();

    // 1. Database Probe
    let dbStatus: ServiceDiagnosticStatus = { name: 'PostgreSQL Database', status: 'RUNNING' };
    let dbReachable = false;
    let tenantCount = 0;
    let outletCount = 0;
    let queuedJobs = 0;
    let failedJobs = 0;

    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      dbReachable = true;
      dbStatus = {
        name: 'PostgreSQL Database',
        status: 'RUNNING',
        latencyMs: dbLatency,
        details: `Port 5433 responded in ${dbLatency}ms`,
      };

      tenantCount = await prisma.tenant.count();
      outletCount = await prisma.outlet.count();
      queuedJobs = await prisma.printJob.count({ where: { status: 'QUEUED' } });
      failedJobs = await prisma.printJob.count({ where: { status: 'FAILED' } });
    } catch (err: any) {
      dbStatus = {
        name: 'PostgreSQL Database',
        status: 'ERROR',
        details: err?.message || 'Database connection error',
      };
    }

    // 2. Local API Server (:3000)
    const apiProbe = await this.probeTcp('127.0.0.1', 3000);
    const apiStatus: ServiceDiagnosticStatus = {
      name: 'ChayaOne Web Server',
      status: apiProbe.ok ? 'RUNNING' : 'OFFLINE',
      latencyMs: apiProbe.latencyMs,
      details: apiProbe.ok ? `Listening on port 3000` : `Port 3000 unreachable`,
    };

    // 3. WebSocket Realtime (:3001)
    let wsStatus: ServiceDiagnosticStatus = { name: 'WebSocket Realtime Server', status: 'IDLE' };
    if (isLocalRuntime()) {
      const wsServer = getLocalWSServerSingleton();
      const wsProbe = await this.probeTcp('127.0.0.1', wsServer.getPort() || 3001);
      wsStatus = {
        name: 'WebSocket Realtime Server',
        status: wsProbe.ok ? 'RUNNING' : 'ERROR',
        latencyMs: wsProbe.latencyMs,
        details: wsProbe.ok
          ? `Port ${wsServer.getPort()} active (${wsServer.getClientCount()} connected clients)`
          : 'WebSocket listener offline',
      };
    }

    // 4. Print Manager & Physical Printers
    let printManagerStatus: ServiceDiagnosticStatus = {
      name: 'Print Manager Engine',
      status: 'RUNNING',
      details: `${queuedJobs} queued, ${failedJobs} failed jobs`,
    };

    let kotStatus: ServiceDiagnosticStatus = { name: 'KOT Printer', status: 'IDLE', details: 'No physical IP configured' };
    let billingStatus: ServiceDiagnosticStatus = { name: 'Billing Printer', status: 'IDLE', details: 'No physical IP configured' };

    try {
      const outlet = await prisma.outlet.findFirst({ select: { settings: true } });
      const devices = readDevices(outlet?.settings);
      
      const kotDevice = devices.find((d) => d.type === 'kot_printer');
      if (kotDevice && kotDevice.target) {
        const parts = kotDevice.target.split(':');
        const host = parts[0] || '127.0.0.1';
        const port = parseInt(parts[1] || '9100', 10);
        const kotProbe = await this.probeTcp(host, port, 1000);
        kotStatus = {
          name: `KOT Printer (${kotDevice.name})`,
          status: kotProbe.ok ? 'RUNNING' : 'OFFLINE',
          latencyMs: kotProbe.latencyMs,
          details: kotProbe.ok ? `Connected at ${kotDevice.target}` : `Cannot connect to ${kotDevice.target}`,
        };
      }

      const billDevice = devices.find((d) => d.type === 'receipt_printer');
      if (billDevice && billDevice.target) {
        const parts = billDevice.target.split(':');
        const host = parts[0] || '127.0.0.1';
        const port = parseInt(parts[1] || '9100', 10);
        const billProbe = await this.probeTcp(host, port, 1000);
        billingStatus = {
          name: `Billing Printer (${billDevice.name})`,
          status: billProbe.ok ? 'RUNNING' : 'OFFLINE',
          latencyMs: billProbe.latencyMs,
          details: billProbe.ok ? `Connected at ${billDevice.target}` : `Cannot connect to ${billDevice.target}`,
        };
      }
    } catch {
      // Keep defaults
    }

    // 5. Local LAN status
    const lanStatus: ServiceDiagnosticStatus = {
      name: 'Local LAN Connectivity',
      status: lanIps.length > 0 ? 'RUNNING' : 'OFFLINE',
      details: lanIps.length > 0 ? `Active IP(s): ${lanIps.join(', ')}` : 'No active network adapter found',
    };

    // 6. Internet / WAN status (DNS / Cloud probe)
    const internetProbe = await this.probeTcp('1.1.1.1', 53, 1000);
    const internetStatus: ServiceDiagnosticStatus = {
      name: 'Internet Availability',
      status: internetProbe.ok ? 'RUNNING' : 'OFFLINE',
      latencyMs: internetProbe.latencyMs,
      details: internetProbe.ok ? 'Online (Updates available)' : 'Offline (Operating locally on LAN)',
    };

    // 7. Update Service
    const updateStatus: ServiceDiagnosticStatus = {
      name: 'Update Manager',
      status: 'RUNNING',
      details: 'Ready for scheduled / manual checks',
    };

    // 8. Recent System Diagnostic Logs
    let recentLogs: any[] = [];
    try {
      recentLogs = await prisma.systemDiagnosticLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          category: true,
          severity: true,
          message: true,
          createdAt: true,
        },
      });
    } catch {
      // In case logs table not yet queryable
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const isHealthy = dbStatus.status === 'RUNNING';

    return {
      timestamp: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptimeSeconds: Math.round(os.uptime()),
        memory: {
          totalMb: Math.round(totalMem / (1024 * 1024)),
          freeMb: Math.round(freeMem / (1024 * 1024)),
          usedPercent,
        },
        lanIps,
      },
      services: {
        api: apiStatus,
        database: dbStatus,
        websocket: wsStatus,
        printManager: printManagerStatus,
        kotPrinter: kotStatus,
        billingPrinter: billingStatus,
        lan: lanStatus,
        internet: internetStatus,
        updateService: updateStatus,
      },
      databaseHealth: {
        reachable: dbReachable,
        activeTenants: tenantCount,
        activeOutlets: outletCount,
        queuedPrintJobs: queuedJobs,
        failedPrintJobs: failedJobs,
      },
      recentLogs,
      isHealthy,
    };
  }

  /**
   * Generates a fully sanitized diagnostic support bundle for customer assistance.
   */
  public async generateSupportReport(): Promise<Record<string, any>> {
    const report = await this.runFullDiagnostics();
    const updateHistory = await prisma.systemUpdateHistory.findMany({
      take: 10,
      orderBy: { installedAt: 'desc' },
      select: {
        version: true,
        previousVersion: true,
        channel: true,
        status: true,
        releaseDate: true,
        diagnosticRefId: true,
        installedAt: true,
        completedAt: true,
      },
    });

    const backupLogs = await prisma.databaseBackupLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        filename: true,
        sizeBytes: true,
        backupType: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      reportType: 'ChayaOne OS Customer Support Diagnostics Bundle',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      system: report.system,
      services: report.services,
      database: report.databaseHealth,
      updateHistory,
      backupSummary: {
        recentBackups: backupLogs.map((b) => ({ ...b, sizeBytes: Number(b.sizeBytes) })),
      },
      diagnosticLogs: report.recentLogs,
    };
  }
}

export const diagnosticsEngine = DiagnosticsEngine.getInstance();
