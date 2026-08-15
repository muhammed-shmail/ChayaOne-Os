'use client';

import { Server, Database, Mail, MessageSquare, CreditCard, Clock, HardDrive, Cpu, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

type Status = 'healthy' | 'warning' | 'critical';

interface ServiceStatus {
  name: string;
  status: Status;
  icon: any;
}

const services: ServiceStatus[] = [
  { name: 'API Server', status: 'healthy', icon: Server },
  { name: 'Database', status: 'healthy', icon: Database },
  { name: 'Storage', status: 'healthy', icon: HardDrive },
  { name: 'Email Service', status: 'healthy', icon: Mail },
  { name: 'WhatsApp Service', status: 'warning', icon: MessageSquare },
  { name: 'SMS Service', status: 'healthy', icon: MessageSquare },
  { name: 'Payment Gateway', status: 'healthy', icon: CreditCard },
  { name: 'Cron Jobs', status: 'healthy', icon: Clock },
  { name: 'Background Workers', status: 'critical', icon: Cpu },
  { name: 'Redis Cache', status: 'healthy', icon: Database },
  { name: 'Backups', status: 'healthy', icon: HardDrive },
];

export function PlatformHealth() {
  return (
    <div className="lux-card card-glow flex flex-col h-full">
      <div className="p-5 border-b border-[var(--line)]">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Server size={18} className="text-[var(--gold)]" />
          Platform Health
        </h3>
      </div>
      
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--paper-3)] border border-[var(--line)]">
            <div className="flex items-center gap-3">
              <service.icon size={16} className="text-[var(--ink-3)]" />
              <span className="text-sm font-semibold text-[var(--ink-2)]">{service.name}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {service.status === 'healthy' && (
                <>
                  <CheckCircle size={14} className="text-[var(--ok)]" />
                  <span className="text-[11px] uppercase font-bold text-[var(--ok)]">Healthy</span>
                </>
              )}
              {service.status === 'warning' && (
                <>
                  <AlertTriangle size={14} className="text-[var(--warn)]" />
                  <span className="text-[11px] uppercase font-bold text-[var(--warn)]">Warning</span>
                </>
              )}
              {service.status === 'critical' && (
                <>
                  <XCircle size={14} className="text-[var(--danger)]" />
                  <span className="text-[11px] uppercase font-bold text-[var(--danger)]">Critical</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
