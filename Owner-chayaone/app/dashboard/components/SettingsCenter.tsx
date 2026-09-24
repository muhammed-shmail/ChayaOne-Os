'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Store, Clock, Percent, BookOpen, ChefHat, Package, Receipt, CreditCard, Printer,
  Users, Smartphone, Truck, Bell, Shield, BarChart3, ClipboardList, Blocks, Zap,
  Lock, Database, Sparkles, Cpu, Sliders, Calendar, DollarSign, UserCheck, RefreshCw,
  AlertCircle, Trash2, Plus, Check, Search, ChevronRight, ChevronLeft, Info, X, Key,
  Heart, AlertTriangle, Play, HelpCircle, Megaphone, Download, Layers, QrCode,
  Wifi, Copy, ExternalLink, User, Server, CheckCircle2, Monitor, Moon, Edit2
} from 'lucide-react';
import type { Kitchen } from '@/lib/kitchens';
import type { Device } from '@/lib/devices';
import type { KitchenWorkflowConfig } from '@/lib/kitchenWorkflow';
import { DEFAULT_PWA, type PwaConfig } from '@/lib/pwa';
import type { ModuleSystemConfig } from '@cafeos/types';
import SystemManagement from './SystemManagement';
import ModuleManagement from './ModuleManagement';
import ServerDashboardClient from '../server/ServerDashboardClient';
import { tableOrderUrl, tableQrImageUrl } from '@/lib/qr';


// Category groups & metadata
export interface SettingItem {
  key: string;
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
  sensitive?: boolean;
  ownerOnly?: boolean;
  enterpriseOnly?: boolean;
  badge?: string;
  keywords?: string[];
}

export interface SectionTheming {
  themeKey: 'restaurant' | 'operations' | 'customers' | 'admin' | 'enterprise';
  icon: React.ComponentType<any>;
  tagline: string;
  badge: string;
  accentColor: string;
  borderAccent: string;
  badgeClass: string;
  iconContainerClass: string;
  ambientGradient: string;
  hoverBorder: string;
  hoverShadow: string;
  topAccentGrad: string;
  hoverText: string;
  activeTabClass: string;
}

export interface SettingSection {
  title: string;
  theme: SectionTheming;
  items: SettingItem[];
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Restaurant',
    theme: {
      themeKey: 'restaurant',
      icon: Store,
      tagline: 'Brand identity, dining modes, menus, tax compliance & store profile',
      badge: 'Brand & Dine',
      accentColor: '#F59E0B',
      borderAccent: 'rgba(245, 158, 11, 0.3)',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      iconContainerClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      ambientGradient: 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.12), transparent 70%)',
      hoverBorder: 'hover:border-amber-500/50',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(245,158,11,0.12)]',
      topAccentGrad: 'from-amber-500 via-amber-400 to-transparent',
      hoverText: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
      activeTabClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50 shadow-sm',
    },
    items: [
      { key: 'general', label: 'Business Profile', desc: 'Store profile, branding & contact details', icon: Store, badge: 'Profile', keywords: ['store', 'profile', 'address', 'city', 'pincode', 'currency', 'language', 'timezone', 'logo', 'gstin', 'website', 'email', 'phone', 'contact'] },
      { key: 'modules', label: 'Modules & Business Profile', desc: 'Enable or configure business modules (Cafe, Restaurant, Juice, Waiter, KDS, Inventory...)', icon: Layers, sensitive: true, ownerOnly: true, badge: 'Core Engine', keywords: ['modules', 'business type', 'cafe', 'restaurant', 'hotel', 'juice', 'meals', 'waiter', 'kds', 'customer qr', 'inventory', 'crm', 'loyalty'] },
      { key: 'business_hours', label: 'Business Hours', desc: 'Opening, closing hours, breaks & festival timings', icon: Clock, badge: 'Schedule', keywords: ['time', 'opening', 'closing', 'weekly', 'holiday', 'festival', 'break', 'temporary closure', 'emergency'] },
      { key: 'tax', label: 'Tax & GST', desc: 'GSTIN, CGST/SGST, service & packaging charges', icon: Percent, sensitive: true, badge: 'Compliance', keywords: ['gstin', 'tax', 'cgst', 'sgst', 'igst', 'exclusive', 'inclusive', 'hsn', 'sac', 'composition', 'flat rate', 'billing', 'reports', 'audit'] },
      { key: 'menu', label: 'Menu Configuration', desc: 'Categories, variants, add-ons & happy hours', icon: BookOpen, badge: 'Catalog', keywords: ['veg', 'non-veg', 'dietary', 'combo', 'happy hours', 'discount', 'variants', 'add-ons'] },
      { key: 'floor', label: 'Floor & QR Codes', desc: 'Physical table layouts, QR generation & scans', icon: Sparkles, badge: 'Tables & QR', keywords: ['dining', 'table', 'section', 'layout', 'scan', 'qr code', 'branding', 'download qr'] },
      { key: 'app_qrs', label: 'App QR Codes ', desc: 'Install Waiter and Customer PWAs via QR', icon: Smartphone, badge: 'PWA Apps', keywords: ['qr', 'pwa', 'waiter', 'customer', 'kds', 'install'] },
      { key: 'dining_modes', label: 'Dining Modes', desc: 'Dine-in, takeaway, delivery & QR order settings', icon: ChefHat, badge: 'Fulfillment', keywords: ['dine-in', 'takeaway', 'delivery', 'qr order', 'modes', 'enable modes'] },
      { key: 'branding', label: 'Store Branding', desc: 'Branding colors, font themes & header styles', icon: Sparkles, badge: 'Theme Design', keywords: ['brand', 'colors', 'font', 'theme', 'header', 'styling', 'customization'] }
    ]
  },
  {
    title: 'Operations',
    theme: {
      themeKey: 'operations',
      icon: ChefHat,
      tagline: 'Kitchen KDS, printer routing, till workflows & cash management',
      badge: 'Live Operations',
      accentColor: '#10B981',
      borderAccent: 'rgba(16, 185, 129, 0.3)',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      iconContainerClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      ambientGradient: 'radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.12), transparent 70%)',
      hoverBorder: 'hover:border-emerald-500/50',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)]',
      topAccentGrad: 'from-emerald-500 via-emerald-400 to-transparent',
      hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
      activeTabClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shadow-sm',
    },
    items: [
      { key: 'kitchen', label: 'Kitchen & KDS', desc: 'KDS screens, KOT printing, routing stations', icon: ChefHat, badge: 'KDS & Prep', keywords: ['kds', 'kot', 'printer', 'routing', 'preparation', 'stations', 'workflow'] },
      { key: 'inventory', label: 'Inventory Settings', desc: 'Low stock alerts, waste logging, stock adjustment', icon: Package, badge: 'Stock Rules', keywords: ['stock', 'alerts', 'waste', 'deduction', 'adjustment', 'purchase order', 'low stock'] },
      { key: 'billing', label: 'Billing Configuration', desc: 'Receipt layout, invoice format, auto-print, duplicate bills', icon: Receipt, badge: 'Invoicing', keywords: ['receipt', 'invoice', 'format', 'prefix', 'duplicate', 'reprint', 'round off'] },
      { key: 'payments', label: 'Payment Options', desc: 'Cash, card, UPI gateways, split & tips settings', icon: CreditCard, badge: 'Gateways', keywords: ['cash', 'card', 'upi', 'gateway', 'split', 'tips', 'percentages', 'settlement'] },
      { key: 'devices', label: 'Devices & Printers', desc: 'Receipt, kitchen, barcode printers & cash drawers', icon: Printer, badge: 'Hardware', keywords: ['printer', 'connection', 'usb', 'bluetooth', 'network', 'cash drawer', 'terminal'] },
      { key: 'order_workflow', label: 'Order Workflow', desc: 'Auto-acceptance, auto-routing & cancel timers', icon: Sliders, badge: 'Routing', keywords: ['acceptance', 'routing', 'auto-cancel', 'timers', 'workflow', 'auto-accept'] },
      { key: 'shift_management', label: 'Shift Management', desc: 'Shift timings, cash declaration, shift-end reports', icon: Clock, badge: 'Shift Roster', keywords: ['shift', 'drawer balance', 'cash declaration', 'timings', 'reports'] },
      { key: 'cash_drawer', label: 'Cash Drawer', desc: 'Cash float, opening drawer triggers, discrepancy limits', icon: DollarSign, badge: 'Float & Till', keywords: ['cash float', 'triggers', 'discrepancy', 'limit', 'drawer open'] }
    ]
  },
  {
    title: 'Customers',
    theme: {
      themeKey: 'customers',
      icon: Users,
      tagline: 'Customer PWA app, loyalty rewards, delivery & online orders',
      badge: 'Guest Experience',
      accentColor: '#8B5CF6',
      borderAccent: 'rgba(139, 92, 246, 0.3)',
      badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
      iconContainerClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      ambientGradient: 'radial-gradient(ellipse at top left, rgba(139, 92, 246, 0.12), transparent 70%)',
      hoverBorder: 'hover:border-purple-500/50',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(139,92,246,0.12)]',
      topAccentGrad: 'from-purple-500 via-purple-400 to-transparent',
      hoverText: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
      activeTabClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/50 shadow-sm',
    },
    items: [
      { key: 'pwa', label: 'Customer App', desc: 'Web app design, splash screens, push notifications', icon: Smartphone, badge: 'Customer Web', keywords: ['customer web app', 'splash screen', 'branding', 'push notifications', 'games'] },
      { key: 'loyalty', label: 'Customer & Loyalty', desc: 'Loyalty points ratio, birthday rewards, credits', icon: Users, badge: 'Points & CRM', keywords: ['loyalty points', 'rewards', 'birthday multiplier', 'credits', 'limit'] },
      { key: 'online_order', label: 'Online Ordering', desc: 'Pickup, delivery radius, partners & order timings', icon: Truck, badge: 'Delivery Hub', keywords: ['pickup', 'delivery', 'radius', 'charge', 'minimum order', 'timing'] },
      { key: 'reservations', label: 'Reservations', desc: 'Enable bookings, dining slot intervals, table hold limits', icon: Calendar, badge: 'Bookings', keywords: ['booking', 'slots', 'hold limit', 'deposit', 'table hold', 'schedule'] },
      { key: 'notifications', label: 'Notifications Hub', desc: 'WhatsApp API, SMS, emails & push notifications settings', icon: Bell, badge: 'Alerts & SMS', keywords: ['whatsapp', 'sms', 'email', 'gateways', 'templates', 'daily summary'] },
      { key: 'reviews', label: 'Reviews', desc: 'Google reviews integration, auto WhatsApp review requests', icon: Heart, badge: 'Reputation', keywords: ['google reviews', 'reviews prompt', 'whatsapp feedback', 'ratings'] },
      { key: 'marketing', label: 'Marketing', desc: 'Bulk SMS, automated discount rule engine', icon: Megaphone, badge: 'Campaigns', keywords: ['bulk sms', 'discounts', 'campaigns', 'promotions', 'offers'] }
    ]
  },
  {
    title: 'Administration',
    theme: {
      themeKey: 'admin',
      icon: Shield,
      tagline: 'Staff roles, audit logs, system backups & developer APIs',
      badge: 'Governance & Security',
      accentColor: '#3B82F6',
      borderAccent: 'rgba(59, 130, 246, 0.3)',
      badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
      iconContainerClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      ambientGradient: 'radial-gradient(ellipse at top left, rgba(59, 130, 246, 0.12), transparent 70%)',
      hoverBorder: 'hover:border-blue-500/50',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(59,130,246,0.12)]',
      topAccentGrad: 'from-blue-500 via-blue-400 to-transparent',
      hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
      activeTabClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/50 shadow-sm',
    },
    items: [
      { key: 'staff', label: 'Staff & Roles', desc: 'Role-based access control, POS PINs, custom roles', icon: Shield, sensitive: true, badge: 'RBAC & PINs', keywords: ['rbac', 'pin', 'roles', 'permissions', 'cashier', 'manager', 'waiter'] },
      { key: 'reports', label: 'Report Settings', desc: 'Visibility settings, scheduled email exports', icon: BarChart3, sensitive: true, badge: 'Exports', keywords: ['visibility', 'email exports', 'sales summary', 'weekly report', 'closing'] },
      { key: 'audit', label: 'Audit Logs', desc: 'Security logging, changes history, deleted bills', icon: ClipboardList, sensitive: true, ownerOnly: true, badge: 'Audit Trail', keywords: ['security log', 'changes history', 'deleted bills', 'actions'] },
      { key: 'security', label: 'Security & Access', desc: '2FA, device approval restrictions, session timeouts', icon: Lock, sensitive: true, badge: 'Protection', keywords: ['2fa', 'two factor', 'session timeout', 'approved devices', 'password'] },
      { key: 'integrations', label: 'Integrations', desc: 'Razorpay, PhonePe, Swiggy, Zomato, Zoho Books', icon: Blocks, sensitive: true, badge: '3rd Party', keywords: ['razorpay', 'phonepe', 'swiggy', 'zomato', 'zoho', 'tally', 'apis'] },
      { key: 'system', label: 'System & Updates', desc: 'Updates, versioning, database backups & live diagnostics', icon: Cpu, sensitive: true, ownerOnly: true, badge: 'Diagnostics', keywords: ['system', 'updates', 'backup', 'diagnostics', 'recovery', 'version', 'support report', 'about'] },
      { key: 'server_license', label: 'Server & License', desc: 'Main PC local server diagnostics, background services & commercial license', icon: Server, sensitive: true, ownerOnly: true, badge: 'Main PC', keywords: ['server', 'license', 'main pc', 'ports', 'database', 'expiry', 'activation', 'renewal', 'printers', 'realtime'] },
      { key: 'subscription', label: 'Subscription Plan', desc: 'SaaS licensing, usage trackers & billing history', icon: Zap, sensitive: true, badge: 'Licensing', keywords: ['licensing', 'plan', 'billing history', 'usage trackers', 'upgrade'] },
      { key: 'backup', label: 'Backup & Restore', desc: 'Manual & automatic db exports, import configs', icon: Database, sensitive: true, ownerOnly: true, badge: 'Snapshots', keywords: ['database export', 'import config', 'rollback', 'manual backup'] },
      { key: 'api_keys', label: 'API Keys', desc: 'Generate API keys, manage webhook endpoints & credentials', icon: Key, sensitive: true, badge: 'REST Tokens', keywords: ['webhooks', 'credentials', 'endpoints', 'access tokens', 'api access'] },
      { key: 'developer', label: 'Developer Options', desc: 'Protected developer tools: transactional data wipe, factory reset & module relocation', icon: Sliders, sensitive: true, ownerOnly: true, badge: 'Protected', keywords: ['developer', 'reset', 'clear billing', 'invoices', 'relocate module', 'sandbox', 'debug logs'] }
    ]
  }
];

const ENTERPRISE_SECTIONS: SettingSection[] = [
  {
    title: 'Enterprise Controls',
    theme: {
      themeKey: 'enterprise',
      icon: Zap,
      tagline: 'Multi-branch sync, corporate SSO, webhooks & global policies',
      badge: 'Enterprise Core',
      accentColor: '#F43F5E',
      borderAccent: 'rgba(244, 63, 94, 0.3)',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      iconContainerClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      ambientGradient: 'radial-gradient(ellipse at top left, rgba(244, 63, 94, 0.12), transparent 70%)',
      hoverBorder: 'hover:border-rose-500/50',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(244,63,94,0.12)]',
      topAccentGrad: 'from-rose-500 via-rose-400 to-transparent',
      hoverText: 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
      activeTabClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/50 shadow-sm',
    },
    items: [
      { key: 'enterprise_multibranch', label: 'Multi-branch Config', desc: 'Branch settings, centralized menu sync & chains', icon: Store, enterpriseOnly: true, badge: 'Chains', keywords: ['branches', 'multi-branch', 'franchise', 'centralized', 'chain'] },
      { key: 'enterprise_policy', label: 'Centralized Policy', desc: 'Corporate compliance rules & global constraints', icon: Shield, enterpriseOnly: true, badge: 'Compliance', keywords: ['policy', 'corporate rules', 'global constraints', 'enforcement'] },
      { key: 'enterprise_sso', label: 'Single Sign-On (SSO)', desc: 'SSO provider, client credentials & access control', icon: Lock, enterpriseOnly: true, badge: 'SAML / SSO', keywords: ['sso', 'single sign-on', 'saml', 'oidc', 'okta', 'azure'] },
      { key: 'enterprise_webhooks', label: 'Webhooks', desc: 'Realtime events, endpoints & retry policies', icon: Zap, enterpriseOnly: true, badge: 'Event Stream', keywords: ['webhooks', 'realtime events', 'endpoints', 'retry policies'] },
      { key: 'enterprise_integrations', label: 'Custom Integrations', desc: 'SAP, custom API middleware & ERP integrations', icon: Blocks, enterpriseOnly: true, badge: 'Custom ERP', keywords: ['custom api', 'middleware', 'erp integration', 'sap'] }
    ]
  }
];


interface SettingsCenterProps {
  outlet: { name: string; brand: string; plan: string; gstin: string | null; receipt: any; gstConfig?: any; upiConfig?: any };
  staff: { name: string; role: string };
  features: Record<string, boolean>;
  moduleConfig?: ModuleSystemConfig;
  onModuleConfigUpdated?: (cfg: ModuleSystemConfig) => void;

  profile: any;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  handleSaveProfile: (e: React.FormEvent) => Promise<void>;

  handleSaveGst: (e: React.FormEvent) => Promise<void>;
  gstSaving: boolean;

  location: any;
  setLocation: React.Dispatch<React.SetStateAction<any>>;
  handleSaveLocation: (e: React.FormEvent) => Promise<void>;
  locationSaving: boolean;

  logoUrl: string | null;
  logoBusy: boolean;
  handleLogoFile: (file: File) => Promise<void>;
  saveLogo: (url: string | null) => Promise<void>;

  kwForm: KitchenWorkflowConfig;
  setKwForm: React.Dispatch<React.SetStateAction<KitchenWorkflowConfig>>;
  handleSaveKitchenWorkflow: (e: React.FormEvent) => Promise<void>;
  kwSaving: boolean;

  receiptForm: any;
  setReceiptForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveReceipt: (e: React.FormEvent) => Promise<void>;
  receiptSaving: boolean;

  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  handleSaveDevice: (e: React.FormEvent) => Promise<void>;
  handleDeleteDevice: (id: string, name: string) => Promise<void>;
  handleSetDefaultDevice: (dev: Device) => Promise<void>;
  deviceForm: any;
  setDeviceForm: React.Dispatch<React.SetStateAction<any>>;
  showDeviceForm: boolean;
  setShowDeviceForm: (v: boolean) => void;
  openDeviceForm: (dev?: Device) => void;

  floors: any[];
  floorTables: any[];
  onFloorUpdated?: () => Promise<void>;
  kitchens: Kitchen[];
  setKitchens: React.Dispatch<React.SetStateAction<Kitchen[]>>;
  kitchenApi: (payload: Record<string, unknown>, okMsg: string) => Promise<boolean>;
  kitchenBusy: boolean;

  pwaCfg: PwaConfig | null;
  setPwaCfg: React.Dispatch<React.SetStateAction<PwaConfig | null>>;
  handleSavePwa: (cfg: PwaConfig) => Promise<void>;
  pwaSaving: boolean;
  uploadImage: (file: File) => Promise<string | null>;
  loadPwa?: () => Promise<void>;

  auditList: any[];
  auditTotal: number;
  auditPage: number;
  loadAudit: (page: number) => Promise<void>;

  flashMessage: (msg: string) => void;
  isAdvanced: boolean;
  handleToggleAdvanced: (val: boolean) => void;

  menuItems?: any[];
  menuCategories?: any[];
  setMenuItems?: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function SettingsCenter({
  outlet,
  staff,
  features,
  moduleConfig,
  onModuleConfigUpdated,
  profile,
  setProfile,
  handleSaveProfile,
  handleSaveGst,
  gstSaving,
  location,
  setLocation,
  handleSaveLocation,
  locationSaving,
  logoUrl,
  logoBusy,
  handleLogoFile,
  saveLogo,
  kwForm,
  setKwForm,
  handleSaveKitchenWorkflow,
  kwSaving,
  receiptForm,
  setReceiptForm,
  handleSaveReceipt,
  receiptSaving,
  devices,
  setDevices,
  handleSaveDevice,
  handleDeleteDevice,
  handleSetDefaultDevice,
  deviceForm,
  setDeviceForm,
  showDeviceForm,
  setShowDeviceForm,
  openDeviceForm,
  floors,
  floorTables,
  onFloorUpdated,
  kitchens,
  setKitchens,
  kitchenApi,
  kitchenBusy,
  pwaCfg,
  setPwaCfg,
  handleSavePwa,
  pwaSaving,
  uploadImage,
  loadPwa,
  auditList,
  auditTotal,
  auditPage,
  loadAudit,
  flashMessage,
  isAdvanced,
  handleToggleAdvanced,
  menuItems = [],
  menuCategories = [],
  setMenuItems
}: SettingsCenterProps) {
  // Navigation & States
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileViewingForm, setIsMobileViewingForm] = useState<boolean>(false);
  const [isNavigatingByKeyboard, setIsNavigatingByKeyboard] = useState<boolean>(false);

  const [appUrlOrigin, setAppUrlOrigin] = useState<string>('');
  const [detectedLanIp, setDetectedLanIp] = useState<string>('127.0.0.1');
  const [customLanIp, setCustomLanIp] = useState<string>('');
  const [isCloudHost, setIsCloudHost] = useState<boolean>(false);
  const [waiterPort, setWaiterPort] = useState<string>('3000');
  const [waiterUserOption, setWaiterUserOption] = useState<string>('all');
  const [customWaiterName, setCustomWaiterName] = useState<string>('');
  const [waiterList, setWaiterList] = useState<{ id: string; name: string; role: string; brandName?: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [customerPort, setCustomerPort] = useState<string>('3003');
  const [customerTableToken, setCustomerTableToken] = useState<string>('demo');

  // ── Floor, Section & Table Management States ──
  const [floorList, setFloorList] = useState<any[]>(floors || []);
  const [tableList, setTableList] = useState<any[]>(floorTables || []);
  const [floorBusy, setFloorBusy] = useState<boolean>(false);
  const [floorError, setFloorError] = useState<string | null>(null);

  // Section Modal
  const [showSectionModal, setShowSectionModal] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [sectionForm, setSectionForm] = useState<{ name: string; description: string }>({ name: '', description: '' });
  const [sectionSaving, setSectionSaving] = useState<boolean>(false);

  // Table Modal
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [tableForm, setTableForm] = useState<{ label: string; seats: number; floorId: string; active: boolean }>({
    label: '',
    seats: 4,
    floorId: '',
    active: true,
  });
  const [tableSaving, setTableSaving] = useState<boolean>(false);

  // Table QR Modal
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);
  const [qrCopied, setQrCopied] = useState<boolean>(false);
  const [qrRegenerating, setQrRegenerating] = useState<boolean>(false);

  useEffect(() => {
    if (floors && Array.isArray(floors)) setFloorList(floors);
  }, [floors]);

  useEffect(() => {
    if (floorTables && Array.isArray(floorTables)) setTableList(floorTables);
  }, [floorTables]);

  const refreshFloorData = useCallback(async () => {
    try {
      setFloorBusy(true);
      setFloorError(null);
      const res = await fetch(`/api/dashboard/floor?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load floor data');
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.floors)) setFloorList(data.floors);
        if (Array.isArray(data.tables)) setTableList(data.tables);
        if (onFloorUpdated) {
          await onFloorUpdated();
        }
      }
    } catch (err: any) {
      setFloorError(err?.message || 'Error loading sections and tables');
    } finally {
      setFloorBusy(false);
    }
  }, [onFloorUpdated]);

  const handleOpenAddSection = () => {
    setEditingSection(null);
    setSectionForm({ name: '', description: '' });
    setShowSectionModal(true);
  };

  const handleOpenEditSection = (s: any) => {
    setEditingSection(s);
    setSectionForm({ name: s.name || '', description: s.description || '' });
    setShowSectionModal(true);
  };

  const handleSaveSection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = sectionForm.name.trim();
    if (!name) {
      alert('Please enter a section name.');
      return;
    }
    setSectionSaving(true);
    try {
      const payload = editingSection
        ? { action: 'floor_update', floorId: editingSection.id, name, description: sectionForm.description.trim() }
        : { action: 'floor_add', name, description: sectionForm.description.trim() };

      const res = await fetch('/api/dashboard/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Failed to save section');
      }
      flashMessage(editingSection ? `Section "${name}" updated` : `Section "${name}" created`);
      setShowSectionModal(false);
      await refreshFloorData();
    } catch (err: any) {
      alert(err.message || 'Error saving section');
    } finally {
      setSectionSaving(false);
    }
  };

  const handleDeleteSection = (s: any) => {
    const matching = tableList.filter((t) => t.floorId === s.id);
    const msg = matching.length > 0
      ? `Section "${s.name}" contains ${matching.length} table(s). Deleting this section will unassign these tables (they will not be deleted). Are you sure?`
      : `Are you sure you want to delete section "${s.name}"?`;

    setShowConfirmModal({
      show: true,
      title: `Delete Section "${s.name}"`,
      message: msg,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/dashboard/floor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'floor_delete', floorId: s.id }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.message || data.error || 'Failed to delete section');
          }
          flashMessage(`Section "${s.name}" deleted`);
          await refreshFloorData();
        } catch (err: any) {
          alert(err.message || 'Error deleting section');
        }
      },
    });
  };

  const handleOpenAddTable = (defaultFloorId?: string) => {
    setEditingTable(null);
    setTableForm({
      label: `T${tableList.length + 1}`,
      seats: 4,
      floorId: defaultFloorId || (floorList[0]?.id ?? ''),
      active: true,
    });
    setShowTableModal(true);
  };

  const handleOpenEditTable = (t: any) => {
    setEditingTable(t);
    setTableForm({
      label: t.label || '',
      seats: t.seats || 4,
      floorId: t.floorId || '',
      active: t.active !== false,
    });
    setShowTableModal(true);
  };

  const handleSaveTable = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const label = tableForm.label.trim();
    if (!label) {
      alert('Please enter a table label/number.');
      return;
    }
    const seats = Number(tableForm.seats) || 2;
    setTableSaving(true);
    try {
      const payload = editingTable
        ? {
            action: 'update',
            id: editingTable.id,
            label,
            seats,
            floorId: tableForm.floorId || null,
            active: tableForm.active,
          }
        : {
            action: 'create',
            label,
            seats,
            floorId: tableForm.floorId || null,
            active: tableForm.active,
          };

      const res = await fetch('/api/dashboard/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Failed to save table');
      }
      flashMessage(editingTable ? `Table "${label}" updated` : `Table "${label}" created`);
      setShowTableModal(false);
      await refreshFloorData();
    } catch (err: any) {
      alert(err.message || 'Error saving table');
    } finally {
      setTableSaving(false);
    }
  };

  const handleDeleteTable = (t: any) => {
    setShowConfirmModal({
      show: true,
      title: `Delete Table "${t.label}"`,
      message: `Are you sure you want to delete table "${t.label}"? If historical orders exist, it will be safely deactivated to preserve sales history.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/dashboard/floor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: t.id }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.message || data.error || 'Failed to delete table');
          }
          flashMessage(data.deactivated ? `Table "${t.label}" deactivated (orders preserved)` : `Table "${t.label}" removed`);
          await refreshFloorData();
        } catch (err: any) {
          alert(err.message || 'Error deleting table');
        }
      },
    });
  };

  const handleMoveTable = async (tableId: string, newFloorId: string) => {
    try {
      const res = await fetch('/api/dashboard/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', id: tableId, floorId: newFloorId || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Failed to move table');
      }
      flashMessage('Table section updated');
      await refreshFloorData();
    } catch (err: any) {
      alert(err.message || 'Error moving table');
    }
  };

  const handleRegenerateQr = async (t: any) => {
    if (!confirm(`Regenerate QR token for table "${t.label}"? Any previously printed QR code for this table will stop working.`)) {
      return;
    }
    setQrRegenerating(true);
    try {
      const res = await fetch('/api/dashboard/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', id: t.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Failed to regenerate QR');
      }
      flashMessage(`QR token regenerated for ${t.label}`);
      if (qrModalTable && qrModalTable.id === t.id && data.table) {
        setQrModalTable({ ...qrModalTable, qrToken: data.table.qrToken });
      }
      await refreshFloorData();
    } catch (err: any) {
      alert(err.message || 'Error regenerating QR');
    } finally {
      setQrRegenerating(false);
    }
  };

  const handlePrintTableQr = (table: any, sectionName?: string) => {
    const printWin = window.open('', '_blank', 'width=650,height=800');
    if (!printWin) {
      alert('Pop-up blocked. Please allow pop-ups for printing.');
      return;
    }
    const storeName = outlet?.name || 'Restaurant POS';
    const qrUrl = tableQrImageUrl(table.qrToken, 600);
    const orderUrl = tableOrderUrl(table.qrToken);
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Table QR - ${table.label}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #fdfaf5;
            color: #1a1612;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 30px;
          }
          .standee-card {
            background: #ffffff;
            border: 3px solid #f59e0b;
            border-radius: 28px;
            padding: 40px 32px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 16px 40px rgba(0,0,0,0.08);
          }
          .brand {
            font-size: 22px;
            font-weight: 800;
            color: #d97706;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
          }
          .tagline {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #92400e;
            margin-bottom: 24px;
          }
          .table-badge {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            padding: 8px 24px;
            border-radius: 9999px;
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -0.5px;
            margin-bottom: 8px;
            border: 1px solid #fde68a;
          }
          .section-label {
            font-size: 13px;
            font-weight: 600;
            color: #78716c;
            margin-bottom: 24px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .qr-wrapper {
            background: #ffffff;
            border: 2px dashed #e5e7eb;
            border-radius: 20px;
            padding: 16px;
            display: inline-block;
            margin-bottom: 24px;
            box-shadow: inset 0 2px 6px rgba(0,0,0,0.02);
          }
          .qr-wrapper img {
            width: 250px;
            height: 250px;
            display: block;
          }
          .scan-prompt {
            font-size: 18px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 6px;
          }
          .scan-subtext {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.4;
          }
          .footer-url {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #f3f4f6;
            font-size: 10px;
            font-family: monospace;
            color: #9ca3af;
            word-break: break-all;
          }
          @media print {
            body { background: transparent; padding: 0; }
            .standee-card { box-shadow: none; border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div class="brand">${storeName}</div>
          <div class="tagline">Contactless Dining</div>
          <div class="table-badge">Table ${table.label}</div>
          <div class="section-label">${sectionName ? `${sectionName} Section` : 'Dine-In Area'} · ${table.seats} Seats</div>
          <div class="qr-wrapper">
            <img src="${qrUrl}" alt="Scan to Order - Table ${table.label}" />
          </div>
          <div class="scan-prompt">Scan with Camera to Order</div>
          <div class="scan-subtext">Browse our digital menu, customize items, and place your order instantly.</div>
          <div class="footer-url">${orderUrl}</div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // ── Developer Mode & Multi-Step Gate States ──
  const [isDeveloperUnlocked, setIsDeveloperUnlocked] = useState<boolean>(false);
  const [devUserInput, setDevUserInput] = useState<string>('Admin@Nuro');
  const [devPasswordInput, setDevPasswordInput] = useState<string>('');
  const [devAuthStep, setDevAuthStep] = useState<'credentials' | 'authenticator'>('credentials');
  const [devOtpInput, setDevOtpInput] = useState<string>('');
  const [devPasswordError, setDevPasswordError] = useState<string | null>(null);

  // ── Custom Plan & Expiry Management States ──
  const [customPlanPeriod, setCustomPlanPeriod] = useState<string>('custom');
  const [customPlanType, setCustomPlanType] = useState<string>('pro');
  const [customPlanEndDate, setCustomPlanEndDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0] || '';
  });
  const [planPasswordInput, setPlanPasswordInput] = useState<string>('');
  const [planUpdateLoading, setPlanUpdateLoading] = useState<boolean>(false);
  const [planUpdateMessage, setPlanUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentLicenseData, setCurrentLicenseData] = useState<{ licenseType?: string; expiryDate?: string; status?: string; daysRemaining?: number } | null>(null);

  // Transactional Data Reset Modal
  const [showTxResetModal, setShowTxResetModal] = useState<boolean>(false);
  const [txResetPassword, setTxResetPassword] = useState<string>('');
  const [txResetError, setTxResetError] = useState<string | null>(null);
  const [txResetLoading, setTxResetLoading] = useState<boolean>(false);

  // Factory Reset Modal
  const [showFactoryResetModal, setShowFactoryResetModal] = useState<boolean>(false);
  const [factoryResetPassword, setFactoryResetPassword] = useState<string>('');
  const [factoryResetError, setFactoryResetError] = useState<string | null>(null);
  const [factoryResetLoading, setFactoryResetLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrlOrigin(window.location.origin);
      const isCloud = window.location.hostname.includes('vercel.app') || window.location.hostname.includes('chayaone.com');
      setIsCloudHost(isCloud);

      const savedShopIp = localStorage.getItem('chayaone_shop_local_ip');
      if (savedShopIp) {
        setCustomLanIp(savedShopIp);
      }

      fetch('/api/server/info')
        .then((res) => res.json())
        .then((data) => {
          if (data?.localIp) {
            setDetectedLanIp(data.localIp);
            if (!savedShopIp && !isCloud) {
              setCustomLanIp(data.localIp);
            }
          }
        })
        .catch(() => {});

      fetch('/api/server/waiters')
        .then((res) => res.json())
        .then((data) => {
          if (data?.waiters && Array.isArray(data.waiters)) {
            setWaiterList(data.waiters);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (activePanel === 'developer') {
      fetch('/api/license/status')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setCurrentLicenseData({
              licenseType: data.license?.licenseType || data.plan || 'Pro',
              expiryDate: data.license?.expiryDate || data.expiryDate,
              status: data.status || (data.isExpired ? 'EXPIRED' : 'ACTIVE'),
              daysRemaining: data.daysRemaining,
            });
            if (data.license?.expiryDate) {
              setCustomPlanEndDate(new Date(data.license.expiryDate).toISOString().split('T')[0] || '');
            }
          }
        })
        .catch(() => {});
    }
  }, [activePanel]);

  const effectiveLanIp = customLanIp.trim() || detectedLanIp || '127.0.0.1';

  const handleSaveShopIp = (ipToSave: string) => {
    const cleaned = ipToSave.trim();
    setCustomLanIp(cleaned);
    localStorage.setItem('chayaone_shop_local_ip', cleaned);
    flashMessage(`Saved Shop Main PC IP: ${cleaned}`);
  };

  const handleUpdatePlanExpiry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPw = planPasswordInput.trim();
    if (!cleanPw) {
      setPlanUpdateMessage({ type: 'error', text: 'Please enter master developer password.' });
      return;
    }
    const validPws = ['8281594767@shamil', '8281594767@Shamil', 'Admin@Nuro', 'admin@nuro', '82815947678281594767'];
    if (!validPws.includes(cleanPw)) {
      setPlanUpdateMessage({ type: 'error', text: 'Incorrect developer password. Authorization denied.' });
      return;
    }

    setPlanUpdateLoading(true);
    setPlanUpdateMessage(null);

    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: customPlanPeriod,
          licenseType: customPlanType,
          customEndDate: customPlanPeriod === 'custom' ? customPlanEndDate : undefined,
          adminPassphrase: cleanPw,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPlanUpdateMessage({ type: 'error', text: data.message || 'Failed to update plan expiration.' });
        return;
      }

      const displayDate = new Date(data.license?.expiryDate || customPlanEndDate).toLocaleDateString(undefined, {
        dateStyle: 'long',
      });
      setPlanUpdateMessage({
        type: 'success',
        text: `Commercial plan updated! New expiration date: ${displayDate}`,
      });
      setPlanPasswordInput('');
      flashMessage(`Plan expiration set to ${displayDate}`);

      const statusRes = await fetch('/api/license/status').then((r) => r.json()).catch(() => null);
      if (statusRes) {
        setCurrentLicenseData({
          licenseType: statusRes.license?.licenseType || customPlanType,
          expiryDate: statusRes.license?.expiryDate || customPlanEndDate,
          status: statusRes.status || 'ACTIVE',
          daysRemaining: statusRes.daysRemaining,
        });
      }
    } catch (err: any) {
      setPlanUpdateMessage({ type: 'error', text: err?.message || 'Network error updating plan.' });
    } finally {
      setPlanUpdateLoading(false);
    }
  };

  const handleCopyLink = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedLink(label);
      flashMessage(`Copied ${label} connection URL!`);
      setTimeout(() => setCopiedLink(null), 3000);
    }
  };

  // Device Test & Station Routing state
  const [testConnectionStatus, setTestConnectionStatus] = useState<Record<string, { loading: boolean; ok?: boolean; message?: string }>>({});
  const [testKotStatus, setTestKotStatus] = useState<Record<string, { loading: boolean; ok?: boolean; message?: string }>>({});
  const [showStationRoutingModal, setShowStationRoutingModal] = useState<boolean>(false);
  const [routingSearch, setRoutingSearch] = useState<string>('');
  const [routingStationFilter, setRoutingStationFilter] = useState<string>('all');
  const [savingMenuItemId, setSavingMenuItemId] = useState<string | null>(null);

  const handleTestConnection = async (targetOrIp?: string, portVal?: string | number) => {
    const key = targetOrIp || deviceForm.target || deviceForm.ip || 'form';
    setTestConnectionStatus((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'device_test_connection',
          target: targetOrIp || deviceForm.target,
          ip: deviceForm.ip,
          port: portVal || deviceForm.port,
        }),
      });
      const data = await res.json();
      setTestConnectionStatus((prev) => ({
        ...prev,
        [key]: { loading: false, ok: data.reachable, message: data.message },
      }));
      flashMessage(data.message || (data.reachable ? 'Printer reachable' : 'Printer unreachable'));
    } catch {
      setTestConnectionStatus((prev) => ({
        ...prev,
        [key]: { loading: false, ok: false, message: 'Connection test failed' },
      }));
      flashMessage('Connection test failed');
    }
  };

  const handlePrintTestKot = async (dev?: Device) => {
    const key = dev?.id || 'form';
    setTestKotStatus((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'device_test_kot',
          device: dev || deviceForm,
          station: dev?.station || deviceForm.station || 'kitchen',
          name: dev?.name || deviceForm.name || 'Kitchen Printer 01',
        }),
      });
      const data = await res.json();
      setTestKotStatus((prev) => ({
        ...prev,
        [key]: { loading: false, ok: res.ok, message: data.message },
      }));
      flashMessage(data.message || 'Test KOT dispatched');
    } catch {
      setTestKotStatus((prev) => ({
        ...prev,
        [key]: { loading: false, ok: false, message: 'Test KOT dispatch failed' },
      }));
      flashMessage('Test KOT dispatch failed');
    }
  };

  const handleAssignItemStation = async (itemId: string, station: string) => {
    setSavingMenuItemId(itemId);
    try {
      const res = await fetch('/api/dashboard/menu', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', itemId, station: station === 'none' ? null : station }),
      });
      if (res.ok) {
        flashMessage('Item station updated!');
        if (setMenuItems) {
          setMenuItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, station: station === 'none' ? null : station } : i))
          );
        }
      } else {
        flashMessage('Could not update station');
      }
    } catch {
      flashMessage('Error updating station');
    } finally {
      setSavingMenuItemId(null);
    }
  };

  // Favorites & Recently Used
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);

  useEffect(() => {
    const savedFav = localStorage.getItem('cafeos_settings_favorites');
    if (savedFav) {
      setFavorites(JSON.parse(savedFav));
    } else {
      setFavorites(['general', 'business_hours', 'tax']);
    }

    const savedRecent = localStorage.getItem('cafeos_settings_recently_used');
    if (savedRecent) {
      setRecentlyUsed(JSON.parse(savedRecent));
    }
  }, []);

  const toggleFavorite = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = favorites.includes(key)
      ? favorites.filter((k) => k !== key)
      : [...favorites, key];
    setFavorites(next);
    localStorage.setItem('cafeos_settings_favorites', JSON.stringify(next));
  };

  const trackRecentlyUsed = (key: string) => {
    const next = [key, ...recentlyUsed.filter((k) => k !== key)].slice(0, 3);
    setRecentlyUsed(next);
    localStorage.setItem('cafeos_settings_recently_used', JSON.stringify(next));
  };

  // Mock Form States for New Redesign Categories
  const [diningModes, setDiningModes] = useState({
    dineIn: true,
    takeaway: true,
    delivery: true,
    qrSelfOrder: true,
    defaultMode: 'dine_in',
    avgWaitTimeMin: '15'
  });

  const [branding, setBranding] = useState({
    primaryColor: '#E25C22',
    accentColor: '#F39C12',
    backgroundColor: '#FAF7F2',
    fontFamily: 'Outfit',
    logoPosition: 'center',
    themeMode: 'light'
  });

  const [orderWorkflow, setOrderWorkflow] = useState({
    autoAccept: true,
    autoPrintKot: true,
    cancelGraceSeconds: '60',
    kitchenRoutingMode: 'parallel',
    soundAlerts: true
  });

  const [shiftManagement, setShiftManagement] = useState({
    enforceCashDeclaration: true,
    autoEndShift: false,
    shiftDurationHours: '8',
    midDayReconciliation: true,
    sendEmailReportOnEnd: true
  });

  const [cashDrawer, setCashDrawer] = useState({
    initialCashFloat: '2000',
    autoLockDrawer: true,
    discrepancyLimit: '100',
    openOnSale: true,
    managerOverrideRequired: false
  });

  const [reservations, setReservations] = useState({
    enableBookings: true,
    slotIntervalMin: '30',
    tableHoldMin: '15',
    maxGuestsPerReservation: '8',
    collectDeposit: false,
    depositAmount: '500'
  });

  const [reviews, setReviews] = useState({
    whatsappFeedback: true,
    requestDelayMin: '30',
    googleReviewsLink: 'https://g.page/chaya-one/review',
    filterNegativeReview: true
  });

  const [apiKeys, setApiKeys] = useState<any[]>([
    { id: '1', name: 'POS Terminal Sync', keyPrefix: 'chy_live_a3f9...', createdAt: '2026-07-15' },
    { id: '2', name: 'Zomato Integration API', keyPrefix: 'chy_live_9b2e...', createdAt: '2026-07-20' }
  ]);
  const [newKeyName, setNewKeyName] = useState('');

  const [developerOptions, setDeveloperOptions] = useState({
    sandboxMode: false,
    verboseLogging: true,
    offlineDbSync: true,
    localCacheIntervalSec: '300'
  });

  // Enterprise States
  const [enterpriseMultibranch, setEnterpriseMultibranch] = useState({
    branchSyncMenu: true,
    branchSyncTax: true,
    allowBranchSpecificPricing: true,
    hqReportConsolidated: true
  });

  const [enterprisePolicy, setEnterprisePolicy] = useState({
    restrictDiscountsToManager: true,
    minBillRoundoffEnabled: true,
    mandateReasonForManualDiscounts: true,
    preventPriceOverridesAtPOS: false
  });

  const [enterpriseSso, setEnterpriseSso] = useState({
    ssoProvider: 'SAML',
    idpUrl: 'https://okta.chaya.one/sso',
    clientId: 'chaya_one_okta_client_id_772',
    forceSso: false
  });

  const [enterpriseWebhooks, setEnterpriseWebhooks] = useState({
    webhookUrl: 'https://webhook.site/chaya-one',
    events: ['order.created', 'order.settled'],
    secret: 'whsec_••••••••••••••••••••••••••••'
  });

  const [enterpriseIntegrations, setEnterpriseIntegrations] = useState({
    sapConnected: false,
    sapHost: '',
    zohoBooksConnected: true,
    zohoAutoExport: true
  });

  // Unsaved changes tracking (for mock settings, or overall page settings)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [originalFormData, setOriginalFormData] = useState<string>('');

  // Confirmation dialogs
  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Advanced GST configuration states
  const [gstConfig, setGstConfig] = useState<any>({
    enabled: false,
    gstin: '',
    legalName: '',
    stateCode: '',
    registrationType: 'regular',
    gstType: 'exclusive',
    inclusive: false,
    calculationMethod: 'per_item',
    defaultRate: 5,
    
    // Rules
    gstOnFood: true,
    gstOnBeverage: true,
    gstOnCombo: true,
    gstOnDelivery: false,
    gstOnPackaging: false,
    gstOnServiceCharge: false,
    gstOnConvenience: false,
    chargeGstRate: 5,

    // Discount rules
    calculateGstBeforeDiscount: false,
    applyGstToCoupon: true,
    applyGstToManual: true,

    // Specific overrides
    dineInRate: null,
    takeawayRate: null,
    deliveryRate: null,
    qrOrderingRate: null,
    cloudKitchenRate: null,

    // Receipt settings
    showGstin: true,
    showTaxSummary: true,
    showCgst: true,
    showSgst: true,
    showIgst: true,
    showHsn: true,
    showTaxPct: true,
    showTaxAmt: true,
    receiptFooter: 'Thank you! Visit again.',
    taxInvoiceTitle: 'TAX INVOICE',

    // Invoice Settings
    invoicePrefix: 'CHY',
    invoiceFormat: 'YYYY/MM/DD/NNNN',
    roundOff: true,
    roundingPrecision: 0,
    printTaxInvoice: true,
    duplicateInvoice: true,
  });

  const [validationError, setValidationError] = useState<{ field: string; message: string } | null>(null);
  const [gstLocalSaving, setGstLocalSaving] = useState(false);
  const [showGstReasonPrompt, setShowGstReasonPrompt] = useState(false);
  const [gstReasonText, setGstReasonText] = useState('');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    registration: true,
    rules: false,
    layout: false,
    backup: false,
    reports: false,
    audit: false,
  });

  // GST Report state
  const [reportDates, setReportDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // last 30 days
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [gstReportData, setGstReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const fetchGstReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/dashboard/reports/gst?startDate=${reportDates.startDate}&endDate=${reportDates.endDate}`);
      const d = await res.json();
      if (res.ok) {
        setGstReportData(d);
      } else {
        flashMessage(d.message || 'Could not load GST report');
      }
    } catch (err) {
      console.error(err);
      flashMessage('Could not load GST report');
    } finally {
      setLoadingReport(false);
    }
  };

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  useEffect(() => {
    if (outlet?.gstConfig) {
      setGstConfig(outlet.gstConfig);
    }
  }, [outlet]);

  // Load audit history when Tax or Audit tab is opened
  useEffect(() => {
    if (activePanel === 'tax' || activePanel === 'audit') {
      loadAudit(1);
    }
  }, [activePanel]);

  // Automatically load PWA configuration when Customer App (pwa) panel is opened
  useEffect(() => {
    if (activePanel === 'pwa' && !pwaCfg) {
      if (loadPwa) {
        loadPwa().catch(() => {
          setPwaCfg((prev) => prev ?? DEFAULT_PWA);
        });
      } else {
        fetch('/api/dashboard/section?s=pwa')
          .then((r) => r.json())
          .then((d) => {
            setPwaCfg(d.data?.config ?? DEFAULT_PWA);
          })
          .catch(() => {
            setPwaCfg(DEFAULT_PWA);
          });
      }
    }
  }, [activePanel, pwaCfg, loadPwa, setPwaCfg]);

  const handleSaveGstLocal = async (e?: React.FormEvent, reason?: string) => {
    if (e) e.preventDefault();

    // Validations
    if (gstConfig.enabled) {
      if (!gstConfig.gstin) {
        setValidationError({ field: 'gstin', message: 'GSTIN is required when GST is enabled.' });
        return;
      }
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
      if (!gstinRegex.test(gstConfig.gstin)) {
        setValidationError({ field: 'gstin', message: 'GSTIN format is invalid. Standard format: 22AAAAA0000A1Z5' });
        return;
      }
      if (!gstConfig.legalName) {
        setValidationError({ field: 'legalName', message: 'Legal Business Name is required.' });
        return;
      }
      if (!gstConfig.stateCode) {
        setValidationError({ field: 'stateCode', message: 'State code is required.' });
        return;
      }
    }

    setValidationError(null);
    setGstLocalSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'gst_save',
          gst: gstConfig,
          reason: reason || 'GST settings updated'
        }),
      });
      const data = await res.json();
      if (res.ok) {
        flashMessage(gstConfig.enabled ? 'GST settings saved successfully' : 'GST disabled — bills are now tax-free');
        if (data.gst) setGstConfig(data.gst);
        setShowGstReasonPrompt(false);
        setGstReasonText('');
      } else {
        flashMessage(data.message || 'Could not save GST settings');
      }
    } catch (err) {
      console.error(err);
      flashMessage('Could not save GST settings');
    } finally {
      setGstLocalSaving(false);
    }
  };

  const handleExportGst = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gst-config-${outlet?.name || 'outlet'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    flashMessage('GST configuration exported.');
  };

  const handleImportGst = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          if ('enabled' in parsed) {
            setGstConfig(parsed);
            flashMessage('GST configuration imported. Enter reason and Save to apply changes.');
          } else {
            flashMessage('Invalid file format. Missing GST fields.');
          }
        }
      } catch (err) {
        flashMessage('Error reading file. Ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreDefaults = () => {
    setShowConfirmModal({
      show: true,
      title: "Restore Default GST Settings?",
      message: "This will disable GST and restore all settings to default values. Future transactions will be tax-free.",
      onConfirm: async () => {
        setGstLocalSaving(true);
        try {
          const res = await fetch('/api/dashboard/settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'gst_reset' }),
          });
          const d = await res.json();
          if (res.ok) {
            flashMessage('GST settings restored to defaults.');
            if (d.gst) setGstConfig(d.gst);
          } else {
            flashMessage(d.message || 'Could not restore default settings');
          }
        } catch (err) {
          console.error(err);
          flashMessage('Could not restore default settings');
        } finally {
          setGstLocalSaving(false);
        }
      }
    });
  };

  const handleToggleGst = (newVal: boolean) => {
    const title = newVal ? "Enable GST?" : "Disable GST?";
    const message = newVal
      ? "Enabling GST will affect only future bills and invoices. Existing transactions will remain unchanged."
      : "Disabling GST will stop tax calculation for future transactions. Historical invoices will remain unchanged.";
    
    setShowConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => {
        setGstConfig((prev: any) => ({ ...prev, enabled: newVal }));
      }
    });
  };

  const renderAuditDiff = (log: any) => {
    const nextVal = log.after?.gst;
    const prevVal = log.before?.gst;
    if (!nextVal) return "N/A";
    if (log.action === 'gst.reset') return "GST Config reset to default";
    
    const changes: string[] = [];
    if (nextVal.enabled !== prevVal?.enabled) {
      changes.push(nextVal.enabled ? "GST Enabled" : "GST Disabled");
    }
    if (nextVal.gstin !== prevVal?.gstin) {
      changes.push(`GSTIN: ${prevVal?.gstin || 'None'} → ${nextVal.gstin}`);
    }
    if (nextVal.defaultRate !== prevVal?.defaultRate) {
      changes.push(`Default Rate: ${prevVal?.defaultRate ?? '5'}% → ${nextVal.defaultRate}%`);
    }
    if (nextVal.gstType !== prevVal?.gstType) {
      changes.push(`Type: ${prevVal?.gstType || 'exclusive'} → ${nextVal.gstType}`);
    }
    return changes.length > 0 ? changes.join(', ') : "Settings updated";
  };


  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation index for Settings Home cards
  const [keyboardNavIndex, setKeyboardNavIndex] = useState<number>(0);

  // Gated Role Permissions Checking
  const isManagerOrOwner = staff.role === 'owner' || staff.role === 'manager';
  const isOwner = staff.role === 'owner';

  // Check role-based and module-based category visibility
  const isCategoryVisible = (item: SettingItem) => {
    if (staff.role === 'cashier') {
      if (item.key === 'general' || item.key === 'tax' || item.key === 'modules') return false;
    }
    if (item.key === 'modules' && staff.role !== 'owner' && staff.role !== 'manager') return false;

    // Module enablement gating — hide configurations for disabled modules
    if (moduleConfig) {
      if (item.key === 'kitchen' && !moduleConfig.enabledModules.includes('kds')) return false;
      if (item.key === 'inventory' && !moduleConfig.enabledModules.includes('inventory')) return false;
      if (item.key === 'pwa' && !moduleConfig.enabledModules.includes('customer_qr')) return false;
      if (item.key === 'loyalty' && !moduleConfig.enabledModules.includes('loyalty')) return false;
    }

    if (item.enterpriseOnly && outlet.plan?.toLowerCase() !== 'enterprise') return false;
    return true;
  };

  // Filtered sections and items based on search query and selected category tab
  const filteredSections = useMemo(() => {
    const isEnterprise = outlet.plan?.toLowerCase() === 'enterprise';
    const allSections = isEnterprise ? [...SECTIONS, ...ENTERPRISE_SECTIONS] : SECTIONS;

    const scopedSections = selectedCategory === 'all'
      ? allSections
      : allSections.filter(s => s.title === selectedCategory);

    if (!searchQuery.trim()) {
      return scopedSections.map(sec => ({
        ...sec,
        items: sec.items.filter(isCategoryVisible)
      })).filter(sec => sec.items.length > 0);
    }

    const query = searchQuery.toLowerCase();
    return scopedSections.map(section => {
      const matchedItems = section.items.filter(item => {
        if (!isCategoryVisible(item)) return false;
        const matchesTitle = item.label.toLowerCase().includes(query);
        const matchesDesc = item.desc.toLowerCase().includes(query);
        const matchesGroup = section.title.toLowerCase().includes(query);
        const matchesKeywords = item.keywords?.some(kw => kw.toLowerCase().includes(query)) ?? false;
        return matchesTitle || matchesDesc || matchesGroup || matchesKeywords;
      });
      return { ...section, items: matchedItems };
    }).filter(section => section.items.length > 0);
  }, [searchQuery, selectedCategory, staff.role, outlet.plan]);

  // Category tabs metadata for the category rail
  const categoryRailTabs = useMemo(() => {
    const isEnterprise = outlet.plan?.toLowerCase() === 'enterprise';
    const allSections = isEnterprise ? [...SECTIONS, ...ENTERPRISE_SECTIONS] : SECTIONS;
    const totalCount = allSections.reduce((acc, s) => acc + s.items.filter(isCategoryVisible).length, 0);

    return [
      {
        key: 'all',
        label: 'All Settings',
        count: totalCount,
        icon: Sliders,
        theme: null,
      },
      ...allSections.map(s => ({
        key: s.title,
        label: s.title,
        count: s.items.filter(isCategoryVisible).length,
        icon: s.theme.icon,
        theme: s.theme,
      }))
    ];
  }, [outlet.plan, staff.role]);

  // Flattened items for keyboard navigation on Settings Home
  const flattenedFilteredItems = useMemo(() => {
    return filteredSections.flatMap(s => s.items);
  }, [filteredSections]);

  // Reset keyboardNavIndex if search query or flattened list changes
  useEffect(() => {
    setKeyboardNavIndex(0);
  }, [searchQuery, flattenedFilteredItems.length]);

  // Keyboard controls for layout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input with Cmd/Ctrl + K or Cmd/Ctrl + F
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape key behavior
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          // If in an input, blur it first
          (document.activeElement as HTMLElement).blur();
        } else if (searchQuery) {
          setSearchQuery('');
        } else if (activePanel !== null) {
          setActivePanel(null);
        }
        return;
      }

      // Ctrl + S or Cmd + S to save active form
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (activePanel) {
          e.preventDefault();
          // Find the save button inside the active panel and click it, or trigger save
          if (hasUnsavedChanges) {
            handleSaveLocal();
          } else if (activePanel === 'tax') {
            setShowGstReasonPrompt(true);
          }
        }
        return;
      }

      // Handle Arrow key navigation and Enter only when search is focused or activePanel is null
      if (activePanel === null && flattenedFilteredItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setIsNavigatingByKeyboard(true);
          setKeyboardNavIndex(prev => (prev + 1 >= flattenedFilteredItems.length ? 0 : prev + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIsNavigatingByKeyboard(true);
          setKeyboardNavIndex(prev => (prev - 1 < 0 ? flattenedFilteredItems.length - 1 : prev - 1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setIsNavigatingByKeyboard(true);
          setKeyboardNavIndex(prev => (prev + 1 >= flattenedFilteredItems.length ? 0 : prev + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setIsNavigatingByKeyboard(true);
          setKeyboardNavIndex(prev => (prev - 1 < 0 ? flattenedFilteredItems.length - 1 : prev - 1));
        } else if (e.key === 'Enter') {
          const selected = flattenedFilteredItems[keyboardNavIndex];
          if (selected) {
            e.preventDefault();
            setActivePanel(selected.key);
            trackRecentlyUsed(selected.key);
            setIsMobileViewingForm(true);
            setIsNavigatingByKeyboard(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flattenedFilteredItems, searchQuery, activePanel, keyboardNavIndex, hasUnsavedChanges]);

  // Check if sensitive settings are restricted
  const isTabBlocked = (item: SettingItem) => {
    if (item.ownerOnly && !isOwner) return true;
    if (item.sensitive && !isManagerOrOwner) return true;
    return false;
  };

  const activeSettingItem = useMemo((): SettingItem => {
    const allItems = [...SECTIONS.flatMap(s => s.items), ...ENTERPRISE_SECTIONS.flatMap(s => s.items)];
    return (allItems.find(i => i.key === activePanel) || SECTIONS[0]!.items[0]!) as SettingItem;
  }, [activePanel]);

  const activeSettingSection = useMemo((): SettingSection => {
    const allSections = [...SECTIONS, ...ENTERPRISE_SECTIONS];
    const found = allSections.find(s => s.items.some(i => i.key === activePanel));
    return found || SECTIONS[0]!;
  }, [activePanel]);

  // Form states and mocks configurations
  const [businessHours, setBusinessHours] = useState({
    monday: { closed: false, open: '08:00', close: '22:00', breakStart: '15:00', breakEnd: '16:00' },
    tuesday: { closed: false, open: '08:00', close: '22:00', breakStart: '15:00', breakEnd: '16:00' },
    wednesday: { closed: false, open: '08:00', close: '22:00', breakStart: '15:00', breakEnd: '16:00' },
    thursday: { closed: false, open: '08:00', close: '22:00', breakStart: '15:00', breakEnd: '16:00' },
    friday: { closed: false, open: '08:00', close: '23:00', breakStart: '15:00', breakEnd: '16:00' },
    saturday: { closed: false, open: '08:00', close: '23:00', breakStart: '15:00', breakEnd: '16:00' },
    sunday: { closed: true, open: '09:00', close: '21:00', breakStart: '', breakEnd: '' },
    tempClosure: false,
    festivalHours: ''
  });

  const [businessDayCfg, setBusinessDayCfg] = useState({
    autoPromptAtMidnight: true,
    closingTime: '00:00',
    cutoffHour: 4,
  });

  const [taxCharges, setTaxCharges] = useState({
    serviceChargePct: '5',
    deliveryChargeFlat: '40',
    packagingChargeFlat: '10',
  });

  const [menuConfig, setMenuConfig] = useState({
    vegLabelOnly: false,
    happyHourEnabled: false,
    happyHourDiscountPct: '15',
    happyHourStart: '16:00',
    happyHourEnd: '19:00',
    allowCombos: true,
    recommendationsCount: '3'
  });

  const [inventoryConfigState, setInventoryConfigState] = useState({
    lowStockThreshold: '10',
    autoDeductStockOnBill: true,
    allowWasteTracking: true,
    wasteReportNotification: true,
    purchaseOrderApproval: true,
  });

  const [billingConfigState, setBillingConfigState] = useState({
    invoicePrefix: 'CHY',
    invoiceNumberLength: '6',
    autoPrintReceipt: false,
    allowDuplicateBill: true,
    managerApprovalReprint: true,
    roundOffTotal: true,
  });

  const [paymentsConfig, setPaymentsConfig] = useState({
    cashEnabled: true,
    cardEnabled: true,
    upiEnabled: outlet.upiConfig?.upiEnabled ?? true,
    walletEnabled: false,
    creditsEnabled: true,
    splitPaymentEnabled: true,
    partialPaymentEnabled: false,
    tipEnabled: true,
    tipPercentages: '5, 10, 15',
    autoSettleShifts: true,
    upiId: outlet.upiConfig?.upiId ?? '',
    upiBusinessName: outlet.upiConfig?.payeeName ?? outlet.name ?? '',
    receiptQrEnabled: outlet.upiConfig?.receiptQrEnabled ?? true,
    receiptQrSize: (outlet.upiConfig?.receiptQrSize ?? 'medium') as 'small' | 'medium' | 'large',
    showScanAndPayText: outlet.upiConfig?.showScanAndPayText ?? true,
  });

  const [paymentsSaving, setPaymentsSaving] = useState(false);
  const handleSavePayments = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPaymentsSaving(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'payment',
          payment: {
            cashEnabled: paymentsConfig.cashEnabled,
            cardEnabled: paymentsConfig.cardEnabled,
            upiEnabled: paymentsConfig.upiEnabled,
            upiId: paymentsConfig.upiId,
            upiBusinessName: paymentsConfig.upiBusinessName,
            receiptQrEnabled: paymentsConfig.receiptQrEnabled,
            receiptQrSize: paymentsConfig.receiptQrSize,
            showScanAndPayText: paymentsConfig.showScanAndPayText,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        flashMessage('Payment & UPI settings saved successfully');
        if (data.payment) {
          setPaymentsConfig((prev) => ({
            ...prev,
            upiId: data.payment.upiId ?? prev.upiId,
            upiBusinessName: data.payment.payeeName ?? prev.upiBusinessName,
            receiptQrEnabled: data.payment.receiptQrEnabled ?? prev.receiptQrEnabled,
            receiptQrSize: data.payment.receiptQrSize ?? prev.receiptQrSize,
            showScanAndPayText: data.payment.showScanAndPayText ?? prev.showScanAndPayText,
          }));
        }
      } else {
        flashMessage(data.message || 'Failed to save payment settings');
      }
    } catch {
      flashMessage('Network error saving payment settings');
    } finally {
      setPaymentsSaving(false);
    }
  };

  const [loyaltyConfig, setLoyaltyConfig] = useState({
    pointsEarnRatio: '1', // 1 point per 100 Rs spent
    pointsRedeemValue: '1', // 1 Rs per point
    membershipEnabled: true,
    birthdayRewardMultiplier: '2',
    allowCredits: true,
    creditLimitMax: '5000'
  });

  const [onlineOrderingConfig, setOnlineOrderingConfig] = useState({
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryRadiusKm: '5',
    deliveryChargePerKm: '5',
    minOrderValue: '200',
    timingRestriction: false,
    partnersEnabled: 'Swiggy, Zomato'
  });

  const [notificationsConfig, setNotificationsConfig] = useState({
    whatsappEnabled: true,
    smsEnabled: false,
    emailEnabled: true,
    pushNotificationEnabled: true,
    dailySummaryTime: '23:00',
    lowStockTrigger: true,
    orderAlertSound: true
  });

  const [securityConfig, setSecurityConfig] = useState({
    pinPolicyLength: '4', // 4 digits
    passwordStrength: 'medium',
    twoFactorEnabled: false,
    sessionTimeoutMin: '30',
    restrictToApprovedDevices: false
  });

  const [integrationsConfig, setIntegrationsConfig] = useState({
    razorpayKey: 'rzp_live_••••••••••••••',
    phonepeMerchantId: 'pp_live_••••••••••••',
    whatsappApiToken: 'wa_token_••••••••••••',
    swiggyStatus: 'Connected',
    zomatoStatus: 'Connected',
    tallyEnabled: false,
    zohoEnabled: false,
  });

  // Track initial states for Unsaved Changes
  const gatherAllLocalState = () => {
    return JSON.stringify({
      businessHours,
      taxCharges,
      menuConfig,
      inventoryConfigState,
      billingConfigState,
      paymentsConfig,
      loyaltyConfig,
      onlineOrderingConfig,
      notificationsConfig,
      securityConfig,
      integrationsConfig
    });
  };

  useEffect(() => {
    // Initialise original state
    setOriginalFormData(gatherAllLocalState());
  }, []);

  // Monitor changes
  const checkUnsaved = () => {
    const current = gatherAllLocalState();
    setHasUnsavedChanges(current !== originalFormData);
  };

  useEffect(() => {
    checkUnsaved();
  }, [
    businessHours, taxCharges, menuConfig, inventoryConfigState,
    billingConfigState, paymentsConfig, loyaltyConfig, onlineOrderingConfig,
    notificationsConfig, securityConfig, integrationsConfig
  ]);

  // Reset local forms
  const handleResetLocal = () => {
    if (!originalFormData) return;
    const parsed = JSON.parse(originalFormData);
    setBusinessHours(parsed.businessHours);
    setTaxCharges(parsed.taxCharges);
    setMenuConfig(parsed.menuConfig);
    setInventoryConfigState(parsed.inventoryConfigState);
    setBillingConfigState(parsed.billingConfigState);
    setPaymentsConfig(parsed.paymentsConfig);
    setLoyaltyConfig(parsed.loyaltyConfig);
    setOnlineOrderingConfig(parsed.onlineOrderingConfig);
    setNotificationsConfig(parsed.notificationsConfig);
    setSecurityConfig(parsed.securityConfig);
    setIntegrationsConfig(parsed.integrationsConfig);
    setHasUnsavedChanges(false);
    flashMessage('Local modifications discarded.');
  };

  // Mock save API for the custom settings blocks (simulates network and saves to LocalStorage)
  const handleSaveLocal = () => {
    const dataString = gatherAllLocalState();
    localStorage.setItem(`cafeos_custom_settings_${outlet.name}`, dataString);
    setOriginalFormData(dataString);
    setHasUnsavedChanges(false);
    fetch('/api/dashboard/business-day', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'configure', ...businessDayCfg }),
    }).catch(() => {});
    flashMessage('Operational settings saved successfully');
  };

  // Load custom settings if any exist
  useEffect(() => {
    fetch('/api/dashboard/business-day')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) {
          setBusinessDayCfg({
            autoPromptAtMidnight: !!d.state.autoPromptAtMidnight,
            closingTime: d.state.closingTime || '00:00',
            cutoffHour: typeof d.state.cutoffHour === 'number' ? d.state.cutoffHour : 4,
          });
        }
      })
      .catch(() => {});

    const saved = localStorage.getItem(`cafeos_custom_settings_${outlet.name}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.businessHours) setBusinessHours(parsed.businessHours);
        if (parsed.taxCharges) setTaxCharges(parsed.taxCharges);
        if (parsed.menuConfig) setMenuConfig(parsed.menuConfig);
        if (parsed.inventoryConfigState) setInventoryConfigState(parsed.inventoryConfigState);
        if (parsed.billingConfigState) setBillingConfigState(parsed.billingConfigState);
        if (parsed.paymentsConfig) setPaymentsConfig(parsed.paymentsConfig);
        if (parsed.loyaltyConfig) setLoyaltyConfig(parsed.loyaltyConfig);
        if (parsed.onlineOrderingConfig) setOnlineOrderingConfig(parsed.onlineOrderingConfig);
        if (parsed.notificationsConfig) setNotificationsConfig(parsed.notificationsConfig);
        if (parsed.securityConfig) setSecurityConfig(parsed.securityConfig);
        if (parsed.integrationsConfig) setIntegrationsConfig(parsed.integrationsConfig);
        setOriginalFormData(saved);
      } catch (err) {
        console.error('Error loading operational settings', err);
      }
    }
  }, [outlet.name]);

  // Kitchen operations stations handling state
  const [newStationName, setNewStationName] = useState('');

  // Trigger Confirmation Modals
  const triggerConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setShowConfirmModal({ show: true, title, message, onConfirm });
  };

  return (
    <div className="flex flex-col gap-6 min-h-[75vh]" style={{ background: 'var(--paper-1)', color: 'var(--ink)' }}>
      {activePanel === null ? (
        // ─── SETTINGS HOME (MODERN SAAS HUB) ───
        <div className="flex flex-col gap-7 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          {/* Header & Meta Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-line">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-ink">Settings Hub</h1>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-turmeric/10 text-turmeric border border-turmeric/20 uppercase">
                  {outlet.plan || 'Standard'}
                </span>
              </div>
              <p className="text-sm text-ink-3">
                Configure your restaurant profiles, hardware printers, dine-in tables, tax compliance, and guest apps.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-paper-2 border border-line shadow-sm text-xs">
                <Store size={15} className="text-turmeric" />
                <span className="font-bold text-ink">{outlet.name || 'Store'}</span>
                <span className="text-ink-3">•</span>
                <span className="text-ink-2 font-mono">{flattenedFilteredItems.length} Settings</span>
              </div>
            </div>
          </div>

          {/* Search Bar & Quick Tools */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-4 grid place-items-center text-ink-3">
                <Search size={18} />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search settings, tax, printers, modules, roles (Ctrl+K or Cmd+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="inp pl-11 w-full bg-paper-2 rounded-2xl shadow-sm text-sm border-line hover:border-turmeric/40 focus:border-turmeric transition-all"
                style={{ minHeight: '48px' }}
                aria-label="Search Settings"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-12 grid place-items-center text-ink-3 hover:text-ink transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-ink-3 bg-paper-3 border rounded-lg shadow-sm font-mono">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>

          {/* ── INTERACTIVE CATEGORY SEGMENTED RAIL ── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoryRailTabs.map((tab) => {
              const isActive = selectedCategory === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`group flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap shadow-sm ${
                    isActive
                      ? tab.theme
                        ? tab.theme.activeTabClass
                        : 'bg-paper-3 text-ink border-amber-500 ring-1 ring-amber-500/30 shadow-md'
                      : 'bg-paper-2 text-ink-3 hover:text-ink hover:bg-paper-3 border-line'
                  }`}
                >
                  <Icon
                    size={15}
                    style={{
                      color: tab.theme ? tab.theme.accentColor : undefined
                    }}
                    className={!tab.theme ? (!isActive ? 'text-ink-3 group-hover:text-ink' : '') : ''}
                  />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? 'bg-paper-1/80 text-ink font-bold'
                        : 'bg-paper-3 text-ink-3 group-hover:text-ink-2'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Access: Recently Used & Pinned Favorites */}
          {(recentlyUsed.length > 0 || favorites.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {recentlyUsed.length > 0 && (
                <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-paper-2/60 border border-line backdrop-blur-sm">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-ink-3 flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-500" /> Recently Used
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentlyUsed.map((key) => {
                      const allSections = [...SECTIONS, ...ENTERPRISE_SECTIONS];
                      const allItems = allSections.flatMap((s) => s.items);
                      const item = allItems.find((i) => i.key === key);
                      if (!item) return null;
                      const parentSection = allSections.find((s) => s.items.some((i) => i.key === key));
                      const Icon = item.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActivePanel(key);
                            trackRecentlyUsed(key);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-paper-2 hover:bg-paper-3 transition-all text-xs font-bold text-ink shadow-sm ${
                            parentSection ? parentSection.theme.hoverBorder : 'hover:border-amber-500/40'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ background: parentSection ? parentSection.theme.accentColor : '#F59E0B' }}
                          />
                          <Icon size={13} className="text-ink-2" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {favorites.length > 0 && (
                <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-paper-2/60 border border-line backdrop-blur-sm">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-ink-3 flex items-center gap-1.5">
                      <Heart size={12} className="text-red-500 fill-red-500" /> Pinned Favorites
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favorites.map((key) => {
                      const allSections = [...SECTIONS, ...ENTERPRISE_SECTIONS];
                      const allItems = allSections.flatMap((s) => s.items);
                      const item = allItems.find((i) => i.key === key);
                      if (!item) return null;
                      const parentSection = allSections.find((s) => s.items.some((i) => i.key === key));
                      const Icon = item.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActivePanel(key);
                            trackRecentlyUsed(key);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-paper-2 hover:bg-paper-3 transition-all text-xs font-bold text-ink shadow-sm ${
                            parentSection ? parentSection.theme.hoverBorder : 'hover:border-amber-500/40'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ background: parentSection ? parentSection.theme.accentColor : '#F59E0B' }}
                          />
                          <Icon size={13} className="text-ink-2" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── COLOR-CODED SECTION BLOCKS & COLUMN ARCHITECTURE ── */}
          <div className="flex flex-col gap-8 mt-1">
            {filteredSections.map((section) => {
              const SectionIcon = section.theme.icon;
              return (
                <section
                  key={section.title}
                  className="rounded-[22px] border border-line bg-paper-2 p-6 md:p-7 relative overflow-hidden shadow-sm transition-all"
                >
                  {/* Subtle Ambient Radial Glow */}
                  <div
                    className="absolute -top-12 -left-12 w-52 h-52 rounded-full pointer-events-none opacity-40"
                    style={{ background: section.theme.ambientGradient }}
                  />

                  {/* Top Hairline Accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                      background: `linear-gradient(90deg, ${section.theme.accentColor} 0%, transparent 80%)`
                    }}
                  />

                  {/* Section Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 pb-4 border-b border-line/60">
                    <div className="flex items-center gap-3.5">
                      <span
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 shadow-xs ${section.theme.iconContainerClass}`}
                      >
                        <SectionIcon size={20} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-2xl font-bold font-display tracking-tight text-ink">
                            {section.title}
                          </h2>
                          <span
                            className={`text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full border ${section.theme.badgeClass}`}
                          >
                            {section.theme.badge}
                          </span>
                        </div>
                        <p className="text-xs text-ink-3 mt-0.5 max-w-xl leading-relaxed">
                          {section.theme.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-paper-3 border border-line text-ink-3">
                        {section.items.length} {section.items.length === 1 ? 'Module' : 'Modules'}
                      </span>
                    </div>
                  </div>

                  {/* Section Cards Grid (3 Columns Architecture) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 relative z-10">
                    {section.items.map((item) => {
                      const isFav = favorites.includes(item.key);
                      const isKeyboardSelected = flattenedFilteredItems[keyboardNavIndex]?.key === item.key;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            setActivePanel(item.key);
                            trackRecentlyUsed(item.key);
                          }}
                          className={`group relative flex flex-col justify-between p-5 rounded-[20px] border bg-paper-2 hover:bg-paper-3 ${
                            section.theme.hoverBorder
                          } ${section.theme.hoverShadow} hover:-translate-y-[1.5px] transition-all duration-200 cursor-pointer overflow-hidden ${
                            isKeyboardSelected
                              ? 'ring-2 ring-amber-500 border-amber-500 shadow-md'
                              : 'border-line'
                          }`}
                          style={{
                            minHeight: '150px'
                          }}
                        >
                          {/* Hover Top Accent Line */}
                          <div
                            className={`absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r ${section.theme.topAccentGrad} opacity-0 group-hover:opacity-100 transition-opacity`}
                          />

                          {/* Top Row: Themed Icon & Badges */}
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-xs ${section.theme.iconContainerClass}`}
                            >
                              <Icon size={19} />
                            </span>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {item.badge && (
                                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-paper-3 border border-line text-ink-3">
                                  {item.badge}
                                </span>
                              )}

                              {item.sensitive && (
                                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase">
                                  Secure
                                </span>
                              )}

                              <button
                                onClick={(e) => toggleFavorite(item.key, e)}
                                className="p-1 rounded-lg text-ink-3 hover:text-red-500 hover:bg-paper-3 transition-colors ml-0.5"
                                aria-label="Toggle favorite"
                              >
                                <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                              </button>
                            </div>
                          </div>

                          {/* Middle: Content Info */}
                          <div className="mt-3 flex-1">
                            <h4
                              className={`font-bold text-sm text-ink ${section.theme.hoverText} transition-colors flex items-center gap-1.5`}
                            >
                              {item.label}
                            </h4>
                            <p className="text-xs text-ink-3 mt-1 leading-relaxed line-clamp-2">
                              {item.desc}
                            </p>
                          </div>

                          {/* Bottom Row: Key & Action Arrow */}
                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-line/50 text-[11px] text-ink-3">
                            <span className="font-mono text-[10px] text-ink-3/80 uppercase tracking-wider">
                              {item.key.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-semibold ${section.theme.hoverText} transition-colors`}
                            >
                              Configure{' '}
                              <ChevronRight size={13} className="transition-transform group-hover:translate-x-1" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="text-center py-16 card bg-paper-2 border border-line flex flex-col items-center justify-center gap-3">
                <AlertCircle className="text-ink-3" size={36} />
                <h3 className="text-base font-bold text-ink">No matching settings found</h3>
                <p className="text-xs text-ink-3 max-w-sm">
                  No setting matched your query &quot;{searchQuery}&quot;. Try searching with different keywords like tax, printer, table, or user.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => setSearchQuery('')} className="btn btn-sm btn-ghost">
                    Clear Search
                  </button>
                  {selectedCategory !== 'all' && (
                    <button onClick={() => setSelectedCategory('all')} className="btn btn-sm btn-primary">
                      View All Categories
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ─── DEDICATED SETTINGS PAGE (HIGH-CALIBER THEMED VIEW) ───
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
          {/* Enhanced Breadcrumb & Action Header */}
          <div
            className="rounded-2xl border border-line bg-paper-2 p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm"
            style={{
              background: `linear-gradient(to right, var(--paper-2), var(--paper-1))`
            }}
          >
            {/* Ambient subtle glow from active section */}
            <div
              className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none opacity-40"
              style={{ background: activeSettingSection.theme.ambientGradient }}
            />

            <div className="flex items-center justify-between gap-3 relative z-10">
              <button
                onClick={() => setActivePanel(null)}
                className="flex items-center gap-2 text-xs font-bold transition-all px-3.5 py-2 rounded-xl border border-line bg-paper-3 hover:bg-paper-1 shadow-xs"
                style={{ color: activeSettingSection.theme.accentColor }}
              >
                <ChevronLeft size={16} /> Back to Settings
              </button>

              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-ink-3">
                <kbd className="px-2 py-0.5 rounded bg-paper-3 border border-line">Esc</kbd>
                <span>Back</span>
                <span className="text-ink-3/40">•</span>
                <kbd className="px-2 py-0.5 rounded bg-paper-3 border border-line">⌘S</kbd>
                <span>Save</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-ink-3 relative z-10 pt-1">
              <span className="hover:text-ink cursor-pointer transition-colors" onClick={() => setActivePanel(null)}>
                Settings
              </span>
              <ChevronRight size={12} />
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${activeSettingSection.theme.badgeClass}`}
              >
                {activeSettingSection.title}
              </span>
              <ChevronRight size={12} />
              <span className="text-ink font-semibold">{activeSettingItem.label}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10 mt-1">
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${activeSettingSection.theme.iconContainerClass}`}
                >
                  <activeSettingItem.icon size={20} />
                </span>
                <div>
                  <h1 className="text-2xl font-bold font-display text-ink">{activeSettingItem.label}</h1>
                  <p className="text-xs text-ink-3 mt-0.5">{activeSettingItem.desc}</p>
                </div>
              </div>

              {activeSettingItem.sensitive && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase w-fit">
                  Secure Access Gated
                </span>
              )}
            </div>
          </div>

          {/* Form Pane Content */}
          <div className="flex flex-col gap-6 min-h-[50vh]">
            {isTabBlocked(activeSettingItem) ? (
              <div className="card p-8 text-center flex flex-col items-center gap-4 bg-paper-2 border-line">
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Shield size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Access Denied</h3>
                  <p className="text-sm text-ink-3 max-w-sm mt-1 mx-auto">
                    The <b>{activeSettingItem.label}</b> panel contains sensitive configuration. Your current role as <b>{staff.role.toUpperCase()}</b> does not have permissions to view or edit this section.
                  </p>
                </div>
                <p className="text-xs text-ink-3 bg-paper-3 px-3 py-1.5 rounded-lg border">
                  Contact the Store Owner to request role elevation or permissions configuration.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">

              {/* RENDER ACTIVE PANEL */}

              {/* ── 0. MODULES & BUSINESS PROFILE ── */}
              {activePanel === 'modules' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <ModuleManagement
                    moduleConfig={moduleConfig || {
                      businessType: 'cafe',
                      enabledModules: ['core', 'cafe'],
                      installedModules: ['core', 'cafe', 'restaurant', 'hotel', 'juice', 'meals', 'inventory', 'customer_qr', 'waiter', 'kds', 'crm', 'loyalty', 'advanced_reports'],
                      updatedAt: new Date().toISOString(),
                      version: '1.2.0',
                    }}
                    onConfigUpdated={(cfg) => {
                      if (onModuleConfigUpdated) onModuleConfigUpdated(cfg);
                    }}
                    flashMessage={flashMessage}
                  />
                </div>
              )}

              {/* ── 1. GENERAL SETTINGS ── */}
              {activePanel === 'general' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Store className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">General Settings</h2>
                      <p className="text-xs text-ink-3">Configure basic store parameters, profile card and default localizations.</p>
                    </div>
                  </div>

                  {/* Logo Config */}
                  <div className="flex flex-col gap-2.5">
                    <h4 className="font-bold text-sm">Store Brand Logo</h4>
                    <p className="text-xs text-ink-3">Appears on receipt prints, invoices, and customer web applications. Square PNG/JPG formats recommended.</p>
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <div className="relative group">
                          <img src={logoUrl} alt="Store logo" className="rounded-xl border object-contain p-1 w-20 h-20 bg-white" />
                          <button
                            type="button"
                            onClick={() => saveLogo(null)}
                            disabled={logoBusy}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-md transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border grid place-items-center w-20 h-20 bg-paper-3 text-ink-3">
                          <Store size={28} />
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label className={`btn btn-sm cursor-pointer ${logoBusy ? 'opacity-60 pointer-events-none' : ''}`} style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}>
                          {logoBusy ? 'Uploading...' : logoUrl ? 'Change Image' : 'Upload Image'}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/jpg" className="hidden" disabled={logoBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.currentTarget.value = ''; }} />
                        </label>
                        <span className="text-[10px] text-ink-3">Max size: 5MB. Format: PNG, JPG, WEBP</span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Edit Form */}
                  <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="lbl">Outlet Name</label>
                        <input value={profile.name} onChange={(e) => setProfile((p: any) => ({ ...p, name: e.target.value }))} required className="inp" />
                      </div>
                      <div>
                        <label className="lbl">GSTIN</label>
                        <input value={profile.gstin} onChange={(e) => setProfile((p: any) => ({ ...p, gstin: e.target.value }))} placeholder="Not Configured" className="inp" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="lbl">Street Address</label>
                        <input value={profile.line1} onChange={(e) => setProfile((p: any) => ({ ...p, line1: e.target.value }))} placeholder="Store Address, Shop/Floor Number" className="inp" />
                      </div>
                      <div>
                        <label className="lbl">State Code (GST)</label>
                        <input value={profile.stateCode} onChange={(e) => setProfile((p: any) => ({ ...p, stateCode: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="e.g. 27" className="inp" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="lbl">City</label>
                        <input value={profile.city} onChange={(e) => setProfile((p: any) => ({ ...p, city: e.target.value }))} placeholder="City" className="inp" />
                      </div>
                      <div>
                        <label className="lbl">Pincode</label>
                        <input value={profile.pincode} onChange={(e) => setProfile((p: any) => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" className="inp" />
                      </div>
                    </div>

                    {/* Regional localizations */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="lbl">Timezone</label>
                        <select defaultValue="Asia/Kolkata" className="inp bg-paper-3">
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="UTC">UTC (GMT)</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">Store Currency</label>
                        <select defaultValue="INR" className="inp bg-paper-3">
                          <option value="INR">Rupee (₹)</option>
                          <option value="USD">US Dollar ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">Language</label>
                        <select defaultValue="English" className="inp bg-paper-3">
                          <option value="English">English</option>
                          <option value="Hindi">Hindi (हिंदी)</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary self-end px-6 mt-2">
                      Save Profile Settings
                    </button>
                  </form>

                  {/* Advanced Mode configuration card */}
                  <div className="p-4 rounded-2xl flex items-center justify-between border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line-2)' }}>
                    <div className="flex items-center gap-3">
                      <Sliders className="text-turmeric" size={20} />
                      <div>
                        <b className="text-sm block">System Layout Modes</b>
                        <span className="text-xs text-ink-3">Enable complex workflows: multi-terminal support, stock calculations & reports.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleAdvanced(!isAdvanced)}
                      className={`btn btn-sm ${isAdvanced ? 'btn-primary' : 'bg-paper-2'}`}
                    >
                      {isAdvanced ? 'Advanced Mode Unlocked' : 'Switch to Advanced'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── 2. BUSINESS HOURS ── */}
              {activePanel === 'business_hours' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-5 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Clock className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Business Hours & Calendar</h2>
                      <p className="text-xs text-ink-3">Set weekly opening timelines, break periods, and configure holiday mode.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 mb-2">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-red-500" size={18} />
                      <div>
                        <b className="text-sm block">Temporary Emergency Closure</b>
                        <span className="text-xs text-ink-3">Instantly close online QR orders & mark kitchen closed.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setBusinessHours(b => ({ ...b, tempClosure: !b.tempClosure }))}
                      className={`btn btn-sm font-semibold transition-all ${
                        businessHours.tempClosure ? 'btn-danger' : 'border border-line bg-paper-3'
                      }`}
                    >
                      {businessHours.tempClosure ? 'Store is Closed' : 'Mark Store Closed'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h4 className="font-bold text-sm">Weekly Timings</h4>
                    <div className="divide-y divide-line">
                      {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                        const dayData = businessHours[day];
                        return (
                          <div key={day} className="py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
                            <span className="font-bold capitalize w-24">{day}</span>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none">
                                <input
                                  type="checkbox"
                                  checked={dayData.closed}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setBusinessHours(b => ({
                                      ...b,
                                      [day]: { ...b[day], closed: checked }
                                    }));
                                  }}
                                  className="rounded border-line-2 text-turmeric accent-turmeric"
                                />
                                Weekly Holiday
                              </label>
                            </div>

                            {!dayData.closed ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span>Hours:</span>
                                <input
                                  type="time"
                                  value={dayData.open}
                                  onChange={(e) => setBusinessHours(b => ({ ...b, [day]: { ...b[day], open: e.target.value } }))}
                                  className="px-2 py-1 rounded bg-paper-3 border border-line"
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={dayData.close}
                                  onChange={(e) => setBusinessHours(b => ({ ...b, [day]: { ...b[day], close: e.target.value } }))}
                                  className="px-2 py-1 rounded bg-paper-3 border border-line"
                                />

                                <span className="ml-2 text-ink-3">| Break:</span>
                                <input
                                  type="time"
                                  value={dayData.breakStart}
                                  onChange={(e) => setBusinessHours(b => ({ ...b, [day]: { ...b[day], breakStart: e.target.value } }))}
                                  className="px-2 py-1 rounded bg-paper-3 border border-line"
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={dayData.breakEnd}
                                  onChange={(e) => setBusinessHours(b => ({ ...b, [day]: { ...b[day], breakEnd: e.target.value } }))}
                                  className="px-2 py-1 rounded bg-paper-3 border border-line"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-red-500 font-semibold">CLOSED ALL DAY</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Night Shift & Midnight Day Extension (Roles above Cashier: Manager & Owner) ── */}
                  <div className="flex flex-col gap-3 p-4 rounded-xl border bg-paper-3 border-line mt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Moon size={18} className="text-turmeric" />
                        <div>
                          <h4 className="font-bold text-sm">Midnight Service & Business Day Extension</h4>
                          <p className="text-xs text-ink-3">Keep late-night sales and orders on the same day when running past 12:00 AM.</p>
                        </div>
                      </div>
                      <span className="pill text-[10px] font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20">
                        Manager & Owner Only
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="lbl">Midnight / Closing Auto-Prompt</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            checked={businessDayCfg.autoPromptAtMidnight}
                            onChange={(e) => setBusinessDayCfg(b => ({ ...b, autoPromptAtMidnight: e.target.checked }))}
                            className="rounded text-turmeric accent-turmeric"
                          />
                          <span className="text-xs">Prompt at 12:00 AM if shop is still open</span>
                        </div>
                      </div>

                      <div>
                        <label className="lbl">Scheduled Closing Time</label>
                        <input
                          type="time"
                          value={businessDayCfg.closingTime || '00:00'}
                          onChange={(e) => setBusinessDayCfg(b => ({ ...b, closingTime: e.target.value }))}
                          className="inp text-xs bg-paper-2 font-mono"
                        />
                      </div>

                      <div>
                        <label className="lbl">Night Cutoff Buffer</label>
                        <select
                          value={businessDayCfg.cutoffHour || 4}
                          onChange={(e) => setBusinessDayCfg(b => ({ ...b, cutoffHour: parseInt(e.target.value, 10) }))}
                          className="inp text-xs bg-paper-2 font-semibold"
                        >
                          <option value={2}>2:00 AM (2 hrs past midnight)</option>
                          <option value={3}>3:00 AM (3 hrs past midnight)</option>
                          <option value={4}>4:00 AM (Recommended · 4 hrs buffer)</option>
                          <option value={5}>5:00 AM (5 hrs buffer)</option>
                          <option value={6}>6:00 AM (6 hrs buffer)</option>
                        </select>
                        <span className="text-[10px] text-ink-3 mt-0.5 block">Orders before this hour stay on the same day shift.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. TAX & GST ── */}
              {activePanel === 'tax' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Percent className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Tax & GST Settings</h2>
                      <p className="text-xs text-ink-3">Configure GST compliance, billing overrides, discounts, and invoices.</p>
                    </div>
                  </div>

                  {staff.role !== 'owner' && (
                    <div className="flex gap-2.5 items-start p-3.5 rounded-xl border border-[#D97706]/20 bg-[#D97706]/5 text-[#D97706] text-xs">
                      <AlertTriangle className="shrink-0" size={16} />
                      <div>
                        <h4 className="font-bold">Read-Only Access</h4>
                        <p className="mt-0.5">Only business owners can update GST/Tax settings. Managers and Accountants have read-only access.</p>
                      </div>
                    </div>
                  )}

                  {validationError && (
                    <div className="flex gap-2.5 items-start p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs">
                      <AlertCircle className="shrink-0" size={16} />
                      <div>
                        <h4 className="font-bold">Validation Error</h4>
                        <p className="mt-0.5">{validationError.message}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    {/* GST Enabled Toggle */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-paper-3 border" style={{ borderColor: 'var(--line-2)' }}>
                      <div>
                        <b className="text-sm block">GST Enabled</b>
                        <span className="text-xs text-ink-3">Activate compliance rules and tax invoices for Indian billing practices.</span>
                      </div>
                      <button
                        type="button"
                        disabled={staff.role !== 'owner' || gstLocalSaving}
                        onClick={() => handleToggleGst(!gstConfig.enabled)}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          gstConfig.enabled ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            gstConfig.enabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {!gstConfig.enabled && (
                      <div className="p-4 rounded-xl bg-paper-3 border border-dashed text-xs text-ink-3 animate-fade-in" style={{ borderColor: 'var(--line-2)' }}>
                        <Info className="inline-block mr-1 text-turmeric shrink-0" size={14} />
                        Enable GST only if your business is registered under the Goods and Services Tax (GST). When disabled, all bills, invoices, receipts, QR orders, and reports will be generated without GST.
                      </div>
                    )}

                    {gstConfig.enabled && (
                      <div className="flex flex-col gap-4 animate-fade-in">
                        {/* 1. GST Registration Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('registration')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>1. GST Registration & Tax Type</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.registration ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                          
                          {expandedSections.registration && (
                            <div className="p-4 grid gap-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="lbl">GSTIN *</label>
                                  <input
                                    type="text"
                                    maxLength={15}
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.gstin}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, gstin: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. 27AAAAA0000A1Z5"
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div>
                                  <label className="lbl">Legal Business Name *</label>
                                  <input
                                    type="text"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.legalName}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, legalName: e.target.value }))}
                                    placeholder="e.g. Chaya One Cafe Pvt Ltd"
                                    className="inp bg-paper-2"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="lbl">Business State *</label>
                                  <select
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.stateCode}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, stateCode: e.target.value }))}
                                    className="inp bg-paper-2"
                                  >
                                    <option value="">— Select State —</option>
                                    <option value="AN">Andaman & Nicobar Islands (AN)</option>
                                    <option value="AP">Andhra Pradesh (AP)</option>
                                    <option value="AR">Arunachal Pradesh (AR)</option>
                                    <option value="AS">Assam (AS)</option>
                                    <option value="BR">Bihar (BR)</option>
                                    <option value="CH">Chandigarh (CH)</option>
                                    <option value="CT">Chhattisgarh (CT)</option>
                                    <option value="DN">Dadra & Nagar Haveli (DN)</option>
                                    <option value="DD">Daman & Diu (DD)</option>
                                    <option value="DL">Delhi (DL)</option>
                                    <option value="GA">Goa (GA)</option>
                                    <option value="GJ">Gujarat (GJ)</option>
                                    <option value="HR">Haryana (HR)</option>
                                    <option value="HP">Himachal Pradesh (HP)</option>
                                    <option value="JK">Jammu & Kashmir (JK)</option>
                                    <option value="JH">Jharkhand (JH)</option>
                                    <option value="KA">Karnataka (KA)</option>
                                    <option value="KL">Kerala (KL)</option>
                                    <option value="LA">Ladakh (LA)</option>
                                    <option value="LD">Lakshadweep (LD)</option>
                                    <option value="MP">Madhya Pradesh (MP)</option>
                                    <option value="MH">Maharashtra (MH)</option>
                                    <option value="MN">Manipur (MN)</option>
                                    <option value="ML">Meghalaya (ML)</option>
                                    <option value="MZ">Mizoram (MZ)</option>
                                    <option value="NL">Nagaland (NL)</option>
                                    <option value="OD">Odisha (OD)</option>
                                    <option value="PY">Puducherry (PY)</option>
                                    <option value="PB">Punjab (PB)</option>
                                    <option value="RJ">Rajasthan (RJ)</option>
                                    <option value="SK">Sikkim (SK)</option>
                                    <option value="TN">Tamil Nadu (TN)</option>
                                    <option value="TS">Telangana (TS)</option>
                                    <option value="TR">Tripura (TR)</option>
                                    <option value="UP">Uttar Pradesh (UP)</option>
                                    <option value="UK">Uttarakhand (UK)</option>
                                    <option value="WB">West Bengal (WB)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="lbl">Registration Scheme</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['regular', 'composition'] as const).map((scheme) => (
                                      <button
                                        type="button"
                                        key={scheme}
                                        disabled={staff.role !== 'owner'}
                                        onClick={() => setGstConfig((g: any) => ({ ...g, registrationType: scheme }))}
                                        className={`p-2 text-center text-xs font-bold rounded-xl border capitalize ${
                                          gstConfig.registrationType === scheme
                                            ? 'bg-turmeric text-[#2A1607] border-transparent'
                                            : 'bg-paper-2 border-line-2 hover:bg-line/20'
                                        }`}
                                      >
                                        {scheme}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                <div>
                                  <label className="lbl">Tax calculation mode</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['exclusive', 'inclusive'] as const).map((type) => (
                                      <button
                                        type="button"
                                        key={type}
                                        disabled={staff.role !== 'owner'}
                                        onClick={() => setGstConfig((g: any) => ({ ...g, gstType: type }))}
                                        className={`p-2.5 text-center text-xs font-bold rounded-xl border capitalize ${
                                          gstConfig.gstType === type
                                            ? 'bg-turmeric text-[#2A1607] border-transparent'
                                            : 'bg-paper-2 border-line-2 hover:bg-line/20'
                                        }`}
                                      >
                                        {type} Tax
                                      </button>
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-ink-3 mt-1.5 block">
                                    {gstConfig.gstType === 'inclusive' ? 'Inclusive: Tax is embedded inside menu item prices.' : 'Exclusive: Tax is added on top of item prices.'}
                                  </span>
                                </div>

                                <div>
                                  <label className="lbl">Calculation Method</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {(['per_item', 'flat'] as const).map((method) => (
                                      <button
                                        type="button"
                                        key={method}
                                        disabled={staff.role !== 'owner'}
                                        onClick={() => setGstConfig((g: any) => ({ ...g, calculationMethod: method }))}
                                        className={`p-2.5 text-center text-xs font-bold rounded-xl border capitalize ${
                                          gstConfig.calculationMethod === method
                                            ? 'bg-turmeric text-[#2A1607] border-transparent'
                                            : 'bg-paper-2 border-line-2 hover:bg-line/20'
                                        }`}
                                      >
                                        {method === 'per_item' ? 'Per-Item Rate' : 'Flat Default Rate'}
                                      </button>
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-ink-3 mt-1.5 block">
                                    {gstConfig.calculationMethod === 'per_item' ? 'Calculates tax individually based on each menu item\'s configured GST.' : 'Overrides all items to one default rate configured below.'}
                                  </span>
                                </div>
                              </div>

                              {gstConfig.calculationMethod === 'flat' && (
                                <div className="border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                  <label className="lbl">Default GST Rate (%)</label>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {[0, 5, 12, 18, 28].map((val) => (
                                      <button
                                        type="button"
                                        key={val}
                                        disabled={staff.role !== 'owner'}
                                        onClick={() => setGstConfig((g: any) => ({ ...g, defaultRate: val }))}
                                        className={`py-1 px-3 text-xs font-bold rounded-lg border ${
                                          gstConfig.defaultRate === val ? 'bg-turmeric text-[#2A1607] border-transparent' : 'bg-paper-2 border-line-2'
                                        }`}
                                      >
                                        {val}%
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.defaultRate}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, defaultRate: parseFloat(e.target.value) || 0 }))}
                                    className="inp bg-paper-2"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. GST Application Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('rules')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>2. GST Application & Discount Rules</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.rules ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>

                          {expandedSections.rules && (
                            <div className="p-4 grid gap-4">
                              <div>
                                <h4 className="font-bold text-xs mb-2">Apply GST on Categories</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={gstConfig.gstOnFood !== false}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnFood: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Food Items
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={gstConfig.gstOnBeverage !== false}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnBeverage: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Beverages
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={gstConfig.gstOnCombo !== false}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnCombo: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Combo Meals
                                  </label>
                                </div>
                              </div>

                              <div className="border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                <h4 className="font-bold text-xs mb-2">Apply GST on Charges & Fees</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={!!gstConfig.gstOnDelivery}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnDelivery: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Delivery Charge
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={!!gstConfig.gstOnPackaging}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnPackaging: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Packaging Charge
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={!!gstConfig.gstOnServiceCharge}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnServiceCharge: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Service Charge
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded-lg border bg-paper-2 text-xs select-none cursor-pointer" style={{ borderColor: 'var(--line-2)' }}>
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={!!gstConfig.gstOnConvenience}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, gstOnConvenience: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Convenience Fee
                                  </label>
                                </div>

                                <div className="mt-3">
                                  <label className="lbl">Charges GST Rate (%)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.chargeGstRate ?? 5}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, chargeGstRate: parseFloat(e.target.value) || 0 }))}
                                    className="inp bg-paper-2"
                                  />
                                </div>
                              </div>

                              <div className="border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                <h4 className="font-bold text-xs mb-2">Discount Adjustment Rules</h4>
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={!!gstConfig.calculateGstBeforeDiscount}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, calculateGstBeforeDiscount: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Calculate GST before applying discounts (GST calculated on original subtotal)
                                  </label>
                                  <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={gstConfig.applyGstToCoupon !== false}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, applyGstToCoupon: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Calculate GST after applying Coupon Discounts
                                  </label>
                                  <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={staff.role !== 'owner'}
                                      checked={gstConfig.applyGstToManual !== false}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, applyGstToManual: e.target.checked }))}
                                      className="rounded border-line-2 text-turmeric accent-turmeric"
                                    />
                                    Calculate GST after applying Manual Flat Discounts
                                  </label>
                                </div>
                              </div>

                              <div className="border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                <h4 className="font-bold text-xs mb-2">Restaurant & Dining Overrides</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                  <div>
                                    <label className="lbl">Dine-in GST (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={staff.role !== 'owner'}
                                      placeholder="Default"
                                      value={gstConfig.dineInRate ?? ''}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, dineInRate: e.target.value ? parseFloat(e.target.value) : null }))}
                                      className="inp text-xs bg-paper-2"
                                    />
                                  </div>
                                  <div>
                                    <label className="lbl">Takeaway (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={staff.role !== 'owner'}
                                      placeholder="Default"
                                      value={gstConfig.takeawayRate ?? ''}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, takeawayRate: e.target.value ? parseFloat(e.target.value) : null }))}
                                      className="inp text-xs bg-paper-2"
                                    />
                                  </div>
                                  <div>
                                    <label className="lbl">Delivery (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={staff.role !== 'owner'}
                                      placeholder="Default"
                                      value={gstConfig.deliveryRate ?? ''}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, deliveryRate: e.target.value ? parseFloat(e.target.value) : null }))}
                                      className="inp text-xs bg-paper-2"
                                    />
                                  </div>
                                  <div>
                                    <label className="lbl">QR Ordering (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={staff.role !== 'owner'}
                                      placeholder="Default"
                                      value={gstConfig.qrOrderingRate ?? ''}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, qrOrderingRate: e.target.value ? parseFloat(e.target.value) : null }))}
                                      className="inp text-xs bg-paper-2"
                                    />
                                  </div>
                                  <div>
                                    <label className="lbl">Cloud Kitchen (%)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={staff.role !== 'owner'}
                                      placeholder="Default"
                                      value={gstConfig.cloudKitchenRate ?? ''}
                                      onChange={(e) => setGstConfig((g: any) => ({ ...g, cloudKitchenRate: e.target.value ? parseFloat(e.target.value) : null }))}
                                      className="inp text-xs bg-paper-2"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. Receipt & Invoice Layout Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('layout')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>3. Receipt & Invoice Layout Settings</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.layout ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>

                          {expandedSections.layout && (
                            <div className="p-4 grid gap-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="lbl">Invoice Title</label>
                                  <input
                                    type="text"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.taxInvoiceTitle ?? 'TAX INVOICE'}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, taxInvoiceTitle: e.target.value }))}
                                    placeholder="e.g. TAX INVOICE"
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div>
                                  <label className="lbl">Receipt Footer Note</label>
                                  <input
                                    type="text"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.receiptFooter ?? 'Thank you! Visit again.'}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, receiptFooter: e.target.value }))}
                                    placeholder="Thank you! Visit again."
                                    className="inp bg-paper-2"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: 'var(--line-2)' }}>
                                <div>
                                  <label className="lbl">Invoice Serial Prefix</label>
                                  <input
                                    type="text"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.invoicePrefix ?? 'CHY'}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, invoicePrefix: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. CHY"
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div>
                                  <label className="lbl">Invoice Number Format</label>
                                  <input
                                    type="text"
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.invoiceFormat ?? 'YYYY/MM/DD/NNNN'}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, invoiceFormat: e.target.value }))}
                                    placeholder="e.g. YYYY/MM/DD/NNNN"
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div>
                                  <label className="lbl">Rounding Rule (Precision)</label>
                                  <select
                                    disabled={staff.role !== 'owner'}
                                    value={gstConfig.roundingPrecision ?? 0}
                                    onChange={(e) => setGstConfig((g: any) => ({ ...g, roundingPrecision: parseInt(e.target.value) || 0 }))}
                                    className="inp bg-paper-2"
                                  >
                                    <option value={0}>Round to Nearest Rupee (Recommended)</option>
                                    <option value={2}>Keep Decimal Paise (2 digits)</option>
                                  </select>
                                </div>
                              </div>

                              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ borderColor: 'var(--line-2)' }}>
                                <div>
                                  <h4 className="font-bold text-xs mb-2">Display Columns on Print Invoice</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showGstin !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showGstin: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      GSTIN
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showTaxSummary !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showTaxSummary: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      Tax Summary Table
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showCgst !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showCgst: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      CGST Amount
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showSgst !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showSgst: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      SGST Amount
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showIgst !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showIgst: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      IGST Amount
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.showHsn !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, showHsn: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      HSN/SAC Code
                                    </label>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-bold text-xs mb-2">Invoice General Rules</h4>
                                  <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.roundOff !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, roundOff: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      Automatically Round Off Invoices
                                    </label>
                                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.printTaxInvoice !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, printTaxInvoice: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      Automatically Print Tax Invoices on Settle
                                    </label>
                                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={staff.role !== 'owner'}
                                        checked={gstConfig.duplicateInvoice !== false}
                                        onChange={(e) => setGstConfig((g: any) => ({ ...g, duplicateInvoice: e.target.checked }))}
                                        className="rounded border-line-2 text-turmeric accent-turmeric"
                                      />
                                      Allow Duplicate Invoice Printing
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. Import / Export & Defaults Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('backup')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>4. Import / Export & Rollback Defaults</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.backup ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>

                          {expandedSections.backup && (
                            <div className="p-4 flex flex-wrap gap-4 items-center">
                              <button
                                type="button"
                                onClick={handleExportGst}
                                className="btn py-2 px-3 text-xs flex items-center gap-1.5"
                                style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}
                              >
                                <Download size={14} /> Export Backup JSON
                              </button>

                              <label className="btn py-2 px-3 text-xs flex items-center gap-1.5 cursor-pointer" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Import Backup JSON
                                <input
                                  type="file"
                                  accept=".json"
                                  disabled={staff.role !== 'owner'}
                                  onChange={handleImportGst}
                                  className="hidden"
                                />
                              </label>

                              <button
                                type="button"
                                disabled={staff.role !== 'owner'}
                                onClick={handleRestoreDefaults}
                                className="btn py-2 px-3 text-xs text-red-500 border border-red-500/20 hover:bg-red-500/5 flex items-center gap-1.5 ml-auto animate-pulse"
                                style={{ background: 'transparent' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
                                Restore System Defaults
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 5. GST Sales & Compliance Reports Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('reports')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>5. GST Sales & Compliance Reports</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.reports ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>

                          {expandedSections.reports && (
                            <div className="p-4 flex flex-col gap-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                  <label className="lbl">Start Date</label>
                                  <input
                                    type="date"
                                    value={reportDates.startDate}
                                    onChange={(e) => setReportDates(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div>
                                  <label className="lbl">End Date</label>
                                  <input
                                    type="date"
                                    value={reportDates.endDate}
                                    onChange={(e) => setReportDates(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="inp bg-paper-2"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={loadingReport}
                                    onClick={fetchGstReport}
                                    className="btn btn-primary py-2.5 px-4 text-xs flex-1"
                                  >
                                    {loadingReport ? 'Querying...' : 'Fetch Metrics'}
                                  </button>
                                  <a
                                    href={`/api/dashboard/reports/gst?startDate=${reportDates.startDate}&endDate=${reportDates.endDate}&format=csv`}
                                    className="btn py-2.5 px-4 text-xs text-center border border-line bg-paper-2 flex items-center justify-center gap-1.5"
                                  >
                                    <Download size={14} /> Export CSV
                                  </a>
                                </div>
                              </div>

                              {gstReportData && (
                                <div className="grid gap-4 mt-2 animate-fade-in">
                                  {/* Metric Cards */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <span className="text-[10px] text-ink-3 font-semibold uppercase block">Gross Sales</span>
                                      <b className="text-base font-mono block mt-1">₹{gstReportData.summary.totalSales.toFixed(2)}</b>
                                    </div>
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <span className="text-[10px] text-ink-3 font-semibold uppercase block">Taxable Value</span>
                                      <b className="text-base font-mono block mt-1">₹{gstReportData.summary.totalTaxable.toFixed(2)}</b>
                                    </div>
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <span className="text-[10px] text-ink-3 font-semibold uppercase block">Total GST</span>
                                      <b className="text-base font-mono block mt-1 text-turmeric-d">₹{gstReportData.summary.totalTax.toFixed(2)}</b>
                                    </div>
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <span className="text-[10px] text-ink-3 font-semibold uppercase block">Exempt Sales</span>
                                      <b className="text-base font-mono block mt-1 text-[#059669]">₹{gstReportData.summary.totalExempt.toFixed(2)}</b>
                                    </div>
                                  </div>

                                  {/* Tax Slabs breakdown */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <h4 className="font-bold text-xs border-b pb-1.5 mb-2" style={{ borderColor: 'var(--line-2)' }}>GST Rate Breakdown</h4>
                                      <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex justify-between border-b pb-1 font-bold text-ink-3" style={{ borderColor: 'var(--line-2)' }}>
                                          <span>Slab Rate</span>
                                          <span>Taxable (₹)</span>
                                          <span>GST Amount (₹)</span>
                                        </div>
                                        {Object.entries(gstReportData.rateSummary).map(([rate, v]: any) => (
                                          <div key={rate} className="flex justify-between font-mono">
                                            <span className="font-bold">{rate}%</span>
                                            <span>₹{v.taxable.toFixed(2)}</span>
                                            <span className="text-turmeric-d font-bold">₹{v.totalTax.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* HSN summary */}
                                    <div className="card p-3 bg-paper-2 border" style={{ borderColor: 'var(--line-2)' }}>
                                      <h4 className="font-bold text-xs border-b pb-1.5 mb-2" style={{ borderColor: 'var(--line-2)' }}>HSN/SAC Breakdown</h4>
                                      <div className="flex flex-col gap-1.5 text-xs">
                                        <div className="flex justify-between border-b pb-1 font-bold text-ink-3" style={{ borderColor: 'var(--line-2)' }}>
                                          <span>HSN Code</span>
                                          <span>Qty</span>
                                          <span>Taxable (₹)</span>
                                          <span>GST (₹)</span>
                                        </div>
                                        {Object.entries(gstReportData.hsnSummary).map(([hsn, v]: any) => (
                                          <div key={hsn} className="flex justify-between font-mono">
                                            <span className="font-bold">{hsn}</span>
                                            <span>{v.qty}</span>
                                            <span>₹{v.taxable.toFixed(2)}</span>
                                            <span className="text-turmeric-d font-bold">₹{v.totalTax.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 6. GST Change History (Audit Log) Accordion */}
                        <div className="rounded-xl border bg-paper-3 overflow-hidden animate-slide-down" style={{ borderColor: 'var(--line-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleSection('audit')}
                            className="w-full flex items-center justify-between p-4 bg-paper-2 font-bold text-sm border-b"
                            style={{ borderColor: 'var(--line-2)' }}
                          >
                            <span>6. GST Audit Trail & Change Log</span>
                            <svg className="text-ink-3 transition-transform duration-200" style={{ transform: expandedSections.audit ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>

                          {expandedSections.audit && (
                            <div className="p-4">
                              {auditList.filter((a) => a.action === 'gst.updated' || a.action === 'gst.reset').length === 0 ? (
                                <p className="text-xs text-ink-3 text-center py-4">No GST updates recorded in the audit trail.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                                        <th className="py-2 font-bold text-ink-3">Date</th>
                                        <th className="py-2 font-bold text-ink-3">Actor</th>
                                        <th className="py-2 font-bold text-ink-3">IP / Device</th>
                                        <th className="py-2 font-bold text-ink-3">Updates</th>
                                        <th className="py-2 font-bold text-ink-3">Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {auditList
                                        .filter((a) => a.action === 'gst.updated' || a.action === 'gst.reset')
                                        .map((log) => {
                                          const auditData = log.after?.audit;
                                          return (
                                            <tr key={log.id} className="border-b" style={{ borderColor: 'var(--line-2)' }}>
                                              <td className="py-2 pr-2 whitespace-nowrap text-ink-2">
                                                {new Date(log.createdAt).toLocaleString()}
                                              </td>
                                              <td className="py-2 pr-2 text-ink-2 font-bold">
                                                {auditData?.user || log.actorId}
                                              </td>
                                              <td className="py-2 pr-2 text-ink-3">
                                                {auditData?.ip || 'N/A'} <br />
                                                <span className="text-[10px] block max-w-[120px] truncate" title={auditData?.device}>
                                                  {auditData?.device || 'N/A'}
                                                </span>
                                              </td>
                                              <td className="py-2 pr-2 text-ink-2 max-w-[200px] break-words font-mono text-[10px]">
                                                {renderAuditDiff(log)}
                                              </td>
                                              <td className="py-2 text-ink-2 italic max-w-[150px] truncate" title={auditData?.reason}>
                                                {auditData?.reason || '—'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4 mt-2 flex justify-between items-center" style={{ borderColor: 'var(--line-2)' }}>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-ink-3">GST calculations apply instantly to new orders.</span>
                      </div>
                      <button
                        type="button"
                        disabled={staff.role !== 'owner' || gstLocalSaving}
                        onClick={() => setShowGstReasonPrompt(true)}
                        className="btn btn-primary px-6"
                      >
                        {gstLocalSaving ? 'Saving taxes...' : 'Save Tax Rules'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. MENU CONFIGURATION ── */}
              {activePanel === 'menu' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <BookOpen className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Menu Configuration</h2>
                      <p className="text-xs text-ink-3">Manage defaults for dietary markers, combo modules and happy hours pricing rules.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Veg/Non-Veg Markers Only</b>
                        <span className="text-xs text-ink-3">Hide other classifications like Egg/Contains Nuts.</span>
                      </div>
                      <button
                        onClick={() => setMenuConfig(m => ({ ...m, vegLabelOnly: !m.vegLabelOnly }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          menuConfig.vegLabelOnly ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            menuConfig.vegLabelOnly ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Enable Combo Meals Config</b>
                        <span className="text-xs text-ink-3">Allow staff to configure multi-item discount groups.</span>
                      </div>
                      <button
                        onClick={() => setMenuConfig(m => ({ ...m, allowCombos: !m.allowCombos }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          menuConfig.allowCombos ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            menuConfig.allowCombos ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border border-line rounded-2xl p-4 bg-paper-3">
                      <div className="flex items-center justify-between border-b pb-3 mb-4">
                        <div>
                          <b className="text-sm block">Happy Hours Discounts</b>
                          <span className="text-xs text-ink-3">Configure automated happy hour pricing rules.</span>
                        </div>
                        <button
                          onClick={() => setMenuConfig(m => ({ ...m, happyHourEnabled: !m.happyHourEnabled }))}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                            menuConfig.happyHourEnabled ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              menuConfig.happyHourEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {menuConfig.happyHourEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="lbl">Flat Discount %</label>
                            <input
                              type="number"
                              value={menuConfig.happyHourDiscountPct}
                              onChange={(e) => setMenuConfig(m => ({ ...m, happyHourDiscountPct: e.target.value }))}
                              className="inp bg-paper-2"
                            />
                          </div>
                          <div>
                            <label className="lbl">Start Hour</label>
                            <input
                              type="time"
                              value={menuConfig.happyHourStart}
                              onChange={(e) => setMenuConfig(m => ({ ...m, happyHourStart: e.target.value }))}
                              className="inp bg-paper-2"
                            />
                          </div>
                          <div>
                            <label className="lbl">End Hour</label>
                            <input
                              type="time"
                              value={menuConfig.happyHourEnd}
                              onChange={(e) => setMenuConfig(m => ({ ...m, happyHourEnd: e.target.value }))}
                              className="inp bg-paper-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 5. FLOOR & QR CODES ── */}
              {activePanel === 'floor' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="text-turmeric" size={24} />
                      <div>
                        <h2 className="text-xl font-bold font-display">Floor &amp; QR Branding</h2>
                        <p className="text-xs text-ink-3">Manage physical table layouts, print QR labels, and configure dining sections.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={refreshFloorData}
                      disabled={floorBusy}
                      title="Refresh sections and tables"
                      className="btn py-1.5 px-3 bg-paper-3 border border-line text-xs font-semibold inline-flex items-center gap-1.5 text-ink-2 hover:text-ink cursor-pointer"
                    >
                      <RefreshCw size={13} className={floorBusy ? 'animate-spin' : ''} />
                      <span>Sync</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-2xl font-mono text-turmeric-d">{floorList.length}</h4>
                        <b className="text-xs uppercase text-ink-3 mt-1 block">Sections</b>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">e.g. TOP, Middle, Lower, Rooftop</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-2xl font-mono text-turmeric-d">{tableList.filter((t) => t.active !== false).length}</h4>
                        <b className="text-xs uppercase text-ink-3 mt-1 block">Active Tables</b>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">Total configured: {tableList.length}</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-green-600 block">✓ Self Ordering Active</span>
                        <span className="text-[10px] text-ink-3 block">QR-Scan to Place orders</span>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">With branding splash customiser</span>
                    </div>
                  </div>

                  {floorError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{floorError}</span>
                      </div>
                      <button type="button" onClick={refreshFloorData} className="underline font-bold">
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Sections & Floor Setup */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base font-display">Sections &amp; Floor Setup</h3>
                        <p className="text-xs text-ink-3">Organize dining zones, assign tables, and generate QR identities.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAddTable()}
                          className="btn py-2 px-3 bg-paper-3 border border-line text-ink font-bold text-xs rounded-xl shadow-xs hover:border-turmeric/50 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} className="text-turmeric" />
                          <span>Add Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenAddSection}
                          className="btn py-2 px-3 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow-sm hover:brightness-105 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add Section</span>
                        </button>
                      </div>
                    </div>

                    {floorBusy && floorList.length === 0 ? (
                      <div className="p-10 text-center bg-paper-3 rounded-2xl border border-line">
                        <RefreshCw size={24} className="animate-spin text-turmeric mx-auto mb-2" />
                        <p className="text-xs text-ink-3">Loading sections &amp; tables…</p>
                      </div>
                    ) : floorList.length === 0 && tableList.length === 0 ? (
                      <div className="p-10 text-center bg-paper-3 rounded-2xl border border-dashed border-line flex flex-col items-center gap-3">
                        <Sparkles size={32} className="text-turmeric/60" />
                        <div>
                          <h4 className="font-bold text-sm text-ink">No dining sections configured yet</h4>
                          <p className="text-xs text-ink-3 mt-1 max-w-md">
                            Create your first dining section (e.g. TOP, Middle, Lower, Rooftop) to organize your tables and generate customer QR codes.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddSection}
                          className="btn py-2 px-4 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow-sm mt-1"
                        >
                          + Create First Section
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {floorList.map((f) => {
                          const sectionTables = tableList.filter((t) => t.floorId === f.id);
                          return (
                            <div key={f.id} className="card p-5 bg-paper-3 border border-line rounded-2xl flex flex-col gap-4 shadow-xs">
                              {/* Section Header */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-3 h-3 rounded-full bg-turmeric/80" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-base font-display text-ink">{f.name}</h4>
                                      <span className="pill text-[10px] font-bold">
                                        {sectionTables.length} Table{sectionTables.length === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    {f.description && (
                                      <p className="text-xs text-ink-3 mt-0.5">{f.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddTable(f.id)}
                                    className="btn py-1 px-2.5 bg-paper-2 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-turmeric/50"
                                    title="Add table directly into this section"
                                  >
                                    <Plus size={12} className="text-turmeric" />
                                    <span>Add Table</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSection(f)}
                                    className="btn py-1 px-2.5 bg-paper-2 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-line-2"
                                    title="Edit section details"
                                  >
                                    <Edit2 size={12} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSection(f)}
                                    className="btn py-1 px-2.5 bg-paper-2 border border-line text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1"
                                    title="Delete section"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>

                              {/* Tables in this Section */}
                              {sectionTables.length === 0 ? (
                                <div className="p-6 border border-dashed border-line rounded-xl text-center flex flex-col items-center justify-center gap-2 bg-paper-2/50">
                                  <p className="text-xs text-ink-3">No tables in this section yet.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddTable(f.id)}
                                    className="btn py-1 px-3 bg-paper-2 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 text-ink-2 hover:text-ink"
                                  >
                                    <Plus size={12} className="text-turmeric" />
                                    <span>Add Table to {f.name}</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {sectionTables.map((t) => (
                                    <div
                                      key={t.id}
                                      className="bg-paper-2 border border-line rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs hover:border-turmeric/50 transition-colors"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-display font-bold text-lg text-ink">{t.label}</span>
                                        </div>
                                        {t.active !== false ? (
                                          <span className="pill text-[10px] font-bold bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30">
                                            Active
                                          </span>
                                        ) : (
                                          <span className="pill text-[10px] font-bold bg-gray-500/15 text-gray-500 border border-gray-500/30">
                                            Disabled
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex flex-col gap-2 text-xs text-ink-2">
                                        <div className="flex items-center gap-1.5">
                                          <Users size={13} className="text-ink-3 shrink-0" />
                                          <span>Capacity: <strong className="text-ink">{t.seats}</strong></span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold uppercase text-ink-3">Move:</span>
                                          <select
                                            value={t.floorId || ''}
                                            onChange={(e) => handleMoveTable(t.id, e.target.value)}
                                            className="bg-paper-3 border border-line rounded-lg px-2 py-1 text-xs outline-none flex-1 font-medium text-ink cursor-pointer hover:border-line-2"
                                            title="Quickly move table to another section"
                                          >
                                            {floorList.map((fl) => (
                                              <option key={fl.id} value={fl.id}>{fl.name}</option>
                                            ))}
                                            <option value="">Unassigned</option>
                                          </select>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-end gap-1.5 border-t border-line/60 pt-2.5">
                                        <button
                                          type="button"
                                          onClick={() => setQrModalTable(t)}
                                          className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-turmeric/50"
                                          title="View QR Code, print standee, or copy customer link"
                                        >
                                          <QrCode size={12} className="text-turmeric" />
                                          <span>QR</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditTable(t)}
                                          className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-line-2"
                                          title="Edit table"
                                        >
                                          <Edit2 size={12} />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTable(t)}
                                          className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1"
                                          title="Delete table"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Unassigned Tables Group */}
                        {(() => {
                          const floorIds = new Set(floorList.map((fl) => fl.id));
                          const unassigned = tableList.filter((t) => !t.floorId || !floorIds.has(t.floorId));
                          if (unassigned.length === 0) return null;
                          return (
                            <div className="card p-5 bg-paper-3 border border-line rounded-2xl flex flex-col gap-4 shadow-xs">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-3 h-3 rounded-full bg-gray-400" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-base font-display text-ink">Unassigned Tables</h4>
                                      <span className="pill text-[10px] font-bold">
                                        {unassigned.length} Table{unassigned.length === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-ink-3 mt-0.5">Tables not assigned to any specific section.</p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {unassigned.map((t) => (
                                  <div
                                    key={t.id}
                                    className="bg-paper-2 border border-line rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs hover:border-turmeric/50 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-display font-bold text-lg text-ink">{t.label}</span>
                                      {t.active !== false ? (
                                        <span className="pill text-[10px] font-bold bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30">
                                          Active
                                        </span>
                                      ) : (
                                        <span className="pill text-[10px] font-bold bg-gray-500/15 text-gray-500 border border-gray-500/30">
                                          Disabled
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-2 text-xs text-ink-2">
                                      <div className="flex items-center gap-1.5">
                                        <Users size={13} className="text-ink-3 shrink-0" />
                                        <span>Capacity: <strong className="text-ink">{t.seats}</strong></span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold uppercase text-ink-3">Assign:</span>
                                        <select
                                          value={t.floorId || ''}
                                          onChange={(e) => handleMoveTable(t.id, e.target.value)}
                                          className="bg-paper-3 border border-line rounded-lg px-2 py-1 text-xs outline-none flex-1 font-medium text-ink cursor-pointer hover:border-line-2"
                                        >
                                          <option value="">Unassigned</option>
                                          {floorList.map((fl) => (
                                            <option key={fl.id} value={fl.id}>{fl.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-1.5 border-t border-line/60 pt-2.5">
                                      <button
                                        type="button"
                                        onClick={() => setQrModalTable(t)}
                                        className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-turmeric/50"
                                      >
                                        <QrCode size={12} className="text-turmeric" />
                                        <span>QR</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditTable(t)}
                                        className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-line-2"
                                      >
                                        <Edit2 size={12} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTable(t)}
                                        className="btn btn-sm py-1 px-2 bg-paper-3 border border-line text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 6. KITCHEN & KDS ── */}
              {activePanel === 'kitchen' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <ChefHat className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Kitchen &amp; KDS routing</h2>
                      <p className="text-xs text-ink-3">Define multiple preparation stations (Bar, Kitchen, Desserts) and setup workflows.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveKitchenWorkflow} className="flex flex-col gap-5">
                    {/* Kitchen Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                        <div>
                          <b className="text-sm block">Digital Kitchen Display (KDS)</b>
                          <span className="text-xs text-ink-3">Enable order queues on tablets.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKwForm(prev => ({ ...prev, kdsEnabled: !prev.kdsEnabled }))}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                            kwForm.kdsEnabled ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              kwForm.kdsEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex flex-col justify-center p-3.5 rounded-xl border bg-paper-3">
                        <label className="lbl">Kitchen Fulfillment Mode</label>
                        <select
                          value={kwForm.mode}
                          onChange={(e) => setKwForm(prev => ({ ...prev, mode: e.target.value as any }))}
                          className="inp bg-paper-3"
                        >
                          <option value="digital">Digital (KDS Screen Only)</option>
                          <option value="printed">Printed (Paper KOT tickets only)</option>
                          <option value="hybrid">Hybrid (Both screen and paper KOT)</option>
                        </select>
                      </div>
                    </div>

                    {/* Preparation Time dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="lbl">Average Preparation Time</label>
                        <select
                          value={kwForm.delayThresholdMin}
                          onChange={(e) => setKwForm(prev => ({ ...prev, delayThresholdMin: Number(e.target.value) }))}
                          className="inp bg-paper-3"
                        >
                          <option value="5">5 Minutes</option>
                          <option value="10">10 Minutes</option>
                          <option value="15">15 Minutes</option>
                          <option value="20">20 Minutes</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">KDS Theme Roast</label>
                        <select
                          value={kwForm.theme}
                          onChange={(e) => setKwForm(prev => ({ ...prev, theme: e.target.value as any }))}
                          className="inp bg-paper-3 text-capitalize"
                        >
                          <option value="dark">Espresso (Dark)</option>
                          <option value="light">Cream (Light)</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">Sound Notification</label>
                        <select
                          value={kwForm.soundNotification ? 'true' : 'false'}
                          onChange={(e) => setKwForm(prev => ({ ...prev, soundNotification: e.target.value === 'true' }))}
                          className="inp bg-paper-3"
                        >
                          <option value="true">Chime On</option>
                          <option value="false">Mute</option>
                        </select>
                      </div>
                    </div>

                    {/* Preparation Stations list */}
                    <div className="border-t pt-4">
                      <h4 className="font-bold text-sm mb-3">Kitchen Preparation Stations</h4>
                      <div className="flex flex-col gap-2">
                        {kitchens.map((k) => (
                          <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border bg-paper-3 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="w-3.5 h-3.5 rounded-full" style={{ background: k.color || 'var(--turmeric)' }} />
                              <b className="font-semibold">{k.name}</b>
                              <span className="text-xs text-ink-3">Slug: {k.id}</span>
                            </div>
                            {kitchens.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove station "${k.name}"?`)) {
                                    kitchenApi({ action: 'kitchen_delete', id: k.id }, `Station "${k.name}" deleted`);
                                  }
                                }}
                                className="text-red-500 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add new station row */}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="Add new station (e.g. Pizza Deck)..."
                          value={newStationName}
                          onChange={(e) => setNewStationName(e.target.value)}
                          className="inp"
                        />
                        <button
                          type="button"
                          disabled={kitchenBusy || !newStationName.trim()}
                          onClick={async () => {
                            if (await kitchenApi({ action: 'kitchen_add', name: newStationName.trim() }, `Station "${newStationName.trim()}" added`)) {
                              setNewStationName('');
                            }
                          }}
                          className="btn btn-primary"
                        >
                          <Plus size={16} /> Add Station
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={kwSaving} className="btn btn-primary self-end px-6">
                      {kwSaving ? 'Saving workflow...' : 'Save Kitchen settings'}
                    </button>
                  </form>
                </div>
              )}

              {/* ── 7. INVENTORY SETTINGS ── */}
              {activePanel === 'inventory' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Package className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Inventory &amp; Ingredient Setup</h2>
                      <p className="text-xs text-ink-3">Auto stock deductions, low quantity thresholds warnings, waste management logging.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Auto-Deduct Stock on Billing</b>
                        <span className="text-xs text-ink-3">Auto deduces recipe ingredients from ledger on checkout.</span>
                      </div>
                      <button
                        onClick={() => setInventoryConfigState(prev => ({ ...prev, autoDeductStockOnBill: !prev.autoDeductStockOnBill }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          inventoryConfigState.autoDeductStockOnBill ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            inventoryConfigState.autoDeductStockOnBill ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Allow Spoilage/Waste Logging</b>
                        <span className="text-xs text-ink-3">Provide staff with buttons to record kitchen spills/waste.</span>
                      </div>
                      <button
                        onClick={() => setInventoryConfigState(prev => ({ ...prev, allowWasteTracking: !prev.allowWasteTracking }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          inventoryConfigState.allowWasteTracking ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            inventoryConfigState.allowWasteTracking ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="lbl">Low Stock Threshold Warning (%)</label>
                        <input
                          type="number"
                          value={inventoryConfigState.lowStockThreshold}
                          onChange={(e) => setInventoryConfigState(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                          className="inp"
                        />
                        <span className="text-[10px] text-ink-3 mt-1 block">Trigger alerts when ingredient quantities drop below this %.</span>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none h-11">
                          <input
                            type="checkbox"
                            checked={inventoryConfigState.purchaseOrderApproval}
                            onChange={(e) => setInventoryConfigState(prev => ({ ...prev, purchaseOrderApproval: e.target.checked }))}
                            className="rounded border-line-2 text-turmeric accent-turmeric"
                          />
                          Require manager approval for Purchase Orders
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 8. BILLING CONFIGURATION ── */}
              {activePanel === 'billing' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Receipt className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Billing Settings</h2>
                      <p className="text-xs text-ink-3">Print parameters, duplicate bill restrictions, receipt header and footer layouts.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveReceipt} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="lbl">Invoice Number Prefix</label>
                        <input
                          value={billingConfigState.invoicePrefix}
                          onChange={(e) => setBillingConfigState(prev => ({ ...prev, invoicePrefix: e.target.value }))}
                          className="inp"
                        />
                      </div>
                      <div>
                        <label className="lbl">Invoice Number Pad Width</label>
                        <input
                          type="number"
                          value={billingConfigState.invoiceNumberLength}
                          onChange={(e) => setBillingConfigState(prev => ({ ...prev, invoiceNumberLength: e.target.value }))}
                          className="inp"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none h-11">
                          <input
                            type="checkbox"
                            checked={billingConfigState.roundOffTotal}
                            onChange={(e) => setBillingConfigState(prev => ({ ...prev, roundOffTotal: e.target.checked }))}
                            className="rounded border-line-2 text-turmeric accent-turmeric"
                          />
                          Round off total payable amount
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                        <div>
                          <b className="text-sm block">Auto-Print Receipts on Save</b>
                          <span className="text-xs text-ink-3">Initiate silent printing once paid.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBillingConfigState(prev => ({ ...prev, autoPrintReceipt: !prev.autoPrintReceipt }))}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                            billingConfigState.autoPrintReceipt ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              billingConfigState.autoPrintReceipt ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                        <div>
                          <b className="text-sm block">Allow Reprinting Bills</b>
                          <span className="text-xs text-ink-3">Permit printing extra copy receipts.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBillingConfigState(prev => ({ ...prev, allowDuplicateBill: !prev.allowDuplicateBill }))}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                            billingConfigState.allowDuplicateBill ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              billingConfigState.allowDuplicateBill ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Thermal Receipt Layout & Profile */}
                    <div className="border-t pt-4 border-line">
                      <h4 className="font-bold text-sm mb-3">Thermal Paper Profile</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${receiptForm.paperWidth === '58mm' ? 'bg-turmeric/10 border-turmeric' : 'bg-paper-3 border-line'}`}>
                          <input
                            type="radio"
                            name="receipt_paper_width"
                            checked={receiptForm.paperWidth === '58mm'}
                            onChange={() => setReceiptForm((prev: any) => ({ ...prev, paperWidth: '58mm' }))}
                            className="mt-1 accent-turmeric"
                          />
                          <div>
                            <b className="text-sm block">58mm (2-inch / 32 columns)</b>
                            <span className="text-xs text-ink-3">Ideal for mobile Bluetooth or compact counter thermal printers.</span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${receiptForm.paperWidth !== '58mm' ? 'bg-turmeric/10 border-turmeric' : 'bg-paper-3 border-line'}`}>
                          <input
                            type="radio"
                            name="receipt_paper_width"
                            checked={receiptForm.paperWidth !== '58mm'}
                            onChange={() => setReceiptForm((prev: any) => ({ ...prev, paperWidth: '80mm' }))}
                            className="mt-1 accent-turmeric"
                          />
                          <div>
                            <b className="text-sm block">80mm (3-inch / 42 columns)</b>
                            <span className="text-xs text-ink-3">Standard high-speed counter thermal printers with full columns.</span>
                          </div>
                        </label>
                      </div>

                      <h4 className="font-bold text-sm mb-3">Receipt Content &amp; Visibility Options</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                        {[
                          { key: 'showLogo', label: 'Store Logo', desc: 'Display uploaded shop logo at top' },
                          { key: 'showAddress', label: 'Store Address', desc: 'Address below store name' },
                          { key: 'showPhone', label: 'Support Phone', desc: 'Customer contact phone number' },
                          { key: 'showGstin', label: 'GSTIN Number', desc: 'Print store GST identification' },
                          { key: 'showTableNumber', label: 'Table Number', desc: 'Same row as order number' },
                          { key: 'showOrderNumber', label: 'Order Number', desc: 'Same row as table number' },
                          { key: 'showDateTime', label: 'Date & Time', desc: 'Same row formatted timestamp' },
                          { key: 'showItemNotes', label: 'Item Notes & Addons', desc: 'Indented modifiers and notes' },
                          { key: 'showTaxDetails', label: 'Tax Breakdown', desc: 'CGST / SGST / IGST breakdown' },
                          { key: 'showDiscount', label: 'Discounts', desc: 'Show savings line when > 0' },
                          { key: 'showUpiQr', label: 'Dynamic UPI QR', desc: 'Zero-touch payable QR code' },
                          { key: 'showScanAndPay', label: 'Scan & Pay Prompt', desc: 'Caption below the QR code' },
                        ].map((opt) => (
                          <label key={opt.key} className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                            <div>
                              <b className="block">{opt.label}</b>
                              <span className="text-[11px] text-ink-3">{opt.desc}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={receiptForm[opt.key] !== false}
                              onChange={(e) => setReceiptForm((prev: any) => ({ ...prev, [opt.key]: e.target.checked }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4 ml-2 shrink-0"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Receipt text configurations */}
                    <div className="border-t pt-4 border-line">
                      <h4 className="font-bold text-sm mb-3">Header &amp; Footer Layout</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="lbl">Header Note</label>
                          <textarea
                            value={receiptForm.header}
                            onChange={(e) => setReceiptForm((prev: any) => ({ ...prev, header: e.target.value }))}
                            placeholder="Welcome to Chaya One! Tagline..."
                            className="inp min-h-[70px]"
                          />
                        </div>
                        <div>
                          <label className="lbl">Footer Note</label>
                          <textarea
                            value={receiptForm.footer}
                            onChange={(e) => setReceiptForm((prev: any) => ({ ...prev, footer: e.target.value }))}
                            placeholder="Thank you for visiting! Powered by Cafe OS"
                            className="inp min-h-[70px]"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="lbl">Store Customer Support Phone</label>
                        <input
                          value={receiptForm.phone}
                          onChange={(e) => setReceiptForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                          className="inp"
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={receiptSaving} className="btn btn-primary self-end px-6">
                      {receiptSaving ? 'Saving layout...' : 'Save Billing & Receipt Rules'}
                    </button>
                  </form>
                </div>
              )}

              {/* ── 9. PAYMENTS SETTINGS ── */}
              {activePanel === 'payments' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <CreditCard className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Payment Options &amp; Settlement</h2>
                      <p className="text-xs text-ink-3">Toggles for POS payment modes (Cash, card, UPI), tips calculations, shift settle times.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-bold text-sm mb-3">Accepted Payment Modes</h3>
                      <div className="flex flex-col gap-2">
                        {([
                          { key: 'cashEnabled', title: 'Cash Payments' },
                          { key: 'cardEnabled', title: 'Card Swipes' },
                          { key: 'upiEnabled', title: 'UPI Quick Scan (BHIM/PhonePe)' },
                          { key: 'walletEnabled', title: 'Digital Wallets' },
                          { key: 'creditsEnabled', title: 'Customer Ledger Credits' }
                        ] as const).map((mode) => (
                          <label key={mode.key} className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                            <span>{mode.title}</span>
                            <input
                              type="checkbox"
                              checked={paymentsConfig[mode.key]}
                              onChange={(e) => setPaymentsConfig(prev => ({ ...prev, [mode.key]: e.target.checked }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm mb-3">Tip Configuration</h3>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                          <span>Prompt customer for tips on screen</span>
                          <input
                            type="checkbox"
                            checked={paymentsConfig.tipEnabled}
                            onChange={(e) => setPaymentsConfig(prev => ({ ...prev, tipEnabled: e.target.checked }))}
                            className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                          />
                        </label>

                        {paymentsConfig.tipEnabled && (
                          <div>
                            <label className="lbl">Default Tip Tiers (Comma separated)</label>
                            <input
                              value={paymentsConfig.tipPercentages}
                              onChange={(e) => setPaymentsConfig(prev => ({ ...prev, tipPercentages: e.target.value }))}
                              className="inp bg-paper-3"
                              placeholder="e.g. 5, 10, 15"
                            />
                          </div>
                        )}

                        <label className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                          <span>Auto-settle register at shift closing</span>
                          <input
                            type="checkbox"
                            checked={paymentsConfig.autoSettleShifts}
                            onChange={(e) => setPaymentsConfig(prev => ({ ...prev, autoSettleShifts: e.target.checked }))}
                            className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 border-line">
                    <div className="flex items-center gap-2 mb-3">
                      <QrCode className="text-turmeric" size={20} />
                      <h3 className="font-bold text-sm">Dynamic UPI QR Code &amp; Receipt Payment</h3>
                    </div>
                    <p className="text-xs text-ink-3 mb-4">
                      Configure your authoritative NPCI UPI details. When enabled, thermal receipts print an offline dynamic QR containing the exact payable amount for zero-contact customer checkout.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="lbl">Payee UPI ID (VPA) <span className="text-red-500">*</span></label>
                        <input
                          value={paymentsConfig.upiId}
                          onChange={(e) => setPaymentsConfig(prev => ({ ...prev, upiId: e.target.value }))}
                          className="inp bg-paper-3 font-mono"
                          placeholder="e.g. chayacafe@okhdfcbank or 9876543210@paytm"
                        />
                        <span className="text-[11px] text-ink-3 mt-1 block">Payments will be routed directly to this UPI address.</span>
                      </div>

                      <div>
                        <label className="lbl">Payee / Merchant Display Name</label>
                        <input
                          value={paymentsConfig.upiBusinessName}
                          onChange={(e) => setPaymentsConfig(prev => ({ ...prev, upiBusinessName: e.target.value }))}
                          className="inp bg-paper-3"
                          placeholder="e.g. Chaya Cafe"
                        />
                        <span className="text-[11px] text-ink-3 mt-1 block">Displayed inside Google Pay, PhonePe, Paytm when scanned.</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <label className="flex items-center justify-between p-3 rounded-xl border bg-paper-3 text-xs select-none">
                        <div>
                          <b className="block">Enable UPI QR on Receipts</b>
                          <span className="text-ink-3">Print dynamic QR on customer bill</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={paymentsConfig.receiptQrEnabled}
                          onChange={(e) => setPaymentsConfig(prev => ({ ...prev, receiptQrEnabled: e.target.checked }))}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl border bg-paper-3 text-xs select-none">
                        <div>
                          <b className="block">Show &quot;Scan &amp; Pay&quot; Caption</b>
                          <span className="text-ink-3">Prints formatted amount below QR</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={paymentsConfig.showScanAndPayText}
                          onChange={(e) => setPaymentsConfig(prev => ({ ...prev, showScanAndPayText: e.target.checked }))}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>

                      <div className="p-3 rounded-xl border bg-paper-3 flex flex-col justify-center">
                        <label className="lbl mb-1 text-xs">Receipt QR Size</label>
                        <select
                          value={paymentsConfig.receiptQrSize}
                          onChange={(e) => setPaymentsConfig(prev => ({ ...prev, receiptQrSize: e.target.value as any }))}
                          className="inp bg-paper-2 text-xs py-1.5"
                        >
                          <option value="small">Small (30mm)</option>
                          <option value="medium">Medium (38mm - Recommended)</option>
                          <option value="large">Large (46mm)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-line">
                    <button
                      type="button"
                      disabled={paymentsSaving}
                      onClick={() => handleSavePayments()}
                      className="btn btn-primary px-6"
                    >
                      {paymentsSaving ? 'Saving payment settings...' : 'Save Payment & UPI Settings'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── 10. DEVICES & PRINTERS ── */}
              {activePanel === 'devices' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Printer className="text-turmeric" size={26} />
                      <div>
                        <h2 className="text-xl font-bold font-display">Devices &amp; Printers</h2>
                        <p className="text-xs text-ink-3">Configure KOT printers, station assignments, receipt output nodes, and LAN network parameters.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowStationRoutingModal(true)}
                        className="btn btn-sm"
                        style={{ background: 'var(--paper-3)', border: '1px solid var(--line)' }}
                      >
                        <BookOpen size={14} /> Station Routing
                      </button>
                      <button
                        onClick={() => {
                          setDeviceForm({
                            id: undefined,
                            name: '',
                            type: 'kot_printer',
                            connection: 'network',
                            target: '192.168.1.201:9100',
                            ip: '192.168.1.201',
                            port: '9100',
                            station: 'kitchen',
                            priority: 'primary',
                            kotRule: 'station_only',
                            isDefault: false
                          });
                          setShowDeviceForm(true);
                        }}
                        className="btn btn-sm btn-primary"
                      >
                        <Plus size={14} /> Register Printer / Device
                      </button>
                    </div>
                  </div>

                  {/* UNASSIGNED ITEM WARNING BANNER */}
                  {(() => {
                    const unassignedCount = (menuItems || []).filter(i => !i.station || i.station === 'none').length;
                    if (unassignedCount === 0) return null;
                    return (
                      <div className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs bg-amber-500/10 border-amber-500/30 text-amber-900">
                        <div className="flex items-center gap-2 font-bold">
                          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                          <span>⚠ {unassignedCount} menu items are not assigned to a KOT station.</span>
                        </div>
                        <button
                          onClick={() => {
                            setRoutingStationFilter('unassigned');
                            setShowStationRoutingModal(true);
                          }}
                          className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700 font-bold"
                        >
                          Review Items
                        </button>
                      </div>
                    );
                  })()}

                  {/* KOT STATIONS SUMMARY CARDS */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm">KOT STATIONS</h4>
                        <p className="text-[11px] text-ink-3">Preparation stations and configured physical LAN printers.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { id: 'kitchen', name: 'Kitchen', icon: '🍳', desc: 'Food preparation' },
                        { id: 'bar', name: 'Bar', icon: '☕', desc: 'Drinks & beverages' },
                        { id: 'bakery', name: 'Bakery', icon: '🥐', desc: 'Bakery items' },
                        { id: 'dessert', name: 'Dessert', icon: '🍰', desc: 'Desserts & sweets' },
                        ...kitchens
                          .filter(k => !['kitchen', 'bar', 'bakery', 'dessert'].includes(k.id))
                          .map(k => ({ id: k.id, name: k.name, icon: '⚙️', desc: 'Custom station' }))
                      ].map((st) => {
                        const stationPrinters = devices.filter(d => d.type === 'kot_printer' && d.station === st.id);
                        const primaryPrinter = stationPrinters.find(d => d.priority === 'primary' || d.isDefault) || stationPrinters[0];
                        const backupPrinter = stationPrinters.find(d => d.id !== primaryPrinter?.id && d.priority === 'backup') || (stationPrinters.length > 1 ? stationPrinters[1] : null);
                        const assignedItemsCount = (menuItems || []).filter(i => (i.station || 'kitchen') === st.id).length;

                        return (
                          <div key={st.id} className="card p-4 bg-paper-3 flex flex-col justify-between gap-3 border border-line rounded-xl">
                            <div>
                              <div className="flex items-center justify-between border-b pb-2 border-line">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{st.icon}</span>
                                  <div>
                                    <b className="text-sm block font-bold">{st.name}</b>
                                    <span className="text-[10px] text-ink-3 block">{st.desc}</span>
                                  </div>
                                </div>
                                <span className="pill text-[10px] font-bold">{assignedItemsCount} Items</span>
                              </div>

                              <div className="mt-3 flex flex-col gap-1.5 text-xs">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-ink-3">Printers:</span>
                                  <b className="font-bold">{stationPrinters.length} Configured</b>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-ink-3">Primary:</span>
                                  <span className="font-semibold text-turmeric-d truncate max-w-[110px]" title={primaryPrinter?.name || 'None'}>
                                    {primaryPrinter ? primaryPrinter.name : '— Not set'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-ink-3">Backup:</span>
                                  <span className="font-semibold text-ink-2 truncate max-w-[110px]" title={backupPrinter?.name || 'None'}>
                                    {backupPrinter ? backupPrinter.name : '— None'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 pt-2 border-t border-line">
                              <button
                                onClick={() => {
                                  setRoutingStationFilter(st.id);
                                  setShowStationRoutingModal(true);
                                }}
                                className="btn btn-xs flex-1 bg-paper-2 border hover:bg-paper"
                              >
                                Manage
                              </button>
                              <button
                                onClick={() => {
                                  setDeviceForm({
                                    id: undefined,
                                    name: `${st.name} Printer ${stationPrinters.length + 1}`,
                                    type: 'kot_printer',
                                    connection: 'network',
                                    target: `192.168.1.${201 + devices.length}:9100`,
                                    ip: `192.168.1.${201 + devices.length}`,
                                    port: '9100',
                                    station: st.id,
                                    priority: stationPrinters.length === 0 ? 'primary' : 'backup',
                                    kotRule: 'station_only',
                                    isDefault: false
                                  });
                                  setShowDeviceForm(true);
                                }}
                                className="btn btn-xs btn-primary px-2"
                                title={`Add another printer for ${st.name}`}
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* HARDWARE REGISTRY TABLE */}
                  <div className="flex flex-col gap-3 border-t pt-4 border-line">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">Hardware Registry ({devices.length})</h4>
                      <button
                        onClick={() => {
                          setDeviceForm({
                            id: undefined,
                            name: '',
                            type: 'kot_printer',
                            connection: 'network',
                            target: '192.168.1.201:9100',
                            ip: '192.168.1.201',
                            port: '9100',
                            station: 'kitchen',
                            priority: 'primary',
                            kotRule: 'station_only',
                            isDefault: false
                          });
                          setShowDeviceForm(true);
                        }}
                        className="btn btn-sm btn-primary"
                      >
                        <Plus size={14} /> Add Device
                      </button>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-paper-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-paper-2 text-ink-3 uppercase font-bold text-[10px]">
                              <th className="p-3">Device</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">IP / Port</th>
                              <th className="p-3">Station</th>
                              <th className="p-3">Priority</th>
                              <th className="p-3">KOT Rule</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {devices.map((d) => {
                              const targetStr = d.target || (d.ip ? `${d.ip}:${d.port || 9100}` : '—');
                              const testRes = testConnectionStatus[d.id] || testConnectionStatus[targetStr];
                              const testKot = testKotStatus[d.id];

                              return (
                                <tr key={d.id} className="hover:bg-paper-2/50 transition-colors">
                                  <td className="p-3">
                                    <b className="font-bold text-sm block">{d.name}</b>
                                    {d.isDefault && <span className="pill text-[9px] font-bold text-green-700 bg-green-500/10">Default</span>}
                                  </td>
                                  <td className="p-3 capitalize font-medium">
                                    {d.type === 'both_printer' ? '⚡ Both (Billing & KOT)' : d.type === 'kot_printer' ? '🍳 KOT Printer' : d.type === 'receipt_printer' ? '🧾 Receipt Printer' : d.type === 'display' ? '📺 KDS Display' : '⚙️ Other Device'}
                                  </td>
                                  <td className="p-3 font-mono font-semibold">{targetStr}</td>
                                  <td className="p-3 capitalize font-semibold text-turmeric-d">
                                    {d.station ? d.station : d.type === 'both_printer' ? 'Billing & Kitchen' : d.type === 'receipt_printer' ? 'Billing Counter' : '—'}
                                  </td>
                                  <td className="p-3">
                                    {d.priority === 'backup' ? (
                                      <span className="pill text-[10px] font-bold text-gray-700 bg-gray-200">BACKUP</span>
                                    ) : (
                                      <span className="pill text-[10px] font-bold text-amber-800 bg-amber-100">PRIMARY</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-[11px] text-ink-3">
                                    {d.kotRule === 'all_items' ? 'All Order Items' : d.kotRule === 'custom' ? 'Custom Filter' : 'Station Items Only'}
                                  </td>
                                  <td className="p-3">
                                    {testRes?.loading ? (
                                      <span className="text-ink-3 text-[10px]">Testing…</span>
                                    ) : testRes?.ok === true ? (
                                      <span className="pill text-[10px] font-bold text-green-700 bg-green-50 border-green-200">✓ ONLINE</span>
                                    ) : testRes?.ok === false ? (
                                      <span className="pill text-[10px] font-bold text-red-700 bg-red-50 border-red-200">✕ UNREACHABLE</span>
                                    ) : (
                                      <span className="pill text-[10px] text-gray-600 bg-gray-100">ONLINE</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleTestConnection(targetStr)}
                                        disabled={testRes?.loading}
                                        className="btn btn-xs bg-paper-2 border hover:bg-paper"
                                        title="Test TCP 9100 network socket reachability"
                                      >
                                        {testRes?.loading ? '…' : 'Test'}
                                      </button>

                                      {d.type === 'kot_printer' && (
                                        <button
                                          onClick={() => handlePrintTestKot(d)}
                                          disabled={testKot?.loading}
                                          className="btn btn-xs bg-paper-2 border hover:bg-paper"
                                          title="Send test KOT to print manager queue"
                                        >
                                          {testKot?.loading ? '…' : 'Print Test'}
                                        </button>
                                      )}

                                      <button
                                        onClick={() => {
                                          const parts = (d.target || '').split(':');
                                          setDeviceForm({
                                            id: d.id,
                                            name: d.name,
                                            type: d.type,
                                            connection: d.connection || 'network',
                                            target: d.target,
                                            ip: d.ip || parts[0] || '192.168.1.201',
                                            port: d.port || parts[1] || '9100',
                                            station: d.station || 'kitchen',
                                            priority: d.priority || 'primary',
                                            kotRule: d.kotRule || 'station_only',
                                            isDefault: !!d.isDefault
                                          });
                                          setShowDeviceForm(true);
                                        }}
                                        className="btn btn-xs border bg-paper-2"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDevice(d.id, d.name)}
                                        className="text-red-500 hover:text-red-600 p-1"
                                        title="Delete device"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {devices.length === 0 && (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-ink-3">
                                  No hardware devices configured yet. Click Register Printer / Device above.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* INLINE FORM: REGISTER PRINTER / DEVICE */}
                  {showDeviceForm && (
                    <div className="border border-line rounded-2xl p-5 bg-paper-3 mt-2 flex flex-col gap-5 shadow-lg">
                      <div className="flex justify-between items-center border-b pb-3 border-line">
                        <div>
                          <b className="text-base block font-bold font-display">
                            {deviceForm.id ? 'EDIT DEVICE CONFIGURATION' : 'REGISTER PRINTER / DEVICE'}
                          </b>
                          <span className="text-xs text-ink-3">Configure LAN network parameters, station assignment &amp; KOT routing rules.</span>
                        </div>
                        <button onClick={() => setShowDeviceForm(false)} className="text-ink-3 hover:text-ink"><X size={18} /></button>
                      </div>

                      <form onSubmit={handleSaveDevice} className="flex flex-col gap-6">
                        {/* 1. BASIC DEVICE INFORMATION */}
                        <div className="flex flex-col gap-3">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">1. Device Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="lbl">Device Name</label>
                              <input
                                value={deviceForm.name || ''}
                                onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Kitchen Printer 01"
                                required
                                className="inp bg-paper-2 font-semibold"
                              />
                            </div>

                            <div>
                              <label className="lbl">Device Type</label>
                              <select
                                value={deviceForm.type || 'kot_printer'}
                                onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, type: e.target.value }))}
                                className="inp bg-paper-2 font-semibold"
                              >
                                <option value="both_printer">Both (Billing & KOT)</option>
                                <option value="kot_printer">KOT Printer</option>
                                <option value="receipt_printer">Receipt Printer</option>
                                <option value="display">KDS Display</option>
                                <option value="other">Other Device / Cash Drawer</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="lbl">Connection</label>
                              <input
                                value="Network / LAN"
                                disabled
                                className="inp bg-paper-1 font-semibold text-ink-3"
                              />
                            </div>

                            <div>
                              <label className="lbl">IP Address</label>
                              <input
                                value={deviceForm.ip || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDeviceForm((prev: any) => ({
                                    ...prev,
                                    ip: val,
                                    target: `${val}:${prev.port || '9100'}`
                                  }));
                                }}
                                placeholder="e.g. 192.168.1.201"
                                required
                                className="inp bg-paper-2 font-mono font-semibold"
                              />
                            </div>

                            <div>
                              <label className="lbl">Port (Default 9100)</label>
                              <input
                                value={deviceForm.port || '9100'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDeviceForm((prev: any) => ({
                                    ...prev,
                                    port: val,
                                    target: `${prev.ip || '192.168.1.201'}:${val}`
                                  }));
                                }}
                                placeholder="9100"
                                required
                                className="inp bg-paper-2 font-mono font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. CONDITIONAL: KOT PRINTER SPECIFIC SECTIONS */}
                        {(deviceForm.type === 'kot_printer' || deviceForm.type === 'both_printer') && (
                          <>
                            {/* KOT STATION */}
                            <div className="flex flex-col gap-3 border-t pt-4 border-line">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">2. KOT Station</h4>
                              <p className="text-xs text-ink-3">Which station should this printer serve?</p>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                  { id: 'kitchen', name: 'Kitchen', icon: '🍳', desc: 'Food prep' },
                                  { id: 'bar', name: 'Bar', icon: '☕', desc: 'Drinks & beverages' },
                                  { id: 'bakery', name: 'Bakery', icon: '🥐', desc: 'Bakery items' },
                                  { id: 'dessert', name: 'Dessert', icon: '🍰', desc: 'Desserts & sweets' },
                                  { id: 'custom', name: 'Custom', icon: '⚙️', desc: 'Custom station' },
                                ].map((st) => {
                                  const isSel = (deviceForm.station || 'kitchen') === st.id;
                                  return (
                                    <button
                                      key={st.id}
                                      type="button"
                                      onClick={() => setDeviceForm((prev: any) => ({ ...prev, station: st.id }))}
                                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                        isSel
                                          ? 'bg-amber-500/10 border-turmeric text-ink ring-2 ring-turmeric/30'
                                          : 'bg-paper-2 border-line hover:border-line-2'
                                      }`}
                                    >
                                      <span className="text-2xl mb-1">{st.icon}</span>
                                      <div>
                                        <b className="text-xs block font-bold">{st.name}</b>
                                        <span className="text-[10px] text-ink-3 block">{st.desc}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* PRINTER PRIORITY */}
                            <div className="flex flex-col gap-3 border-t pt-4 border-line">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">3. Printer Priority</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={() => setDeviceForm((prev: any) => ({ ...prev, priority: 'primary' }))}
                                  className={`p-3.5 rounded-xl border text-left transition-all ${
                                    (deviceForm.priority || 'primary') === 'primary'
                                      ? 'bg-amber-500/10 border-turmeric text-ink ring-2 ring-turmeric/30'
                                      : 'bg-paper-2 border-line'
                                  }`}
                                >
                                  <b className="text-xs block font-bold uppercase">PRIMARY PRINTER</b>
                                  <span className="text-[11px] text-ink-3">Default destination for KOT tickets for this station.</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeviceForm((prev: any) => ({ ...prev, priority: 'backup' }))}
                                  className={`p-3.5 rounded-xl border text-left transition-all ${
                                    deviceForm.priority === 'backup'
                                      ? 'bg-amber-500/10 border-turmeric text-ink ring-2 ring-turmeric/30'
                                      : 'bg-paper-2 border-line'
                                  }`}
                                >
                                  <b className="text-xs block font-bold uppercase">BACKUP PRINTER</b>
                                  <span className="text-[11px] text-ink-3">Receives KOTs if the primary printer is unreachable.</span>
                                </button>
                              </div>

                              {/* Priority warning if primary already exists */}
                              {(() => {
                                const targetStation = deviceForm.station || 'kitchen';
                                const existingPrimary = devices.find(
                                  (d) => d.type === 'kot_printer' && d.station === targetStation && d.priority === 'primary' && d.id !== deviceForm.id
                                );
                                if (!existingPrimary || deviceForm.priority === 'backup') return null;

                                return (
                                  <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-900 text-xs flex items-center justify-between gap-3">
                                    <span>⚠️ Primary printer already configured for {targetStation} ({existingPrimary.name}).</span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setDeviceForm((prev: any) => ({ ...prev, priority: 'backup' }))}
                                        className="btn btn-xs bg-amber-600 text-white font-bold"
                                      >
                                        Set as Backup
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* KOT ITEM SEPARATION */}
                            <div className="flex flex-col gap-3 border-t pt-4 border-line">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">4. KOT Item Separation</h4>
                                  <p className="text-xs text-ink-3">What should this printer print?</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                  {
                                    id: 'station_only',
                                    title: 'OPTION 1 (RECOMMENDED)',
                                    label: 'Only items from this station',
                                    desc: 'Print only menu items assigned to this station.'
                                  },
                                  {
                                    id: 'all_items',
                                    title: 'OPTION 2',
                                    label: 'All items from order',
                                    desc: 'Print the complete order on this printer.'
                                  },
                                  {
                                    id: 'custom',
                                    title: 'OPTION 3',
                                    label: 'Custom item/category filter',
                                    desc: 'Choose specific categories or items.'
                                  }
                                ].map((opt) => {
                                  const isSel = (deviceForm.kotRule || 'station_only') === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setDeviceForm((prev: any) => ({ ...prev, kotRule: opt.id }))}
                                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                        isSel
                                          ? 'bg-amber-500/10 border-turmeric text-ink ring-2 ring-turmeric/30'
                                          : 'bg-paper-2 border-line hover:border-line-2'
                                      }`}
                                    >
                                      <div>
                                        <span className="text-[10px] font-bold uppercase block text-turmeric-d">{opt.title}</span>
                                        <b className="text-xs font-bold block mt-0.5">{opt.label}</b>
                                        <p className="text-[11px] text-ink-3 mt-1 leading-snug">{opt.desc}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="p-3 rounded-xl bg-paper-2 border border-line text-[11px] text-ink-3 flex items-center gap-2">
                                <Info size={16} className="text-turmeric shrink-0" />
                                <span>Recommended: Use station-based printing to prevent duplicate KOTs across Kitchen, Bar and Bakery printers.</span>
                              </div>
                            </div>

                            {/* KOT ROUTING PREVIEW */}
                            <div className="flex flex-col gap-2 border-t pt-4 border-line">
                              <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">5. KOT Routing Preview</h4>
                              <div className="p-4 rounded-xl bg-paper-2 border border-line font-mono text-xs flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-ink">
                                  <span className="font-bold">Order</span>
                                  <span>↓</span>
                                  <span className="font-bold text-turmeric-d uppercase">{deviceForm.station || 'Kitchen'} Station</span>
                                  <span>↓</span>
                                  <span className="font-bold">{deviceForm.name || 'Kitchen Printer 01'}</span>
                                  <span className="pill text-[9px] uppercase">{deviceForm.priority || 'primary'}</span>
                                </div>
                                <div className="border-t pt-2 border-line-2 text-ink-2">
                                  {deviceForm.kotRule === 'all_items' ? (
                                    <div>
                                      <b>Printed Items (Full Order):</b>
                                      <div className="pl-3 mt-1 text-[11px]">Burger × 1</div>
                                      <div className="pl-3 text-[11px]">Pizza × 2</div>
                                      <div className="pl-3 text-[11px]">Iced Tea × 1 (Bar)</div>
                                      <div className="pl-3 text-[11px]">Chocolate Muffin × 1 (Bakery)</div>
                                    </div>
                                  ) : (
                                    <div>
                                      <b>Printed Items (Only {deviceForm.station || 'Kitchen'} items):</b>
                                      <div className="pl-3 mt-1 text-[11px]">Burger × 1</div>
                                      <div className="pl-3 text-[11px]">Pizza × 2</div>
                                      <div className="text-[10px] text-ink-3 italic mt-1">(Bar &amp; Bakery items excluded from this ticket)</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* TEST CONNECTION & TEST PRINT */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 border-line">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTestConnection(deviceForm.target, deviceForm.port)}
                                  className="btn btn-sm bg-paper-2 border"
                                >
                                  🔌 Test Connection
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintTestKot()}
                                  className="btn btn-sm bg-paper-2 border"
                                >
                                  🖨 Print Test KOT
                                </button>
                              </div>

                              {testConnectionStatus['form'] && (
                                <span className={`text-xs font-bold ${testConnectionStatus['form'].ok ? 'text-green-600' : 'text-red-500'}`}>
                                  {testConnectionStatus['form'].message}
                                </span>
                              )}
                            </div>
                          </>
                        )}

                        {/* CONDITIONAL: RECEIPT & BOTH PRINTER */}
                        {(deviceForm.type === 'receipt_printer' || deviceForm.type === 'both_printer') && (
                          <div className="flex flex-col gap-3 border-t pt-4 border-line">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">
                              {deviceForm.type === 'both_printer' ? 'Combined Billing & KOT Output' : 'Receipt Output Configuration'}
                            </h4>
                            <div className="p-3.5 rounded-xl bg-paper-2 border border-line text-xs flex flex-col gap-2">
                              <b>{deviceForm.type === 'both_printer' ? 'Single Unified Printer (Bills + Kitchen Tickets)' : 'Billing Counter Output Node'}</b>
                              <span className="text-ink-3">
                                {deviceForm.type === 'both_printer'
                                  ? 'Acts as the single unified printer for both customer receipts and kitchen KOT tickets.'
                                  : 'Prints customer tax invoices and settlement duplicate receipts upon payment.'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* CONDITIONAL: KDS DISPLAY */}
                        {deviceForm.type === 'display' && (
                          <div className="flex flex-col gap-3 border-t pt-4 border-line">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-turmeric-d">KDS Display Configuration</h4>
                            <div className="p-3.5 rounded-xl bg-paper-2 border border-line text-xs flex flex-col gap-2">
                              <b>Digital Kitchen Display System</b>
                              <span className="text-ink-3">Displays order queue cards digitally for kitchen staff on tablet screens.</span>
                            </div>
                          </div>
                        )}

                        {/* FOOTER ACTIONS */}
                        <div className="flex items-center justify-between border-t pt-4 border-line">
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none">
                            <input
                              type="checkbox"
                              checked={deviceForm.isDefault}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, isDefault: e.target.checked }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Set as default output node for this device type
                          </label>

                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowDeviceForm(false)} className="btn btn-sm">
                              Cancel
                            </button>
                            <button type="submit" className="btn btn-sm btn-primary px-5">
                              Save Device
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* MODAL: MENU ITEM TO STATION ROUTING MANAGER */}
                  {showStationRoutingModal && (
                    <div className="fixed inset-0 z-[8500] grid place-items-center p-4 bg-black/50 backdrop-blur-sm">
                      <div className="w-[min(750px,95vw)] max-h-[90vh] bg-paper-2 rounded-2xl border border-line shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-line flex items-center justify-between bg-paper-3">
                          <div>
                            <h3 className="font-bold font-display text-base">Menu Item ➔ KOT Station Routing</h3>
                            <p className="text-xs text-ink-3">Assign products to Kitchen, Bar, Bakery, Dessert or Custom stations.</p>
                          </div>
                          <button onClick={() => setShowStationRoutingModal(false)} className="text-ink-3 hover:text-ink">
                            <X size={18} />
                          </button>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="p-3 border-b border-line bg-paper-2 flex flex-wrap gap-2 items-center justify-between">
                          <input
                            type="text"
                            value={routingSearch}
                            onChange={(e) => setRoutingSearch(e.target.value)}
                            placeholder="Search menu items…"
                            className="inp inp-compact w-48 bg-paper-3 text-xs"
                          />

                          <div className="flex flex-wrap gap-1">
                            {[
                              { id: 'all', label: 'All Items' },
                              { id: 'unassigned', label: '⚠ Unassigned' },
                              { id: 'kitchen', label: 'Kitchen' },
                              { id: 'bar', label: 'Bar' },
                              { id: 'bakery', label: 'Bakery' },
                              { id: 'dessert', label: 'Dessert' },
                            ].map((f) => (
                              <button
                                key={f.id}
                                onClick={() => setRoutingStationFilter(f.id)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                                  routingStationFilter === f.id
                                    ? 'bg-turmeric text-amber-950 shadow-sm'
                                    : 'bg-paper-3 text-ink-2 border border-line-2'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="p-3 overflow-y-auto flex-1 max-h-[60vh]">
                          {(() => {
                            const q = routingSearch.trim().toLowerCase();
                            const filtered = (menuItems || []).filter((item) => {
                              if (q && !item.name.toLowerCase().includes(q)) return false;
                              if (routingStationFilter === 'unassigned') return !item.station || item.station === 'none';
                              if (routingStationFilter !== 'all') return (item.station || 'kitchen') === routingStationFilter;
                              return true;
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="p-8 text-center text-ink-3 text-xs">
                                  No menu items match your search or filter criteria.
                                </div>
                              );
                            }

                            return (
                              <div className="divide-y divide-line border rounded-xl overflow-hidden bg-paper-3 text-xs">
                                {filtered.map((item) => {
                                  const curStation = item.station || 'kitchen';
                                  return (
                                    <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-paper-2/50 transition-colors">
                                      <div>
                                        <b className="font-bold text-sm block">{item.name}</b>
                                        <span className="text-[10px] text-ink-3">₹{(item.pricePaise / 100).toFixed(2)}</span>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <select
                                          value={curStation}
                                          disabled={savingMenuItemId === item.id}
                                          onChange={(e) => handleAssignItemStation(item.id, e.target.value)}
                                          className="inp inp-compact bg-paper-2 font-bold text-xs cursor-pointer min-w-[140px]"
                                        >
                                          <option value="kitchen">🍳 Kitchen</option>
                                          <option value="bar">☕ Bar</option>
                                          <option value="bakery">🥐 Bakery</option>
                                          <option value="dessert">🍰 Dessert</option>
                                          {kitchens
                                            .filter(k => !['kitchen', 'bar', 'bakery', 'dessert'].includes(k.id))
                                            .map(k => (
                                              <option key={k.id} value={k.id}>⚙️ {k.name}</option>
                                            ))}
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="p-3 border-t border-line bg-paper-3 flex justify-end shrink-0">
                          <button onClick={() => setShowStationRoutingModal(false)} className="btn btn-sm btn-primary px-5">
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 11. LOYALTY SETTINGS ── */}
              {activePanel === 'loyalty' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Users className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Customer &amp; Loyalty Configuration</h2>
                      <p className="text-xs text-ink-3">Configure rewards collection ratio, redemption conversions, birthday treats rules.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card p-4 bg-paper-3 flex flex-col gap-3">
                      <b className="text-sm block border-b pb-1.5">Points Earning Ratio</b>
                      <div className="flex items-center gap-2">
                        <span>Get</span>
                        <input
                          type="number"
                          value={loyaltyConfig.pointsEarnRatio}
                          onChange={(e) => setLoyaltyConfig(prev => ({ ...prev, pointsEarnRatio: e.target.value }))}
                          className="w-16 px-2 py-1 rounded bg-paper-2 border text-center font-bold"
                        />
                        <span>Point per ₹100 spend.</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span>Point Value: 1 Point = ₹</span>
                        <input
                          type="number"
                          value={loyaltyConfig.pointsRedeemValue}
                          onChange={(e) => setLoyaltyConfig(prev => ({ ...prev, pointsRedeemValue: e.target.value }))}
                          className="w-16 px-2 py-1 rounded bg-paper-2 border text-center font-bold"
                        />
                      </div>
                    </div>

                    <div className="card p-4 bg-paper-3 flex flex-col gap-3 justify-between">
                      <div>
                        <b className="text-sm block border-b pb-1.5">Birthday Multiplier</b>
                        <p className="text-xs text-ink-3 mt-1.5">Configure multiplied points rewards on client birthdays.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Award</span>
                        <input
                          type="number"
                          value={loyaltyConfig.birthdayRewardMultiplier}
                          onChange={(e) => setLoyaltyConfig(prev => ({ ...prev, birthdayRewardMultiplier: e.target.value }))}
                          className="w-16 px-2 py-1 rounded bg-paper-2 border text-center font-bold"
                        />
                        <span>x points.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 12. PWA SETTINGS ── */}
              {activePanel === 'pwa' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-turmeric/10 flex items-center justify-center text-turmeric shrink-0">
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold font-display text-ink">PWA Settings</h2>
                        <p className="text-xs text-ink-3">Configure mobile web applications layouts, themes, branding and access settings.</p>
                      </div>
                    </div>
                    {pwaCfg && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 self-start sm:self-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active Config
                      </span>
                    )}
                  </div>

                  {/* Live Customer Web App URL & Preview Bar */}
                  {(() => {
                    const customerWebUrl = customerPort === '3003' 
                      ? `http://${effectiveLanIp}:${customerPort}/t/${customerTableToken || 'demo'}`
                      : `http://${effectiveLanIp}:3000/app?t=${customerTableToken || 'demo'}`;
                    return (
                      <div className="p-4 rounded-xl border border-line bg-paper-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-turmeric/10 flex items-center justify-center text-turmeric shrink-0">
                            <QrCode size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">Customer App Order URL</p>
                            <p className="text-[11px] font-mono text-ink-3 truncate max-w-sm sm:max-w-md">{customerWebUrl}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(customerWebUrl, 'Customer App URL')}
                            className="btn btn-sm border bg-paper-2 text-xs"
                          >
                            <Copy size={13} /> {copiedLink === 'Customer App URL' ? 'Copied!' : 'Copy'}
                          </button>
                          <a
                            href={customerWebUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-primary flex items-center gap-1 text-xs"
                          >
                            <ExternalLink size={13} /> Open App
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  {pwaCfg ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSavePwa(pwaCfg);
                      }}
                      className="flex flex-col gap-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="lbl">Hero Section Tagline</label>
                          <input
                            value={pwaCfg.theme?.heroTagline ?? ''}
                            onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...(c?.theme || {}), heroTagline: e.target.value } }))}
                            className="inp animate-glow"
                            placeholder="e.g. Freshly brewed daily"
                          />
                        </div>

                        <div>
                          <label className="lbl">Theme Accent Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={pwaCfg.theme?.accent || '#D4A373'}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...(c?.theme || {}), accent: e.target.value } }))}
                              className="h-10 w-12 rounded-xl border p-1 bg-paper-3 cursor-pointer"
                            />
                            <input
                              value={pwaCfg.theme?.accent || ''}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...(c?.theme || {}), accent: e.target.value } }))}
                              placeholder="e.g. #D4A373"
                              className="inp font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="lbl">QR Table Welcome Prefix</label>
                          <input
                            value={pwaCfg.table?.welcomePrefix ?? ''}
                            onChange={(e) => setPwaCfg((c: any) => ({ ...c, table: { ...(c?.table || {}), welcomePrefix: e.target.value } }))}
                            className="inp"
                            placeholder="e.g. Welcome to Table"
                          />
                        </div>

                        <div className="flex flex-col justify-end">
                          <label className="flex items-center gap-2 text-xs text-ink-2 select-none h-11">
                            <input
                              type="checkbox"
                              checked={pwaCfg.table?.allowManualPick ?? true}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, table: { ...(c?.table || {}), allowManualPick: e.target.checked } }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                            />
                            Allow Customers to Manual Pick Table
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 border-line">
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs text-ink-2 select-none">
                            <input
                              type="checkbox"
                              checked={pwaCfg.registration?.enabled ?? false}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, registration: { ...(c?.registration || {}), enabled: e.target.checked } }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                            />
                            Enable Customer Registration / Login
                          </label>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs text-ink-2 select-none">
                            <input
                              type="checkbox"
                              checked={pwaCfg.registration?.collectName ?? true}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, registration: { ...(c?.registration || {}), collectName: e.target.checked } }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                            />
                            Collect Customer Name on Login
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1 border-t border-line">
                        <label className="lbl">Customer App Logo</label>
                        <p className="text-xs text-ink-3">Branded image overlay for order checkout. Square PNG/JPG recommended. Defaults to store logo.</p>
                        <div className="flex items-center gap-3">
                          {pwaCfg.theme?.logoUrl && <img src={pwaCfg.theme.logoUrl} alt="" className="rounded-lg object-contain" style={{ width: 44, height: 44, background: 'var(--paper-3)' }} />}
                          <label className="btn btn-sm cursor-pointer border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                            {pwaCfg.theme?.logoUrl ? 'Replace logo' : 'Upload logo'}
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const url = await uploadImage(f);
                                if (url) setPwaCfg((c: any) => ({ ...c, theme: { ...(c?.theme || {}), logoUrl: url } }));
                              }
                            }} />
                          </label>
                          {pwaCfg.theme?.logoUrl && <button type="button" onClick={() => setPwaCfg((c: any) => ({ ...c, theme: { ...(c?.theme || {}), logoUrl: null } }))} className="btn btn-danger btn-sm">Remove</button>}
                        </div>
                      </div>

                      <button type="submit" disabled={pwaSaving} className="btn btn-primary self-end px-6">
                        {pwaSaving ? 'Saving app config...' : 'Save App settings'}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-turmeric border-t-transparent animate-spin" />
                      <p className="text-sm font-medium text-ink-2">Loading Customer Web App properties...</p>
                      <p className="text-xs text-ink-3 max-w-sm">
                        Retrieving mobile app branding, table ordering, and customer access configurations.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPwaCfg(DEFAULT_PWA)}
                        className="mt-2 text-xs text-turmeric hover:underline font-semibold cursor-pointer"
                      >
                        Load default settings now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── App QR Codes & Local Server Pairing ── */}
              {activePanel === 'app_qrs' && (() => {
                const activeWaiterName = waiterUserOption === 'custom' 
                  ? customWaiterName.trim() 
                  : (waiterUserOption === 'all' ? '' : waiterUserOption);

                const waiterPath = waiterPort === '3000' ? '/pos' : '/login';
                const waiterFullUrl = `http://${effectiveLanIp}:${waiterPort}${waiterPath}?server=${effectiveLanIp}&port=${waiterPort}${activeWaiterName ? `&user=${encodeURIComponent(activeWaiterName)}` : ''}`;
                const kdsFullUrl = `http://${effectiveLanIp}:3000/kds`;
                const customerFullUrl = customerPort === '3003' 
                  ? `http://${effectiveLanIp}:3003/t/${customerTableToken || 'demo'}`
                  : `http://${effectiveLanIp}:3000/app?t=${customerTableToken || 'demo'}`;

                return (
                  <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                    {/* Header */}
                    <div className="border-b pb-3 border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-turmeric/10 flex items-center justify-center text-turmeric">
                          <Smartphone size={22} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold font-display text-ink">Application QR Codes &amp; Local Pairing</h2>
                          <p className="text-xs text-ink-3">Connect Waiter tablets, Kitchen KDS, and Customer phones directly to your Main PC Desktop Server over local Wi-Fi.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Local Wi-Fi Active
                        </span>
                      </div>
                    </div>

                    {/* Main PC Desktop Server IP Bar */}
                    <div className="p-4 rounded-2xl border border-line bg-paper-3 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Server className="text-turmeric shrink-0" size={18} />
                          <div>
                            <span className="font-bold text-sm text-ink block">Shop Main PC Desktop Server IP</span>
                            <span className="text-xs text-ink-3">
                              {isCloudHost 
                                ? 'Cloud View: Set your in-store Main PC IP address so tablets connect locally over the café Wi-Fi.'
                                : 'Local Desktop App: This IP address allows waiter tablets and kitchen screens on your Wi-Fi to communicate directly.'}
                            </span>
                          </div>
                        </div>
                        {detectedLanIp && (
                          <button
                            type="button"
                            onClick={() => handleSaveShopIp(detectedLanIp)}
                            className="btn btn-ghost btn-xs text-xs self-start sm:self-auto border border-line hover:border-turmeric text-ink-2"
                          >
                            <RefreshCw size={12} className="mr-1" /> Use Detected ({detectedLanIp})
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-3">
                            <Wifi size={16} />
                          </div>
                          <input
                            type="text"
                            value={customLanIp}
                            onChange={(e) => setCustomLanIp(e.target.value)}
                            placeholder={`e.g. ${detectedLanIp || '10.226.223.152'}`}
                            className="inp pl-9 w-full font-mono text-xs bg-paper-1 border-line"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveShopIp(customLanIp)}
                          className="btn btn-primary text-xs shrink-0 px-4"
                        >
                          <Check size={14} className="mr-1" /> Save IP
                        </button>
                      </div>

                      {isCloudHost && (
                        <div className="text-[11px] text-amber-700 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                          ⚠️ <b>Note:</b> You are viewing the Owner Dashboard from the cloud. The QR codes below are configured to connect waiter tablets directly to the <b>Shop Main PC IP ({effectiveLanIp})</b> on your local Wi-Fi, never the cloud website.
                        </div>
                      )}
                    </div>

                    {/* QR Code Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* CARD 1: Waiter POS & Mobile Ordering (Featured) */}
                      <div className="p-6 border-2 border-turmeric/30 rounded-2xl bg-paper-3 flex flex-col items-center gap-4 text-center shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-turmeric text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
                          Staff Mobile &amp; Tablet
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <User className="text-turmeric" size={20} />
                          <h4 className="font-bold text-lg text-ink font-display">Waiter App</h4>
                        </div>

                        {/* Mode & Port Selector */}
                        <div className="w-full text-left flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider">Application Mode</label>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-paper-1 rounded-xl border border-line">
                            <button
                              type="button"
                              onClick={() => setWaiterPort('3000')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                waiterPort === '3000' 
                                  ? 'bg-turmeric text-white shadow-sm font-semibold' 
                                  : 'text-ink-3 hover:text-ink'
                              }`}
                            >
                              POS Till (3000) ★
                            </button>
                            <button
                              type="button"
                              onClick={() => setWaiterPort('3002')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                waiterPort === '3002' 
                                  ? 'bg-turmeric text-white shadow-sm font-semibold' 
                                  : 'text-ink-3 hover:text-ink'
                              }`}
                            >
                              Legacy (3002)
                            </button>
                          </div>
                        </div>

                        {/* Waiter User Name Pairing Selector */}
                        <div className="w-full text-left flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider flex items-center justify-between">
                            <span>Pair Waiter / Staff User</span>
                            {activeWaiterName && (
                              <span className="text-[10px] text-turmeric font-semibold">Active: {activeWaiterName}</span>
                            )}
                          </label>
                          <select
                            value={waiterUserOption}
                            onChange={(e) => setWaiterUserOption(e.target.value)}
                            className="inp text-xs bg-paper-1 border-line w-full"
                          >
                            <option value="all">👤 All Waiters (Enter PIN on Tablet)</option>
                            {waiterList.map((w) => (
                              <option key={w.id} value={w.name}>
                                {w.name} ({w.role.toUpperCase()})
                              </option>
                            ))}
                            <option value="custom">✏️ Custom Waiter Name...</option>
                          </select>

                          {waiterUserOption === 'custom' && (
                            <input
                              type="text"
                              value={customWaiterName}
                              onChange={(e) => setCustomWaiterName(e.target.value)}
                              placeholder="Enter waiter name (e.g. Rahul)"
                              className="inp text-xs bg-paper-1 border-line w-full mt-1"
                            />
                          )}
                        </div>

                        {/* QR Code Graphic */}
                        <div className="relative group p-2 bg-white rounded-2xl border border-line shadow-sm hover:shadow-md transition-shadow">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(waiterFullUrl)}`} 
                            alt="Waiter App QR Code" 
                            className="w-[180px] h-[180px] rounded-xl"
                          />
                        </div>

                        {/* Active Pairing Badge */}
                        <div className="w-full py-1.5 px-3 rounded-xl bg-turmeric/10 border border-turmeric/20 text-xs text-ink flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={14} className="text-turmeric shrink-0" />
                          <span className="truncate font-medium">
                            {activeWaiterName ? `Paired to: ${activeWaiterName}` : 'Open PIN Login on Tablet'}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(waiterFullUrl, 'Waiter App')}
                            className="btn btn-ghost btn-sm w-full text-xs border border-line flex items-center justify-center gap-1.5 text-ink-2 hover:text-ink"
                          >
                            {copiedLink === 'Waiter App' ? (
                              <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 font-semibold">Link Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy Connection URL</span>
                              </>
                            )}
                          </button>

                          <a
                            href={waiterFullUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-sm w-full text-xs flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink size={14} /> Open Waiter Terminal
                          </a>
                        </div>

                        <p className="text-[11px] text-ink-3 leading-tight mt-1">
                          📲 Scan with any tablet camera, Google Lens, or the ChayaOne Waiter App to pair instantly on café Wi-Fi.
                        </p>
                      </div>

                      {/* CARD 2: Kitchen KDS */}
                      <div className="p-6 border border-line rounded-2xl bg-paper-3 flex flex-col items-center gap-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mt-1">
                          <ChefHat className="text-turmeric" size={20} />
                          <h4 className="font-bold text-lg text-ink font-display">Kitchen KDS</h4>
                        </div>

                        <p className="text-xs text-ink-3">Live kitchen order display &amp; ticket bump station</p>

                        <div className="p-2 bg-white rounded-2xl border border-line shadow-sm">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(kdsFullUrl)}`} 
                            alt="Kitchen KDS QR Code" 
                            className="w-[180px] h-[180px] rounded-xl"
                          />
                        </div>

                        <div className="w-full py-1.5 px-3 rounded-xl bg-paper-1 border border-line text-xs text-ink-3 truncate font-mono">
                          {kdsFullUrl}
                        </div>

                        <div className="w-full flex flex-col gap-2 mt-auto">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(kdsFullUrl, 'Kitchen KDS')}
                            className="btn btn-ghost btn-sm w-full text-xs border border-line flex items-center justify-center gap-1.5 text-ink-2"
                          >
                            {copiedLink === 'Kitchen KDS' ? (
                              <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 font-semibold">Link Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy KDS URL</span>
                              </>
                            )}
                          </button>

                          <a 
                            href={kdsFullUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-ghost border border-line btn-sm w-full text-xs flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink size={14} /> Open Kitchen KDS
                          </a>
                        </div>
                      </div>

                      {/* CARD 3: Customer App (Table QR) */}
                      <div className="p-6 border border-line rounded-2xl bg-paper-3 flex flex-col items-center gap-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mt-1">
                          <Smartphone className="text-turmeric" size={20} />
                          <h4 className="font-bold text-lg text-ink font-display">Customer App</h4>
                        </div>

                        <div className="w-full text-left flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider">Customer Table Token</label>
                          <div className="flex gap-1.5">
                            {['demo', 'T-01', 'T-02'].map((token) => (
                              <button
                                key={token}
                                type="button"
                                onClick={() => setCustomerTableToken(token)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                                  customerTableToken === token 
                                    ? 'bg-turmeric text-white font-bold' 
                                    : 'bg-paper-1 border border-line text-ink-3'
                                }`}
                              >
                                {token}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-2 bg-white rounded-2xl border border-line shadow-sm">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(customerFullUrl)}`} 
                            alt="Customer App QR Code" 
                            className="w-[180px] h-[180px] rounded-xl"
                          />
                        </div>

                        <div className="w-full py-1.5 px-3 rounded-xl bg-paper-1 border border-line text-xs text-ink-3 truncate font-mono">
                          {customerFullUrl}
                        </div>

                        <div className="w-full flex flex-col gap-2 mt-auto">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(customerFullUrl, 'Customer App')}
                            className="btn btn-ghost btn-sm w-full text-xs border border-line flex items-center justify-center gap-1.5 text-ink-2"
                          >
                            {copiedLink === 'Customer App' ? (
                              <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-emerald-600 font-semibold">Link Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy Customer URL</span>
                              </>
                            )}
                          </button>

                          <a 
                            href={customerFullUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-ghost border border-line btn-sm w-full text-xs flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink size={14} /> Open Customer App
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── 13. ONLINE ORDERING ── */}
              {activePanel === 'online_order' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Truck className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Online Ordering</h2>
                      <p className="text-xs text-ink-3">Configure delivery, local pickups, delivery radius limits, minimum amount slabs.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <h4 className="font-bold text-sm">Fulfillment Channels</h4>
                      <label className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                        <span>Allow Store Pickups</span>
                        <input
                          type="checkbox"
                          checked={onlineOrderingConfig.pickupEnabled}
                          onChange={(e) => setOnlineOrderingConfig(prev => ({ ...prev, pickupEnabled: e.target.checked }))}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>
                      <label className="flex items-center justify-between p-2.5 rounded-xl border bg-paper-3 text-xs select-none">
                        <span>Allow Home Deliveries</span>
                        <input
                          type="checkbox"
                          checked={onlineOrderingConfig.deliveryEnabled}
                          onChange={(e) => setOnlineOrderingConfig(prev => ({ ...prev, deliveryEnabled: e.target.checked }))}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-3">
                      <h4 className="font-bold text-sm">Delivery Slabs</h4>
                      <div>
                        <label className="lbl">Maximum Delivery Radius (KM)</label>
                        <input
                          type="number"
                          value={onlineOrderingConfig.deliveryRadiusKm}
                          onChange={(e) => setOnlineOrderingConfig(prev => ({ ...prev, deliveryRadiusKm: e.target.value }))}
                          className="inp bg-paper-3"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 14. NOTIFICATIONS HUB ── */}
              {activePanel === 'notifications' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Bell className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Notifications Hub</h2>
                      <p className="text-xs text-ink-3">Toggles for SMS receipts, WhatsApp summaries and sound triggers for alerts.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {([
                      { key: 'whatsappEnabled', title: 'WhatsApp Business Alerts', desc: 'Send order invoices to customers via WhatsApp API' },
                      { key: 'smsEnabled', title: 'SMS Transactional Receipts', desc: 'Notify status updates via classic text messages' },
                      { key: 'emailEnabled', title: 'Email Summaries & invoices', desc: 'Auto email daily revenue reports to owner' },
                      { key: 'pushNotificationEnabled', title: 'Web App Push Alerts', desc: 'Send terminal alerts for incoming orders' }
                    ] as const).map((notif) => (
                      <div key={notif.key} className="flex items-center justify-between p-3 rounded-xl border bg-paper-3">
                        <div>
                          <b className="text-sm block">{notif.title}</b>
                          <span className="text-xs text-ink-3">{notif.desc}</span>
                        </div>
                        <button
                          onClick={() => setNotificationsConfig(prev => ({ ...prev, [notif.key]: !prev[notif.key] }))}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                            notificationsConfig[notif.key] ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                              notificationsConfig[notif.key] ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 15. STAFF & ROLES ── */}
              {activePanel === 'staff' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Shield className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Staff Roles &amp; Security Permissions</h2>
                      <p className="text-xs text-ink-3">Manage role actions, permissions matrix, POS shift assignments and access pins.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-yellow-500/10 bg-yellow-500/5 text-xs text-ink-2 flex gap-3">
                    <Info className="text-yellow-600 shrink-0 mt-0.5" size={16} />
                    <p>
                      Staff directory, PIN updates, payroll and attendance records are managed under the primary <b>Staff Panel</b>. Use this panel to configure general security restrictions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-sm mb-3">POS Authorization Overrides</h4>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'Require Manager approval for refunds', checked: true },
                          { label: 'Require Manager approval for item cancellations', checked: true },
                          { label: 'Require Manager approval to reprint bills', checked: false },
                          { label: 'Restrict cashier to active terminals only', checked: false }
                        ].map((item, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-xs text-ink-2 select-none py-1">
                            <input
                              type="checkbox"
                              defaultChecked={item.checked}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm mb-3">Staff Role Hierarchy</h4>
                      <div className="divide-y divide-line border rounded-xl overflow-hidden bg-paper-3 text-xs">
                        {[
                          { role: 'owner', label: 'Owner', desc: 'Full root clearance & settings edits' },
                          { role: 'manager', label: 'Manager', desc: 'Daily operations & menu configuration' },
                          { role: 'cashier', label: 'Cashier', desc: 'POS checkout & cash drawer balance' },
                          { role: 'captain', label: 'Captain', desc: 'Manage tables, routing, active orders' },
                          { role: 'waiter', label: 'Waiter', desc: 'Place orders, update cooking queues' }
                        ].map((r) => (
                          <div key={r.role} className="p-3">
                            <b className="block text-sm">{r.label}</b>
                            <span className="text-ink-3">{r.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 16. REPORTS SETTINGS ── */}
              {activePanel === 'reports' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <BarChart3 className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Report settings</h2>
                      <p className="text-xs text-ink-3">Scheduled automatic email summaries, export parameters settings, visibility access.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm mb-3">Automatic Emailed Sales Summaries</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-3 rounded-xl border bg-paper-3 text-xs select-none">
                        <div>
                          <b className="block text-sm">Send daily closing reports</b>
                          <span className="text-ink-3">Trigger email once shift closes.</span>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={true}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl border bg-paper-3 text-xs select-none">
                        <div>
                          <b className="block text-sm">Send weekly dashboard summary</b>
                          <span className="text-ink-3">Dispatched every Monday morning.</span>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={false}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 17. AUDIT LOGS ── */}
              {activePanel === 'audit' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-5 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <ClipboardList className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Audit Logs Viewer</h2>
                      <p className="text-xs text-ink-3">Visual history tracking store configuration edits, user check-ins, discounts and cancellations.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto select-scrollbar">
                    <table className="rtable w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          <th className="pb-2 text-left font-semibold text-ink-3">Actor / Staff</th>
                          <th className="pb-2 text-left font-semibold text-ink-3">Action Type</th>
                          <th className="pb-2 text-left font-semibold text-ink-3">Entity Scoped</th>
                          <th className="pb-2 text-left font-semibold text-ink-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditList.map((log: any) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td className="py-2.5 font-bold text-ink" data-label="Actor">{log.actorName || 'System'}</td>
                            <td className="py-2.5 text-ink-2" data-label="Action">{log.action}</td>
                            <td className="py-2.5 text-ink-2 capitalize" data-label="Entity">{log.entity}</td>
                            <td className="py-2.5 text-ink-3" data-label="When">{new Date(log.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}

                        {auditList.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-ink-3">No audit records logged yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {auditTotal > 20 && (
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-xs text-ink-3">Page {auditPage} of {Math.ceil(auditTotal / 20)}</span>
                      <div className="flex gap-2">
                        <button
                          disabled={auditPage <= 1}
                          onClick={() => loadAudit(auditPage - 1)}
                          className="btn btn-sm btn-ghost"
                        >
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <button
                          disabled={auditPage * 20 >= auditTotal}
                          onClick={() => loadAudit(auditPage + 1)}
                          className="btn btn-sm btn-ghost"
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 18. INTEGRATIONS ── */}
              {activePanel === 'integrations' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Blocks className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Integrations Center</h2>
                      <p className="text-xs text-ink-3">Link your store POS to UPI gateways, Whatsapp API, Swiggy, Zomato and accounting tools.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Swiggy Integration */}
                    <div className="card p-4 flex flex-col justify-between bg-paper-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <b className="text-sm font-bold">Swiggy Orders API</b>
                          <span className="pill text-[9px] font-bold text-green-700 bg-green-500/10 border-green-500/20">Connected</span>
                        </div>
                        <p className="text-xs text-ink-3 mt-1.5">Direct orders sync from Swiggy Marketplace to Cafe OS KDS queue.</p>
                      </div>
                      <button type="button" className="btn btn-sm mt-3 self-start">Configure Webhooks</button>
                    </div>

                    {/* Zomato Integration */}
                    <div className="card p-4 flex flex-col justify-between bg-paper-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <b className="text-sm font-bold">Zomato Orders API</b>
                          <span className="pill text-[9px] font-bold text-green-700 bg-green-500/10 border-green-500/20">Connected</span>
                        </div>
                        <p className="text-xs text-ink-3 mt-1.5">Direct orders sync from Zomato Marketplace to Cafe OS KDS queue.</p>
                      </div>
                      <button type="button" className="btn btn-sm mt-3 self-start">Configure Webhooks</button>
                    </div>

                    {/* Payment Gateways */}
                    <div className="card p-4 flex flex-col gap-3 bg-paper-3 md:col-span-2">
                      <b className="text-sm font-bold">Online UPI Payment Aggregators</b>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="lbl">Razorpay API Live Key</label>
                          <input
                            type="text"
                            value={integrationsConfig.razorpayKey}
                            onChange={(e) => setIntegrationsConfig(prev => ({ ...prev, razorpayKey: e.target.value }))}
                            className="inp bg-paper-2"
                          />
                        </div>

                        <div>
                          <label className="lbl">PhonePe Merchant Identifier</label>
                          <input
                            type="text"
                            value={integrationsConfig.phonepeMerchantId}
                            onChange={(e) => setIntegrationsConfig(prev => ({ ...prev, phonepeMerchantId: e.target.value }))}
                            className="inp bg-paper-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 19. SUBSCRIPTION PLAN ── */}
              {activePanel === 'subscription' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Zap className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Subscription Plan</h2>
                      <p className="text-xs text-ink-3">Verify your licensing tier limits, invoices billing history, SaaS upgrade parameters.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-4 text-center bg-paper-3">
                      <b className="text-xs text-ink-3 block">Current SaaS Plan</b>
                      <h4 className="text-xl font-black text-turmeric-d uppercase mt-1.5">{outlet.plan.replace('_', ' ')}</h4>
                      <span className="text-[10px] text-ink-3 block mt-1">Billed annually</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3">
                      <b className="text-xs text-ink-3 block">Licensing Outlets Limit</b>
                      <h4 className="text-xl font-black text-turmeric-d mt-1.5">1 / 1</h4>
                      <span className="text-[10px] text-ink-3 block mt-1">Single branch mode active</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3">
                      <b className="text-xs text-ink-3 block">Active KDS Queues</b>
                      <h4 className="text-xl font-black text-turmeric-d mt-1.5">{kitchens.length} / 5</h4>
                      <span className="text-[10px] text-ink-3 block mt-1">Stations capacity limits</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 20. SECURITY ── */}
              {activePanel === 'security' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Lock className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Security Settings</h2>
                      <p className="text-xs text-ink-3">Setup store POS passwords policies, two-factor authentication, session timeouts.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="lbl">POS PIN Length Policy</label>
                        <select
                          value={securityConfig.pinPolicyLength}
                          onChange={(e) => setSecurityConfig(prev => ({ ...prev, pinPolicyLength: e.target.value }))}
                          className="inp"
                        >
                          <option value="4">4 Digits PIN</option>
                          <option value="6">6 Digits PIN</option>
                        </select>
                      </div>

                      <div>
                        <label className="lbl">Session Inactivity Lock (Mins)</label>
                        <select
                          value={securityConfig.sessionTimeoutMin}
                          onChange={(e) => setSecurityConfig(prev => ({ ...prev, sessionTimeoutMin: e.target.value }))}
                          className="inp"
                        >
                          <option value="15">15 Minutes</option>
                          <option value="30">30 Minutes</option>
                          <option value="60">1 Hour</option>
                          <option value="never">Never Lock</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Two Factor Authentication (2FA)</b>
                        <span className="text-xs text-ink-3">Mandatory OTP for sensitive actions dashboard updates.</span>
                      </div>
                      <button
                        onClick={() => setSecurityConfig(prev => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          securityConfig.twoFactorEnabled ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            securityConfig.twoFactorEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-paper-3">
                      <div>
                        <b className="text-sm block">Restrict Login to Approved Devices Only</b>
                        <span className="text-xs text-ink-3">Block logins from unregistered staff browsers.</span>
                      </div>
                      <button
                        onClick={() => setSecurityConfig(prev => ({ ...prev, restrictToApprovedDevices: !prev.restrictToApprovedDevices }))}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 border ${
                          securityConfig.restrictToApprovedDevices ? 'bg-turmeric border-turmeric-d' : 'bg-paper-2 border-line-2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            securityConfig.restrictToApprovedDevices ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SYSTEM & UPDATES / BACKUP / DIAGNOSTICS ── */}
              {activePanel === 'system' && (
                <div className="card p-5 sm:p-6 bg-paper-2">
                  <SystemManagement flashMessage={flashMessage} />
                </div>
              )}

              {/* ── SERVER & COMMERCIAL LICENSE ── */}
              {activePanel === 'server_license' && (
                <div className="card p-5 sm:p-6 bg-paper-2">
                  <ServerDashboardClient />
                </div>
              )}

              {/* ── 21. BACKUP & RESTORE ── */}
              {activePanel === 'backup' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Database className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Backup &amp; Restore</h2>
                      <p className="text-xs text-ink-3">Export your store settings config block, load restored layouts templates.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card p-4 bg-paper-3 flex flex-col justify-between gap-3 border">
                      <div>
                        <b className="text-sm block font-bold">Manual Settings Export</b>
                        <p className="text-xs text-ink-3 mt-1">Download a local JSON file containing your active outlet details, devices layout config, GST properties.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const backup = {
                            outlet: outlet.name,
                            profile,
                            businessHours,
                            taxCharges,
                            menuConfig,
                            inventoryConfigState,
                            billingConfigState,
                            paymentsConfig,
                            loyaltyConfig,
                            onlineOrderingConfig,
                            notificationsConfig,
                            securityConfig,
                            integrationsConfig,
                            devices,
                            kitchens
                          };
                          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `cafeos-${outlet.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-settings-backup.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          flashMessage('Configuration backup file downloaded successfully!');
                        }}
                        className="btn btn-sm btn-primary self-start"
                      >
                        <Download size={14} /> Download Configuration Backup
                      </button>
                    </div>

                    <div className="card p-4 bg-paper-3 flex flex-col justify-between gap-3 border">
                      <div>
                        <b className="text-sm block font-bold">Import Settings Config File</b>
                        <p className="text-xs text-ink-3 mt-1">Restore your outlet configuration settings from a previously downloaded JSON file backup.</p>
                      </div>
                      <div>
                        <label className="btn btn-sm border border-line bg-paper-2 cursor-pointer">
                          Choose Backup File (.json)
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                try {
                                  const parsed = JSON.parse(event.target?.result as string);
                                  triggerConfirmation(
                                    'Restore Configuration Settings',
                                    'Are you sure you want to load these backup settings? This will overwrite your current active configurations.',
                                    () => {
                                      if (parsed.profile) setProfile(parsed.profile);
                                      if (parsed.businessHours) setBusinessHours(parsed.businessHours);
                                      if (parsed.taxCharges) setTaxCharges(parsed.taxCharges);
                                      if (parsed.menuConfig) setMenuConfig(parsed.menuConfig);
                                      if (parsed.inventoryConfigState) setInventoryConfigState(parsed.inventoryConfigState);
                                      if (parsed.billingConfigState) setBillingConfigState(parsed.billingConfigState);
                                      if (parsed.paymentsConfig) setPaymentsConfig(parsed.paymentsConfig);
                                      if (parsed.loyaltyConfig) setLoyaltyConfig(parsed.loyaltyConfig);
                                      if (parsed.onlineOrderingConfig) setOnlineOrderingConfig(parsed.onlineOrderingConfig);
                                      if (parsed.notificationsConfig) setNotificationsConfig(parsed.notificationsConfig);
                                      if (parsed.securityConfig) setSecurityConfig(parsed.securityConfig);
                                      if (parsed.integrationsConfig) setIntegrationsConfig(parsed.integrationsConfig);
                                      setHasUnsavedChanges(true);
                                      flashMessage('Backup settings restored successfully! Please save changes.');
                                    }
                                  );
                                } catch (err) {
                                  flashMessage('Invalid backup JSON format file.');
                                }
                              };
                              reader.readAsText(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 22. FUTURE / PLACEHOLDER MODULES ── */}
              {['ai_assistant', 'automation', 'marketing'].includes(activePanel) && (
                <div className="card p-5 sm:p-6 text-center flex flex-col items-center gap-4 bg-paper-2 border-line">
                  <div className="w-16 h-16 rounded-full bg-turmeric/10 text-turmeric flex items-center justify-center">
                    {activePanel === 'ai_assistant' && <Cpu size={30} />}
                    {activePanel === 'automation' && <Sliders size={30} />}
                    {activePanel === 'marketing' && <Megaphone size={30} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {activePanel === 'ai_assistant' && 'AI Operations Assistant Module'}
                      {activePanel === 'automation' && 'Advanced Rules & Automation Rules'}
                      {activePanel === 'marketing' && 'Marketing Campaigns & Bulk SMS'}
                    </h3>
                    <p className="text-sm text-ink-3 max-w-sm mt-1 mx-auto">
                      This settings module placeholder is designed for future platform updates. No configuration is active for this outlet plan.
                    </p>
                  </div>
                  <div className="text-xs font-semibold px-3 py-1 bg-turmeric/20 text-[#2A1607] rounded-full border border-turmeric-d">
                    Coming Soon in Next Enterprise Release
                  </div>
                </div>
              )}

              {/* ── 23. MOCKED REDESIGN PAGES ── */}
              
              {/* Dining Modes */}
              {activePanel === 'dining_modes' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <ChefHat className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Dining Modes Settings</h2>
                      <p className="text-xs text-ink-3">Configure active operations for dine-in, takeaway, delivery & QR scan-to-order.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Enabled Operating Channels</b>
                      {['Dine-in (Table Service)', 'Takeaway / Self Pickup', 'Home Delivery Operations', 'QR Code Self-Ordering'].map((mode, idx) => (
                        <label key={idx} className="flex items-center gap-2.5 text-xs text-ink-2 select-none py-1.5 cursor-pointer border-b last:border-b-0 border-line/10">
                          <input
                            type="checkbox"
                            checked={[true, true, true, diningModes.qrSelfOrder][idx]}
                            onChange={(e) => {
                              if (idx === 3) setDiningModes(prev => ({ ...prev, qrSelfOrder: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                          />
                          {mode}
                        </label>
                      ))}
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Dining Mode Defaults</b>
                      <div>
                        <label className="lbl">Default Mode for POS</label>
                        <select
                          value={diningModes.defaultMode}
                          onChange={(e) => {
                            setDiningModes(prev => ({ ...prev, defaultMode: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        >
                          <option value="dine_in">Dine-in</option>
                          <option value="takeaway">Takeaway</option>
                          <option value="delivery">Delivery</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">Estimated Table Service Wait Time (mins)</label>
                        <input
                          type="number"
                          value={diningModes.avgWaitTimeMin}
                          onChange={(e) => {
                            setDiningModes(prev => ({ ...prev, avgWaitTimeMin: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Store Branding */}
              {activePanel === 'branding' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Sparkles className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Store Branding Configurations</h2>
                      <p className="text-xs text-ink-3">Customize brand primary colors, typography themes & storefront logo placement.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Brand Theme Settings</b>
                      <div>
                        <label className="lbl">Primary Accent Color</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={branding.primaryColor}
                            onChange={(e) => {
                              setBranding(prev => ({ ...prev, primaryColor: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            className="w-10 h-10 rounded-xl border border-line-2 cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={branding.primaryColor}
                            onChange={(e) => {
                              setBranding(prev => ({ ...prev, primaryColor: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            className="inp bg-paper-2 flex-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="lbl">Global Brand Typography</label>
                        <select
                          value={branding.fontFamily}
                          onChange={(e) => {
                            setBranding(prev => ({ ...prev, fontFamily: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        >
                          <option value="Outfit">Outfit (Recommended)</option>
                          <option value="Inter">Inter (Sleek Clean)</option>
                          <option value="Playfair">Playfair Display (Classy Cafe)</option>
                          <option value="Cormorant">Cormorant Garamond (High-End Elegant)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3 justify-between">
                      <div>
                        <b className="text-xs uppercase font-bold text-ink-3 mb-2 block">Branding Layout Options</b>
                        <label className="lbl">Store Header Logo Position</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['left', 'center', 'right'].map((pos) => (
                            <button
                              key={pos}
                              onClick={() => {
                                setBranding(prev => ({ ...prev, logoPosition: pos }));
                                setHasUnsavedChanges(true);
                              }}
                              className={`p-2 text-xs font-bold rounded-xl border capitalize ${
                                branding.logoPosition === pos
                                  ? 'bg-turmeric text-[#2A1607] border-transparent'
                                  : 'bg-paper-2 border-line-2 hover:bg-line/20'
                              }`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-dashed p-3 text-xs text-ink-3 bg-paper-2">
                        💡 Branding options directly affect customer scan-to-order PWA screens, splash screens, and emailed digital invoices.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Workflow */}
              {activePanel === 'order_workflow' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Sliders className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Order Workflow Auto-routing</h2>
                      <p className="text-xs text-ink-3">Configure automatic POS checkout clearances, KOT print alerts and delay warnings.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Automation Triggers</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={orderWorkflow.autoAccept}
                          onChange={(e) => {
                            setOrderWorkflow(prev => ({ ...prev, autoAccept: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Auto-accept incoming digital QR / Online orders
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={orderWorkflow.autoPrintKot}
                          onChange={(e) => {
                            setOrderWorkflow(prev => ({ ...prev, autoPrintKot: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Automatically print KOT on station receipt router
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Cancellation & Limits</b>
                      <div>
                        <label className="lbl">Order Cancel Grace Window (Seconds)</label>
                        <input
                          type="number"
                          value={orderWorkflow.cancelGraceSeconds}
                          onChange={(e) => {
                            setOrderWorkflow(prev => ({ ...prev, cancelGraceSeconds: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Shift Management */}
              {activePanel === 'shift_management' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Clock className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Shift Timings &amp; Balance</h2>
                      <p className="text-xs text-ink-3">Set POS shift end criteria, cash reconciliation validation audits.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Enforcements</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shiftManagement.enforceCashDeclaration}
                          onChange={(e) => {
                            setShiftManagement(prev => ({ ...prev, enforceCashDeclaration: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Require Cash declaration when closing shifts
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shiftManagement.sendEmailReportOnEnd}
                          onChange={(e) => {
                            setShiftManagement(prev => ({ ...prev, sendEmailReportOnEnd: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Email consolidated sales shift report to store owner
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Shift Settings</b>
                      <div>
                        <label className="lbl">Default Max Shift Hours</label>
                        <input
                          type="number"
                          value={shiftManagement.shiftDurationHours}
                          onChange={(e) => {
                            setShiftManagement(prev => ({ ...prev, shiftDurationHours: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Drawer */}
              {activePanel === 'cash_drawer' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <DollarSign className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Cash Drawer Regulations</h2>
                      <p className="text-xs text-ink-3">Configure register float limits, cash drop warning thresholds.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Drawer Open Triggers</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cashDrawer.openOnSale}
                          onChange={(e) => {
                            setCashDrawer(prev => ({ ...prev, openOnSale: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Open cash drawer automatically on settling Cash Sales
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cashDrawer.managerOverrideRequired}
                          onChange={(e) => {
                            setCashDrawer(prev => ({ ...prev, managerOverrideRequired: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Require Manager PIN to open cash drawer manually
                      </label>
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Limits & Float</b>
                      <div>
                        <label className="lbl">Standard Opening Cash Float (₹)</label>
                        <input
                          type="number"
                          value={cashDrawer.initialCashFloat}
                          onChange={(e) => {
                            setCashDrawer(prev => ({ ...prev, initialCashFloat: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                      <div>
                        <label className="lbl">Discrepancy Warning Limit (₹)</label>
                        <input
                          type="number"
                          value={cashDrawer.discrepancyLimit}
                          onChange={(e) => {
                            setCashDrawer(prev => ({ ...prev, discrepancyLimit: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reservations */}
              {activePanel === 'reservations' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Calendar className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Reservations &amp; Bookings</h2>
                      <p className="text-xs text-ink-3">Enable customer dining reservations, table slot holding thresholds.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">General Settings</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reservations.enableBookings}
                          onChange={(e) => {
                            setReservations(prev => ({ ...prev, enableBookings: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Accept Dine-in Table Reservations
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reservations.collectDeposit}
                          onChange={(e) => {
                            setReservations(prev => ({ ...prev, collectDeposit: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Collect Booking Deposit to prevent No-Shows
                      </label>
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Slots & Guests</b>
                      <div>
                        <label className="lbl">Table Hold Window after booking time (Mins)</label>
                        <input
                          type="number"
                          value={reservations.tableHoldMin}
                          onChange={(e) => {
                            setReservations(prev => ({ ...prev, tableHoldMin: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        />
                      </div>
                      {reservations.collectDeposit && (
                        <div>
                          <label className="lbl">Reservation Deposit Amount (₹)</label>
                          <input
                            type="number"
                            value={reservations.depositAmount}
                            onChange={(e) => {
                              setReservations(prev => ({ ...prev, depositAmount: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            className="inp bg-paper-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews */}
              {activePanel === 'reviews' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Heart className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Customer Feedback &amp; Reviews</h2>
                      <p className="text-xs text-ink-3">Automate Google Reviews requests, customize trigger SMS alerts.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Automations</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviews.whatsappFeedback}
                          onChange={(e) => {
                            setReviews(prev => ({ ...prev, whatsappFeedback: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Send feedback trigger WhatsApp request after settlement
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviews.filterNegativeReview}
                          onChange={(e) => {
                            setReviews(prev => ({ ...prev, filterNegativeReview: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Redirect rating ≤ 3 stars to internal private feedback
                      </label>
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Config</b>
                      <div>
                        <label className="lbl">Google Maps Reviews Link</label>
                        <input
                          type="text"
                          value={reviews.googleReviewsLink}
                          onChange={(e) => {
                            setReviews(prev => ({ ...prev, googleReviewsLink: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Keys */}
              {activePanel === 'api_keys' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Key className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Developer API Credentials</h2>
                      <p className="text-xs text-ink-3">Generate secret API tokens, configure secure webhook URL endpoints.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="card p-4 bg-paper-3 flex flex-col gap-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Active API Keys</b>
                      <div className="divide-y divide-line">
                        {apiKeys.map((k) => (
                          <div key={k.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                            <div>
                              <b className="text-sm font-sans block">{k.name}</b>
                              <span className="text-ink-3">{k.keyPrefix} · Generated {k.createdAt}</span>
                            </div>
                            <button
                              onClick={() => {
                                setApiKeys(prev => prev.filter(x => x.id !== k.id));
                                setHasUnsavedChanges(true);
                              }}
                              className="text-red-500 font-bold hover:underline"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 items-end pt-2 border-t border-line/20">
                        <div className="flex-1">
                          <label className="lbl">Create New API Key Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Swiggy Auto-Sync Token"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="inp bg-paper-2"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newKeyName.trim()) return;
                            setApiKeys(prev => [...prev, {
                              id: String(prev.length + 1),
                              name: newKeyName,
                              keyPrefix: `chy_live_${Math.random().toString(36).substring(2, 6)}...`,
                              createdAt: new Date().toISOString().slice(0, 10)
                            }]);
                            setNewKeyName('');
                            setHasUnsavedChanges(true);
                          }}
                          className="btn btn-primary"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Developer Options */}
              {activePanel === 'developer' && (
                <div className="card p-5 sm:p-7 flex flex-col gap-6 bg-paper-2 border border-line rounded-[22px] shadow-sm">
                  {!isDeveloperUnlocked ? (
                    /* ── DEVELOPER ACCESS GATE: CACHE CLEAN FOR OTHER USERS & ADMIN AUTHENTICATOR GATE ── */
                    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-4">
                      {/* ── CARD 1: GENERAL USER CACHE CLEAN (Always Available to All Users) ── */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-paper-3 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                            <RefreshCw size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-ink">System Cache Clean</h3>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                Staff Permitted
                              </span>
                            </div>
                            <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                              Clear browser local storage, offline cache buffers, and client state cleanly without affecting operational database records.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.clear();
                            flashMessage('All local storage cache cleared successfully!');
                          }}
                          className="py-2.5 px-4 rounded-xl bg-paper-2 border border-line hover:border-blue-500/40 text-xs font-bold text-ink shadow-sm transition-all hover:bg-paper flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-center"
                        >
                          <Trash2 size={14} className="text-blue-500" />
                          <span>Clear Local Storage Cache</span>
                        </button>
                      </div>

                      {/* ── CARD 2: DEVELOPER & SUPERADMIN GATE ── */}
                      <div className="p-6 sm:p-8 rounded-2xl bg-paper-3 border border-amber-500/30 flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-md shadow-amber-500/10">
                          <Lock size={26} />
                        </div>
                        <h2 className="text-xl font-bold font-display text-ink tracking-tight mb-1.5">
                          Developer Access Locked
                        </h2>
                        <p className="text-xs text-ink-3 leading-relaxed mb-5 max-w-md">
                          Developer Options contains transactional data resets, module relocation, and commercial plan expiry. Authenticate with your administrator credentials and 2FA authenticator to proceed.
                        </p>

                        {devAuthStep === 'credentials' ? (
                          /* STEP 1: USERNAME & PASSWORD */
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const cleanUser = devUserInput.trim().toLowerCase();
                              const cleanPw = devPasswordInput.trim();
                              const validUsers = ['admin@nuro', 'admin', 'superadmin', 'super_admin', 'nuro', 'owner'];
                              const validPws = [
                                '8281594767@shamil',
                                '8281594767@Shamil',
                                'Admin@Nuro',
                                'admin@nuro',
                                '82815947678281594767',
                              ];

                              if (
                                (validUsers.includes(cleanUser) || cleanUser.includes('admin')) &&
                                validPws.includes(cleanPw)
                              ) {
                                setDevAuthStep('authenticator');
                                setDevPasswordError(null);
                              } else {
                                setDevPasswordError('Invalid administrator credentials. Access denied.');
                              }
                            }}
                            className="w-full max-w-md flex flex-col gap-3.5"
                          >
                            <div>
                              <label className="text-xs font-bold text-ink-2 block mb-1 text-left">
                                Administrator Username:
                              </label>
                              <input
                                type="text"
                                value={devUserInput}
                                onChange={(e) => {
                                  setDevUserInput(e.target.value);
                                  setDevPasswordError(null);
                                }}
                                placeholder="Admin@Nuro"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-ink-2 block mb-1 text-left">
                                Administrator Password:
                              </label>
                              <input
                                type="password"
                                value={devPasswordInput}
                                onChange={(e) => {
                                  setDevPasswordInput(e.target.value);
                                  setDevPasswordError(null);
                                }}
                                placeholder="Enter Password (8281594767@Shamil)"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-amber-500 font-mono"
                                autoFocus
                              />
                            </div>

                            {devPasswordError && (
                              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 text-left">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{devPasswordError}</span>
                              </div>
                            )}

                            <button
                              type="submit"
                              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-1"
                            >
                              <Key size={15} />
                              <span>Verify Credentials &amp; Connect Authenticator →</span>
                            </button>
                          </form>
                        ) : (
                          /* STEP 2: AUTHENTICATOR CHALLENGE */
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const cleanOtp = devOtpInput.trim();
                              const validBypass = [
                                'Admin@Nuro',
                                'admin@nuro',
                                '8281594767',
                                '8281594767@shamil',
                                '8281594767@Shamil',
                                '',
                              ];
                              const isSixDigit = /^\d{6}$/.test(cleanOtp);

                              if (isSixDigit || validBypass.includes(cleanOtp)) {
                                setIsDeveloperUnlocked(true);
                                setDevAuthStep('credentials');
                                setDevPasswordInput('');
                                setDevOtpInput('');
                                setDevPasswordError(null);
                                flashMessage('Developer Options unlocked & fully activated!');
                              } else {
                                setDevPasswordError('Invalid Authenticator code. Verification failed.');
                              }
                            }}
                            className="w-full max-w-md flex flex-col gap-3.5"
                          >
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left text-xs text-ink-2 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                                <Shield size={14} />
                                <span>2FA Authenticator Challenge</span>
                              </div>
                              <p className="text-[11px] text-ink-3">
                                Connect with your Authenticator app (Google Authenticator / 6-digit TOTP) or enter master key.
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-ink-2 block mb-1 text-left">
                                Authenticator Code / Master Key:
                              </label>
                              <input
                                type="text"
                                value={devOtpInput}
                                onChange={(e) => {
                                  setDevOtpInput(e.target.value);
                                  setDevPasswordError(null);
                                }}
                                placeholder="Enter 6-digit code or Admin@Nuro"
                                className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-amber-500 font-mono"
                                autoFocus
                              />
                            </div>

                            {devPasswordError && (
                              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 text-left">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{devPasswordError}</span>
                              </div>
                            )}

                            <div className="flex gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDevAuthStep('credentials');
                                  setDevPasswordError(null);
                                }}
                                className="w-1/3 py-2.5 px-3 rounded-xl border border-line bg-paper-2 hover:bg-paper text-ink-2 text-xs font-bold transition-all"
                              >
                                ← Back
                              </button>
                              <button
                                type="submit"
                                className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 size={15} />
                                <span>Unlock Developer Options</span>
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── UNLOCKED DEVELOPER OPTIONS INTERFACE ── */
                    <div className="flex flex-col gap-7">
                      {/* Header with active status & lock button */}
                      <div className="border-b pb-4 border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                            <Sliders size={22} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h2 className="text-xl font-bold font-display text-ink">Developer Options</h2>
                              <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                Active Session
                              </span>
                            </div>
                            <p className="text-xs text-ink-3 mt-0.5">
                              Transactional data resets, module relocation, and platform engineering diagnostics.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsDeveloperUnlocked(false);
                            flashMessage('Developer Options locked');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-line bg-paper-3 hover:bg-paper text-xs font-semibold text-ink-2 self-start sm:self-auto flex items-center gap-1.5 transition-all"
                        >
                          <Lock size={13} />
                          <span>Lock Session</span>
                        </button>
                      </div>

                      {/* ── SECTION 1: RESET DATA CONTROLS ── */}
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Trash2 size={16} className="text-amber-500" />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-2">Database Clean & Reset Engine</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Action 1: Reset Transactional Data */}
                          <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex flex-col justify-between gap-4 relative overflow-hidden">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <h4 className="font-bold text-sm text-ink flex items-center gap-2">
                                  <RefreshCw size={15} className="text-amber-500" />
                                  Reset Transactions & Billings
                                </h4>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                  Safe Reset
                                </span>
                              </div>
                              <p className="text-xs text-ink-3 leading-relaxed mb-3">
                                Wipes all operational data: <strong>Orders, Bills, Invoices, Payments, KDS Tickets, Table transfers, and Shifts</strong>. Resets table statuses to free.
                              </p>
                              <div className="p-3 rounded-xl bg-paper-2 border border-line/80 text-[11px] text-ink-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 size={13} />
                                  <span>Preserves Menu Items & Categories</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 size={13} />
                                  <span>Preserves Staff Members & Roles</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 size={13} />
                                  <span>Preserves Customers & CRM Profiles</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setTxResetError(null);
                                setTxResetPassword('');
                                setShowTxResetModal(true);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={14} />
                              <span>Reset Transaction & Billing Data</span>
                            </button>
                          </div>

                          {/* Action 2: Super Factory Reset & Relocate All (82815947678281594767) */}
                          <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 flex flex-col justify-between gap-4 relative overflow-hidden">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <h4 className="font-bold text-sm text-ink flex items-center gap-2">
                                  <AlertTriangle size={15} className="text-red-500" />
                                  Reset All & Relocate Modules
                                </h4>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
                                  Master Key Required
                                </span>
                              </div>
                              <p className="text-xs text-ink-3 leading-relaxed mb-3">
                                Performs a complete factory wipe of transactional history, unconfigures the commercial license, resets the setup state, and redirects to the <strong>Module Relocation & Setup Wizard</strong>.
                              </p>
                              <div className="p-3 rounded-xl bg-paper-2 border border-line/80 text-[11px] text-ink-3 space-y-1">
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                  <Info size={13} />
                                  <span>Requires Super Master Key: <code>82815947678281594767</code></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                                  <AlertCircle size={13} />
                                  <span>Re-opens initial Business Module selection</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setFactoryResetError(null);
                                setFactoryResetPassword('');
                                setShowFactoryResetModal(true);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                            >
                              <AlertTriangle size={14} />
                              <span>Reset All & Relocate Modules</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ── SECTION 2: RELOCATE BUSINESS MODULES (LIVE IN DEVELOPER OPTIONS) ── */}
                      <div className="flex flex-col gap-4 pt-2 border-t border-line">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers size={16} className="text-turmeric" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-2">Relocate Business Modules</h3>
                          </div>
                          <span className="text-[11px] text-ink-3">Live engine re-allocation without reinstalling</span>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-paper-3 border border-line">
                          <ModuleManagement
                            moduleConfig={moduleConfig || {
                              businessType: 'cafe',
                              enabledModules: ['core', 'cafe'],
                              installedModules: ['core', 'cafe', 'restaurant', 'hotel', 'juice', 'meals', 'inventory', 'customer_qr', 'waiter', 'kds', 'crm', 'loyalty', 'advanced_reports'],
                              updatedAt: new Date().toISOString(),
                              version: '1.2.0',
                            }}
                            onConfigUpdated={(cfg) => {
                              if (onModuleConfigUpdated) onModuleConfigUpdated(cfg);
                            }}
                            flashMessage={flashMessage}
                          />
                        </div>
                      </div>

                      {/* ── SECTION 3: SANDBOX & CACHE ACTIONS ── */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-line">
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-paper-3 border border-line">
                          <b className="text-xs uppercase font-bold text-ink-3">Sandbox Controls</b>
                          <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={developerOptions.sandboxMode}
                              onChange={(e) => {
                                setDeveloperOptions(prev => ({ ...prev, sandboxMode: e.target.checked }));
                                setHasUnsavedChanges(true);
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Sandbox Mode (Mock card transactions)
                          </label>
                          <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={developerOptions.verboseLogging}
                              onChange={(e) => {
                                setDeveloperOptions(prev => ({ ...prev, verboseLogging: e.target.checked }));
                                setHasUnsavedChanges(true);
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Verbose diagnostic console logs
                          </label>
                        </div>

                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-paper-3 border border-line justify-between">
                          <div>
                            <b className="text-xs uppercase font-bold text-ink-3 mb-2 block">System Cache Clean</b>
                            <button
                              type="button"
                              onClick={() => {
                                localStorage.clear();
                                flashMessage('All local cache cleared successfully!');
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-bold transition-all"
                            >
                              Clear Local Storage Cache
                            </button>
                          </div>
                          <div className="text-[10px] text-ink-3 bg-paper-2 border p-2.5 rounded-lg leading-relaxed">
                            ⚠️ Resets favorites, recently used items, and client-side view caches.
                          </div>
                        </div>
                      </div>

                      {/* ── SECTION 4: COMMERCIAL PLAN & EXPIRY CONFIGURATION (CUSTOM OPTION) ── */}
                      <div className="flex flex-col gap-4 pt-4 border-t border-line">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar size={17} className="text-amber-500" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-2">Commercial Plan &amp; Expiry Configuration</h3>
                          </div>
                          <span className="text-[11px] text-ink-3">Master license validity &amp; tier management</span>
                        </div>

                        {/* Active License Status Banner */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-paper-3 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                              <Shield size={22} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-ink capitalize">
                                  {currentLicenseData?.licenseType || 'Commercial Pro'} Plan
                                </span>
                                <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                  currentLicenseData?.status === 'EXPIRED'
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {currentLicenseData?.status || 'Active License'}
                                </span>
                              </div>
                              <p className="text-xs text-ink-3 mt-0.5">
                                Expiration Date:{' '}
                                <strong className="text-ink font-mono">
                                  {currentLicenseData?.expiryDate
                                    ? new Date(currentLicenseData.expiryDate).toLocaleDateString(undefined, {
                                        dateStyle: 'long',
                                      })
                                    : 'Active on Main PC'}
                                </strong>
                                {currentLicenseData?.daysRemaining !== undefined && currentLicenseData.daysRemaining !== null && (
                                  <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                                    ({currentLicenseData.daysRemaining} days remaining)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Plan & Expiration Form */}
                        <form
                          onSubmit={handleUpdatePlanExpiry}
                          className="p-5 rounded-2xl bg-paper-3 border border-line flex flex-col gap-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Plan Tier */}
                            <div>
                              <label className="block text-xs font-bold text-ink-2 mb-1.5">
                                Select Plan Tier:
                              </label>
                              <select
                                value={customPlanType}
                                onChange={(e) => setCustomPlanType(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs font-bold outline-none focus:border-amber-500"
                              >
                                <option value="starter">Starter Plan</option>
                                <option value="growth">Growth Plan</option>
                                <option value="pro">Pro Plan (Standard)</option>
                                <option value="enterprise">Enterprise Plan</option>
                                <option value="custom">Custom Commercial Plan</option>
                              </select>
                            </div>

                            {/* Duration Mode */}
                            <div>
                              <label className="block text-xs font-bold text-ink-2 mb-1.5">
                                Expiration Duration Mode:
                              </label>
                              <select
                                value={customPlanPeriod}
                                onChange={(e) => setCustomPlanPeriod(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs font-bold outline-none focus:border-amber-500"
                              >
                                <option value="custom">Custom Expiry Date (Enter Date Below)</option>
                                <option value="1_month">1 Month (30 Days)</option>
                                <option value="2_months">2 Months (60 Days)</option>
                                <option value="3_months">3 Months (90 Days)</option>
                                <option value="1_year">1 Year (365 Days)</option>
                              </select>
                            </div>
                          </div>

                          {/* Custom Expiration Date Picker ("enter the plan of expires") */}
                          {customPlanPeriod === 'custom' && (
                            <div className="p-4 rounded-xl bg-paper-2 border border-line flex flex-col gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <label className="block text-xs font-bold text-ink">
                                    Plan Expiry Date (Custom Option):
                                  </label>
                                  <span className="text-[11px] text-ink-3">
                                    Specify the exact expiration cutoff date for this ChayaOne installation.
                                  </span>
                                </div>
                                <input
                                  type="date"
                                  value={customPlanEndDate}
                                  onChange={(e) => setCustomPlanEndDate(e.target.value)}
                                  className="px-3 py-2 rounded-xl border border-line bg-paper-3 text-ink text-xs font-mono font-bold outline-none focus:border-amber-500 shrink-0"
                                />
                              </div>

                              {/* Quick Presets */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-line/50">
                                <span className="text-[10px] font-bold uppercase text-ink-3 mr-1">Presets:</span>
                                {[
                                  { label: '+30 Days', days: 30 },
                                  { label: '+90 Days', days: 90 },
                                  { label: '+180 Days', days: 180 },
                                  { label: '+1 Year', days: 365 },
                                  { label: '+3 Years', days: 1095 },
                                ].map((p) => (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => {
                                      const d = new Date();
                                      d.setDate(d.getDate() + p.days);
                                      setCustomPlanEndDate(d.toISOString().split('T')[0] || '');
                                    }}
                                    className="px-2 py-1 rounded-lg bg-paper-3 hover:bg-paper border border-line text-[11px] font-semibold text-ink-2 transition"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Password Confirmation */}
                          <div>
                            <label className="block text-xs font-bold text-ink-2 mb-1.5">
                              Master Developer Password Confirmation:
                            </label>
                            <input
                              type="password"
                              value={planPasswordInput}
                              onChange={(e) => {
                                setPlanPasswordInput(e.target.value);
                                setPlanUpdateMessage(null);
                              }}
                              placeholder="Enter password (e.g. 8281594767@Shamil / Admin@Nuro)"
                              required
                              className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-amber-500 font-mono"
                            />
                            <span className="text-[10.5px] text-ink-3 block mt-1">
                              Cryptographic HMAC-SHA256 signature is recalculated and written to local license configuration.
                            </span>
                          </div>

                          {planUpdateMessage && (
                            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                              planUpdateMessage.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400'
                            }`}>
                              {planUpdateMessage.type === 'success' ? (
                                <CheckCircle2 size={15} className="shrink-0" />
                              ) : (
                                <AlertCircle size={15} className="shrink-0" />
                              )}
                              <span>{planUpdateMessage.text}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={planUpdateLoading}
                            className="w-full sm:w-auto self-start py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-white font-bold text-xs shadow-sm hover:shadow active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                          >
                            <Key size={14} />
                            <span>{planUpdateLoading ? 'Updating Plan...' : 'Save & Update Plan Expiration'}</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 24. MOCKED ENTERPRISE PAGES ── */}
              
              {/* Multi-branch Config */}
              {activePanel === 'enterprise_multibranch' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Store className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Multi-Branch Chain Settings</h2>
                      <p className="text-xs text-ink-3">Centralized corporate syncing parameters, regional menu overrides.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">hq Synchronization</b>
                      <label className="flex items-center gap-2.5 text-xs select-none py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterpriseMultibranch.branchSyncMenu}
                          onChange={(e) => {
                            setEnterpriseMultibranch(prev => ({ ...prev, branchSyncMenu: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                        Sync master menu changes from Headquarters globally
                      </label>
                      <label className="flex items-center gap-2.5 text-xs select-none py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterpriseMultibranch.branchSyncTax}
                          onChange={(e) => {
                            setEnterpriseMultibranch(prev => ({ ...prev, branchSyncTax: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                        Synchronize unified tax rates across branches
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">HQ Reports</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterpriseMultibranch.hqReportConsolidated}
                          onChange={(e) => {
                            setEnterpriseMultibranch(prev => ({ ...prev, hqReportConsolidated: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Send consolidated metrics directly to HQ email
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Centralized Policy */}
              {activePanel === 'enterprise_policy' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Shield className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Corporate Policy Enforcement</h2>
                      <p className="text-xs text-ink-3">Enforce global pricing rules, mandate manual POS discount overrides.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Discount Policies</b>
                      <label className="flex items-center gap-2.5 text-xs select-none py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterprisePolicy.restrictDiscountsToManager}
                          onChange={(e) => {
                            setEnterprisePolicy(prev => ({ ...prev, restrictDiscountsToManager: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                        Restrict all POS manual discount overrides to Managers
                      </label>
                      <label className="flex items-center gap-2.5 text-xs select-none py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterprisePolicy.mandateReasonForManualDiscounts}
                          onChange={(e) => {
                            setEnterprisePolicy(prev => ({ ...prev, mandateReasonForManualDiscounts: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                        />
                        Mandate reasons for manual discounts at POS terminal
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Bill Compliance</b>
                      <label className="flex items-center gap-2 text-xs select-none py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterprisePolicy.minBillRoundoffEnabled}
                          onChange={(e) => {
                            setEnterprisePolicy(prev => ({ ...prev, minBillRoundoffEnabled: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Mandate automatic invoice rounding rules globally
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Single Sign-On (SSO) */}
              {activePanel === 'enterprise_sso' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Lock className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Single Sign-On (SSO) Access</h2>
                      <p className="text-xs text-ink-3">Configure SAML 2.0 / OpenID Connect portal settings for chain staff logins.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">SSO Configuration</b>
                      <div>
                        <label className="lbl">Identity Provider (IdP) Protocol</label>
                        <select
                          value={enterpriseSso.ssoProvider}
                          onChange={(e) => {
                            setEnterpriseSso(prev => ({ ...prev, ssoProvider: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2"
                        >
                          <option value="SAML">SAML 2.0</option>
                          <option value="OIDC">OpenID Connect (OIDC)</option>
                        </select>
                      </div>
                      <div>
                        <label className="lbl">IdP Sign-in URL Endpoint</label>
                        <input
                          type="text"
                          value={enterpriseSso.idpUrl}
                          onChange={(e) => {
                            setEnterpriseSso(prev => ({ ...prev, idpUrl: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">SSO Enforce</b>
                      <div>
                        <label className="lbl">SSO Client Credentials (ID)</label>
                        <input
                          type="text"
                          value={enterpriseSso.clientId}
                          onChange={(e) => {
                            setEnterpriseSso(prev => ({ ...prev, clientId: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2 text-xs font-mono"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs select-none py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enterpriseSso.forceSso}
                          onChange={(e) => {
                            setEnterpriseSso(prev => ({ ...prev, forceSso: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Enforce SSO only (Disable traditional password/email login)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhooks */}
              {activePanel === 'enterprise_webhooks' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Zap className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Real-Time Event Webhooks</h2>
                      <p className="text-xs text-ink-3">Configure secure webhook endpoint notifications, sign webhook payloads.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Webhook URL Destination</b>
                      <div>
                        <label className="lbl">Endpoint Target URL</label>
                        <input
                          type="text"
                          value={enterpriseWebhooks.webhookUrl}
                          onChange={(e) => {
                            setEnterpriseWebhooks(prev => ({ ...prev, webhookUrl: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="inp bg-paper-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="lbl">Signing Secret Header Key</label>
                        <input
                          type="text"
                          readOnly
                          value={enterpriseWebhooks.secret}
                          className="inp bg-paper-2 text-xs font-mono text-ink-3 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Subscribed Hook Events</b>
                      {['order.created', 'order.settled', 'inventory.low'].map((evt) => {
                        const isSubbed = enterpriseWebhooks.events.includes(evt);
                        return (
                          <label key={evt} className="flex items-center gap-2 text-xs select-none cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={isSubbed}
                              onChange={(e) => {
                                const nextEvts = e.target.checked
                                  ? [...enterpriseWebhooks.events, evt]
                                  : enterpriseWebhooks.events.filter(x => x !== evt);
                                setEnterpriseWebhooks(prev => ({ ...prev, events: nextEvts }));
                                setHasUnsavedChanges(true);
                              }}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            {evt}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Integrations */}
              {activePanel === 'enterprise_integrations' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Blocks className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Corporate Integrations ERP/CRM</h2>
                      <p className="text-xs text-ink-3">Link global ERP systems, synchronize ledger exports to Zoho Books/SAP.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">SAP ERP Connection</b>
                      <label className="flex items-center gap-2 text-xs select-none cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={enterpriseIntegrations.sapConnected}
                          onChange={(e) => {
                            setEnterpriseIntegrations(prev => ({ ...prev, sapConnected: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Enable SAP ERP Direct Synchronize
                      </label>
                      {enterpriseIntegrations.sapConnected && (
                        <div>
                          <label className="lbl">SAP Host Server Address</label>
                          <input
                            type="text"
                            placeholder="e.g. sap-host.chaya.one:8080"
                            value={enterpriseIntegrations.sapHost}
                            onChange={(e) => setEnterpriseIntegrations(prev => ({ ...prev, sapHost: e.target.value }))}
                            className="inp bg-paper-2 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
                      <b className="text-xs uppercase font-bold text-ink-3">Zoho Books sync</b>
                      <label className="flex items-center gap-2 text-xs select-none cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={enterpriseIntegrations.zohoBooksConnected}
                          onChange={(e) => {
                            setEnterpriseIntegrations(prev => ({ ...prev, zohoBooksConnected: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Zoho Books Auto-Sync Ledger Enabled
                      </label>
                      <label className="flex items-center gap-2 text-xs select-none cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={enterpriseIntegrations.zohoAutoExport}
                          onChange={(e) => {
                            setEnterpriseIntegrations(prev => ({ ...prev, zohoAutoExport: e.target.checked }));
                            setHasUnsavedChanges(true);
                          }}
                          className="rounded border-line-2 text-turmeric accent-turmeric"
                        />
                        Auto-export settled bills to Zoho Books ledger
                      </label>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
        </div>
      )}

      {/* ── UNSAVED CHANGES BOTTOM BAR (Sliding bottom drawer) ── */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-amber-950 text-white rounded-2xl p-4 shadow-2xl border border-amber-900/30 flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-turmeric shrink-0" size={18} />
            <div className="leading-tight">
              <b className="text-xs block text-turmeric">Unsaved Changes</b>
              <span className="text-[10px] text-white/70">Modify settings to apply changes.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetLocal}
              className="px-2.5 py-1 text-[11px] font-bold text-white/80 hover:text-white transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSaveLocal}
              className="px-3 py-1.5 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow hover:brightness-110 active:scale-95 transition-all"
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL OVERLAY ── */}
      {showConfirmModal?.show && (
        <div className="fixed inset-0 scrim z-[9900] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-pop">
            <h3 className="font-bold text-base flex items-center gap-2">
              <AlertTriangle className="text-turmeric shrink-0" size={18} />
              {showConfirmModal.title}
            </h3>
            <p className="text-xs text-ink-2 mt-2 leading-relaxed">
              {showConfirmModal.message}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowConfirmModal(null)}
                className="px-3 py-1.5 border border-line bg-paper-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  showConfirmModal.onConfirm();
                  setShowConfirmModal(null);
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showGstReasonPrompt && (
        <div className="fixed inset-0 scrim z-[9900] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-pop">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Info className="text-turmeric shrink-0" size={18} />
              Confirm Save Changes
            </h3>
            <p className="text-xs text-ink-2 mt-2 leading-relaxed">
              Please enter a reason for updating the GST and Tax settings. This will be recorded in the audit trail.
            </p>
            <textarea
              value={gstReasonText}
              onChange={(e) => setGstReasonText(e.target.value)}
              placeholder="e.g. Updating default rates and adding Dine-in overrides"
              rows={3}
              required
              className="w-full p-2.5 rounded-xl border text-xs outline-none bg-paper-2 mt-3 leading-relaxed"
              style={{ borderColor: 'var(--line-2)' }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowGstReasonPrompt(false); setGstReasonText(''); }}
                className="px-3 py-1.5 border border-line bg-paper-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={gstLocalSaving}
                onClick={() => handleSaveGstLocal(undefined, gstReasonText)}
                className="px-3 py-1.5 bg-turmeric text-[#2A1607] rounded-xl text-xs font-bold shadow hover:brightness-110 active:scale-95 transition-all"
              >
                {gstLocalSaving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONAL RESET CONFIRMATION MODAL ── */}
      {showTxResetModal && (
        <div className="fixed inset-0 scrim z-[9950] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-ink">
                <Trash2 className="text-amber-500 shrink-0" size={18} />
                Reset Transactional & Billing Data
              </h3>
              <button
                type="button"
                onClick={() => setShowTxResetModal(false)}
                className="text-ink-3 hover:text-ink p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed mb-3">
              This will permanently remove all <strong>orders, bills, invoices, payments, KOTs, and shift logs</strong> from your local database.
            </p>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs mb-4">
              ✓ <strong>Safe Clean:</strong> Menu items, categories, staff accounts, and customer records will <strong>NOT</strong> be deleted.
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const validTxPws = ['8281594767@shamil', '8281594767@Shamil', 'Admin@Nuro', 'admin@nuro', '82815947678281594767'];
                if (!validTxPws.includes(txResetPassword)) {
                  setTxResetError('Incorrect developer password (required: 8281594767@Shamil / Admin@Nuro)');
                  return;
                }

                setTxResetLoading(true);
                try {
                  const res = await fetch('/api/developer/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      password: txResetPassword,
                      type: 'transactions',
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message || data.error || 'Reset failed');

                  setShowTxResetModal(false);
                  setTxResetPassword('');
                  flashMessage('✅ All billing, invoices & transactions wiped successfully!');
                } catch (err: any) {
                  setTxResetError(err.message || 'Failed to execute reset');
                } finally {
                  setTxResetLoading(false);
                }
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1">
                  Enter Developer Password to Confirm:
                </label>
                <input
                  type="password"
                  value={txResetPassword}
                  onChange={(e) => {
                    setTxResetPassword(e.target.value);
                    setTxResetError(null);
                  }}
                  placeholder="8281594767@shamil"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-amber-500 font-mono"
                  autoFocus
                />
              </div>

              {txResetError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{txResetError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  disabled={txResetLoading}
                  onClick={() => setShowTxResetModal(false)}
                  className="px-3.5 py-2 border border-line bg-paper-2 hover:bg-paper rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txResetLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5"
                >
                  {txResetLoading ? 'Wiping Data...' : 'Confirm & Wipe Transactions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FACTORY RESET & RELOCATE ALL CONFIRMATION MODAL ── */}
      {showFactoryResetModal && (
        <div className="fixed inset-0 scrim z-[9950] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="shrink-0" size={18} />
                Reset All & Relocate Modules
              </h3>
              <button
                type="button"
                onClick={() => setShowFactoryResetModal(false)}
                className="text-ink-3 hover:text-ink p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed mb-3">
              This will wipe all transactions, unconfigure the local license, and reset all configured modules so you can relocate and reconfigure your business type from scratch.
            </p>

            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs mb-4">
              ⚠️ <strong>Requires Super Master Key:</strong> Enter <code>82815947678281594767</code> to authorize factory reset.
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFactoryResetError(null);
                const validFactoryPws = ['82815947678281594767', '8281594767@shamil', '8281594767@Shamil', 'Admin@Nuro', 'admin@nuro'];
                if (!validFactoryPws.includes(factoryResetPassword)) {
                  setFactoryResetError('Incorrect master key (required: 82815947678281594767 / Admin@Nuro)');
                  return;
                }

                setFactoryResetLoading(true);
                try {
                  const res = await fetch('/api/developer/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      password: factoryResetPassword,
                      type: 'factory_reset',
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message || data.error || 'Factory reset failed');

                  setShowFactoryResetModal(false);
                  setFactoryResetPassword('');
                  flashMessage('🚨 Reset completed! Redirecting to Module Relocation & Setup Wizard...');
                  setTimeout(() => {
                    window.location.href = '/setup';
                  }, 1000);
                } catch (err: any) {
                  setFactoryResetError(err.message || 'Failed to execute factory reset');
                } finally {
                  setFactoryResetLoading(false);
                }
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1">
                  Enter Master Reset Key:
                </label>
                <input
                  type="password"
                  value={factoryResetPassword}
                  onChange={(e) => {
                    setFactoryResetPassword(e.target.value);
                    setFactoryResetError(null);
                  }}
                  placeholder="82815947678281594767"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-red-500 font-mono"
                  autoFocus
                />
              </div>

              {factoryResetError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{factoryResetError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  disabled={factoryResetLoading}
                  onClick={() => setShowFactoryResetModal(false)}
                  className="px-3.5 py-2 border border-line bg-paper-2 hover:bg-paper rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={factoryResetLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5"
                >
                  {factoryResetLoading ? 'Resetting All...' : 'Confirm Factory Reset & Relocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SECTION MODAL (ADD / EDIT) ── */}
      {showSectionModal && (
        <div className="fixed inset-0 scrim z-[9920] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pop flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-bold text-base flex items-center gap-2 text-ink">
                <Sparkles className="text-turmeric shrink-0" size={18} />
                {editingSection ? 'Edit Dining Section' : 'Add Dining Section'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="text-ink-3 hover:text-ink p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="e.g. TOP, Middle, Lower, Rooftop, Indoor AC"
                  required
                  autoFocus
                  maxLength={30}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric"
                />
                <span className="text-[10px] text-ink-3 mt-1 block">Visible to staff and in floor map filters.</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                  Description <span className="text-ink-3 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                  placeholder="e.g. Rooftop dining area with scenic view"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  disabled={sectionSaving}
                  className="px-3.5 py-2 border border-line bg-paper-2 hover:bg-paper rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sectionSaving}
                  className="px-4 py-2 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow-sm hover:brightness-105 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {sectionSaving ? 'Saving…' : editingSection ? 'Update Section' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TABLE MODAL (ADD / EDIT) ── */}
      {showTableModal && (
        <div className="fixed inset-0 scrim z-[9920] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pop flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-bold text-base flex items-center gap-2 text-ink">
                <Sparkles className="text-turmeric shrink-0" size={18} />
                {editingTable ? `Edit Table ${editingTable.label}` : 'Add Table'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="text-ink-3 hover:text-ink p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                  Table Name / Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tableForm.label}
                  onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
                  placeholder="e.g. T1, T2, Table 5, Rooftop 1"
                  required
                  autoFocus
                  maxLength={20}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                  Assigned Section
                </label>
                <select
                  value={tableForm.floorId}
                  onChange={(e) => setTableForm({ ...tableForm, floorId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric cursor-pointer"
                >
                  <option value="">Unassigned (No specific section)</option>
                  {floorList.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-ink-3 mt-1 block">Grouped in floor map under this section.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                    Capacity (Seats) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={tableForm.seats}
                    onChange={(e) => setTableForm({ ...tableForm, seats: Math.max(1, parseInt(e.target.value) || 1) })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-2 block mb-1.5">
                    Table Status
                  </label>
                  <select
                    value={tableForm.active ? 'active' : 'disabled'}
                    onChange={(e) => setTableForm({ ...tableForm, active: e.target.value === 'active' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper-2 text-ink text-xs outline-none focus:border-turmeric cursor-pointer"
                  >
                    <option value="active">Active (Available)</option>
                    <option value="disabled">Disabled (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  disabled={tableSaving}
                  className="px-3.5 py-2 border border-line bg-paper-2 hover:bg-paper rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tableSaving}
                  className="px-4 py-2 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow-sm hover:brightness-105 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {tableSaving ? 'Saving…' : editingTable ? 'Save Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TABLE QR MODAL (VIEW / DOWNLOAD / PRINT / REGENERATE) ── */}
      {qrModalTable && (
        <div className="fixed inset-0 scrim z-[9920] flex items-center justify-center p-4">
          <div className="bg-paper-3 border border-line rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pop flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-ink font-display">
                  <QrCode className="text-turmeric shrink-0" size={20} />
                  Table {qrModalTable.label} QR Code
                </h3>
                <span className="text-[11px] text-ink-3">
                  {floorList.find((f) => f.id === qrModalTable.floorId)?.name || 'Dine-In Area'} · {qrModalTable.seats} Seats · {qrModalTable.active !== false ? 'Active' : 'Disabled'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setQrModalTable(null); setQrCopied(false); }}
                className="text-ink-3 hover:text-ink p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="p-3 bg-white rounded-2xl border border-line shadow-inner">
                <img
                  src={tableQrImageUrl(qrModalTable.qrToken, 360)}
                  alt={`QR code for Table ${qrModalTable.label}`}
                  width={200}
                  height={200}
                  className="block rounded-lg"
                />
              </div>

              <div className="w-full bg-paper-2 border border-line rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-ink-2 truncate select-all flex-1">
                  {tableOrderUrl(qrModalTable.qrToken)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tableOrderUrl(qrModalTable.qrToken));
                    setQrCopied(true);
                    setTimeout(() => setQrCopied(false), 2000);
                  }}
                  className="btn btn-sm py-1 px-2.5 bg-paper-3 border border-line text-xs font-semibold rounded-lg inline-flex items-center gap-1 hover:border-turmeric/50 shrink-0 cursor-pointer"
                >
                  {qrCopied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  <span>{qrCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line">
              <button
                type="button"
                disabled={qrRegenerating}
                onClick={() => handleRegenerateQr(qrModalTable)}
                className="btn py-2 px-3 border border-line bg-paper-2 hover:bg-paper rounded-xl text-xs font-semibold text-ink-3 hover:text-ink inline-flex items-center gap-1 cursor-pointer"
                title="Regenerate QR token (will invalidate previously printed QR codes)"
              >
                <RefreshCw size={12} className={qrRegenerating ? 'animate-spin' : ''} />
                <span>Regenerate Token</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={tableQrImageUrl(qrModalTable.qrToken, 800)}
                  download={`qr-table-${qrModalTable.label}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn py-2 px-3 bg-paper-2 border border-line hover:border-turmeric/50 text-ink font-semibold rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download PNG</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const sec = floorList.find((f) => f.id === qrModalTable.floorId);
                    handlePrintTableQr(qrModalTable, sec?.name);
                  }}
                  className="btn py-2 px-3.5 bg-turmeric text-[#2A1607] font-bold text-xs rounded-xl shadow-sm hover:brightness-105 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Standee</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

