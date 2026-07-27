'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Store, Clock, Percent, BookOpen, ChefHat, Package, Receipt, CreditCard, Printer,
  Users, Smartphone, Truck, Bell, Shield, BarChart3, ClipboardList, Blocks, Zap,
  Lock, Database, Sparkles, Cpu, Sliders, Calendar, DollarSign, UserCheck, RefreshCw,
  AlertCircle, Trash2, Plus, Check, Search, ChevronRight, ChevronLeft, Info, X, Key,
  Heart, AlertTriangle, Play, HelpCircle, Megaphone, Download
} from 'lucide-react';
import type { Kitchen } from '@/lib/kitchens';
import type { Device } from '@/lib/devices';
import type { KitchenWorkflowConfig } from '@/lib/kitchenWorkflow';
import type { PwaConfig } from '@/lib/pwa';

// Section structure
interface SettingItem {
  key: string;
  label: string;
  desc: string;
  icon: React.ComponentType<any>;
  sensitive?: boolean;
  ownerOnly?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

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

export interface SettingSection {
  title: string;
  items: SettingItem[];
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Restaurant',
    items: [
      { key: 'general', label: 'Business Profile', desc: 'Store profile, branding & contact details', icon: Store, keywords: ['store', 'profile', 'address', 'city', 'pincode', 'currency', 'language', 'timezone', 'logo', 'gstin', 'website', 'email', 'phone', 'contact'] },
      { key: 'business_hours', label: 'Business Hours', desc: 'Opening, closing hours, breaks & festival timings', icon: Clock, keywords: ['time', 'opening', 'closing', 'weekly', 'holiday', 'festival', 'break', 'temporary closure', 'emergency'] },
      { key: 'tax', label: 'Tax & GST', desc: 'GSTIN, CGST/SGST, service & packaging charges', icon: Percent, sensitive: true, keywords: ['gstin', 'tax', 'cgst', 'sgst', 'igst', 'exclusive', 'inclusive', 'hsn', 'sac', 'composition', 'flat rate', 'billing', 'reports', 'audit'] },
      { key: 'menu', label: 'Menu Configuration', desc: 'Categories, variants, add-ons & happy hours', icon: BookOpen, keywords: ['veg', 'non-veg', 'dietary', 'combo', 'happy hours', 'discount', 'variants', 'add-ons'] },
      { key: 'floor', label: 'Floor & QR Codes', desc: 'Physical table layouts, QR generation & scans', icon: Sparkles, keywords: ['dining', 'table', 'section', 'layout', 'scan', 'qr code', 'branding', 'download qr'] },
      { key: 'dining_modes', label: 'Dining Modes', desc: 'Dine-in, takeaway, delivery & QR order settings', icon: ChefHat, keywords: ['dine-in', 'takeaway', 'delivery', 'qr order', 'modes', 'enable modes'] },
      { key: 'branding', label: 'Store Branding', desc: 'Branding colors, font themes & header styles', icon: Sparkles, keywords: ['brand', 'colors', 'font', 'theme', 'header', 'styling', 'customization'] }
    ]
  },
  {
    title: 'Operations',
    items: [
      { key: 'kitchen', label: 'Kitchen & KDS', desc: 'KDS screens, KOT printing, routing stations', icon: ChefHat, keywords: ['kds', 'kot', 'printer', 'routing', 'preparation', 'stations', 'workflow'] },
      { key: 'inventory', label: 'Inventory Settings', desc: 'Low stock alerts, waste logging, stock adjustment', icon: Package, keywords: ['stock', 'alerts', 'waste', 'deduction', 'adjustment', 'purchase order', 'low stock'] },
      { key: 'billing', label: 'Billing Configuration', desc: 'Receipt layout, invoice format, auto-print, duplicate bills', icon: Receipt, keywords: ['receipt', 'invoice', 'format', 'prefix', 'duplicate', 'reprint', 'round off'] },
      { key: 'payments', label: 'Payment Options', desc: 'Cash, card, UPI gateways, split & tips settings', icon: CreditCard, keywords: ['cash', 'card', 'upi', 'gateway', 'split', 'tips', 'percentages', 'settlement'] },
      { key: 'devices', label: 'Devices & Printers', desc: 'Receipt, kitchen, barcode printers & cash drawers', icon: Printer, keywords: ['printer', 'connection', 'usb', 'bluetooth', 'network', 'cash drawer', 'terminal'] },
      { key: 'order_workflow', label: 'Order Workflow', desc: 'Auto-acceptance, auto-routing & cancel timers', icon: Sliders, keywords: ['acceptance', 'routing', 'auto-cancel', 'timers', 'workflow', 'auto-accept'] },
      { key: 'shift_management', label: 'Shift Management', desc: 'Shift timings, cash declaration, shift-end reports', icon: Clock, keywords: ['shift', 'drawer balance', 'cash declaration', 'timings', 'reports'] },
      { key: 'cash_drawer', label: 'Cash Drawer', desc: 'Cash float, opening drawer triggers, discrepancy limits', icon: DollarSign, keywords: ['cash float', 'triggers', 'discrepancy', 'limit', 'drawer open'] }
    ]
  },
  {
    title: 'Customers',
    items: [
      { key: 'pwa', label: 'Customer App', desc: 'Web app design, splash screens, push notifications', icon: Smartphone, keywords: ['customer web app', 'splash screen', 'branding', 'push notifications', 'games'] },
      { key: 'loyalty', label: 'Customer & Loyalty', desc: 'Loyalty points ratio, birthday rewards, credits', icon: Users, keywords: ['loyalty points', 'rewards', 'birthday multiplier', 'credits', 'limit'] },
      { key: 'online_order', label: 'Online Ordering', desc: 'Pickup, delivery radius, partners & order timings', icon: Truck, keywords: ['pickup', 'delivery', 'radius', 'charge', 'minimum order', 'timing'] },
      { key: 'reservations', label: 'Reservations', desc: 'Enable bookings, dining slot intervals, table hold limits', icon: Calendar, keywords: ['booking', 'slots', 'hold limit', 'deposit', 'table hold', 'schedule'] },
      { key: 'notifications', label: 'Notifications Hub', desc: 'WhatsApp API, SMS, emails & push notifications settings', icon: Bell, keywords: ['whatsapp', 'sms', 'email', 'gateways', 'templates', 'daily summary'] },
      { key: 'reviews', label: 'Reviews', desc: 'Google reviews integration, auto WhatsApp review requests', icon: Heart, keywords: ['google reviews', 'reviews prompt', 'whatsapp feedback', 'ratings'] },
      { key: 'marketing', label: 'Marketing', desc: 'Bulk SMS, automated discount rule engine', icon: Megaphone, keywords: ['bulk sms', 'discounts', 'campaigns', 'promotions', 'offers'] }
    ]
  },
  {
    title: 'Administration',
    items: [
      { key: 'staff', label: 'Staff & Roles', desc: 'Role-based access control, POS PINs, custom roles', icon: Shield, sensitive: true, keywords: ['rbac', 'pin', 'roles', 'permissions', 'cashier', 'manager', 'waiter'] },
      { key: 'reports', label: 'Report Settings', desc: 'Visibility settings, scheduled email exports', icon: BarChart3, sensitive: true, keywords: ['visibility', 'email exports', 'sales summary', 'weekly report', 'closing'] },
      { key: 'audit', label: 'Audit Logs', desc: 'Security logging, changes history, deleted bills', icon: ClipboardList, sensitive: true, ownerOnly: true, keywords: ['security log', 'changes history', 'deleted bills', 'actions'] },
      { key: 'security', label: 'Security & Access', desc: '2FA, device approval restrictions, session timeouts', icon: Lock, sensitive: true, keywords: ['2fa', 'two factor', 'session timeout', 'approved devices', 'password'] },
      { key: 'integrations', label: 'Integrations', desc: 'Razorpay, PhonePe, Swiggy, Zomato, Zoho Books', icon: Blocks, sensitive: true, keywords: ['razorpay', 'phonepe', 'swiggy', 'zomato', 'zoho', 'tally', 'apis'] },
      { key: 'subscription', label: 'Subscription Plan', desc: 'SaaS licensing, usage trackers & billing history', icon: Zap, sensitive: true, keywords: ['licensing', 'plan', 'billing history', 'usage trackers', 'upgrade'] },
      { key: 'backup', label: 'Backup & Restore', desc: 'Manual & automatic db exports, import configs', icon: Database, sensitive: true, ownerOnly: true, keywords: ['database export', 'import config', 'rollback', 'manual backup'] },
      { key: 'api_keys', label: 'API Keys', desc: 'Generate API keys, manage webhook endpoints & credentials', icon: Key, sensitive: true, keywords: ['webhooks', 'credentials', 'endpoints', 'access tokens', 'api access'] },
      { key: 'developer', label: 'Developer Options', desc: 'Sandbox mode toggle, debug logs, local storage cache clear', icon: Sliders, sensitive: true, keywords: ['sandbox', 'debug logs', 'clear cache', 'database seed'] }
    ]
  }
];

const ENTERPRISE_SECTIONS: SettingSection[] = [
  {
    title: 'Enterprise Controls',
    items: [
      { key: 'enterprise_multibranch', label: 'Multi-branch Config', desc: 'Branch settings, centralized menu sync & chains', icon: Store, enterpriseOnly: true, keywords: ['branches', 'multi-branch', 'franchise', 'centralized', 'chain'] },
      { key: 'enterprise_policy', label: 'Centralized Policy', desc: 'Corporate compliance rules & global constraints', icon: Shield, enterpriseOnly: true, keywords: ['policy', 'corporate rules', 'global constraints', 'enforcement'] },
      { key: 'enterprise_sso', label: 'Single Sign-On (SSO)', desc: 'SSO provider, client credentials & access control', icon: Lock, enterpriseOnly: true, keywords: ['sso', 'single sign-on', 'saml', 'oidc', 'okta', 'azure'] },
      { key: 'enterprise_webhooks', label: 'Webhooks', desc: 'Realtime events, endpoints & retry policies', icon: Zap, enterpriseOnly: true, keywords: ['webhooks', 'realtime events', 'endpoints', 'retry policies'] },
      { key: 'enterprise_integrations', label: 'Custom Integrations', desc: 'SAP, custom API middleware & ERP integrations', icon: Blocks, enterpriseOnly: true, keywords: ['custom api', 'middleware', 'erp integration', 'sap'] }
    ]
  }
];


interface SettingsCenterProps {
  outlet: { name: string; brand: string; plan: string; gstin: string | null; receipt: any; gstConfig?: any };
  staff: { name: string; role: string };
  features: Record<string, boolean>;

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
  kitchens: Kitchen[];
  setKitchens: React.Dispatch<React.SetStateAction<Kitchen[]>>;
  kitchenApi: (payload: Record<string, unknown>, okMsg: string) => Promise<boolean>;
  kitchenBusy: boolean;

  pwaCfg: PwaConfig | null;
  setPwaCfg: React.Dispatch<React.SetStateAction<PwaConfig | null>>;
  handleSavePwa: (cfg: PwaConfig) => Promise<void>;
  pwaSaving: boolean;
  uploadImage: (file: File) => Promise<string | null>;

  auditList: any[];
  auditTotal: number;
  auditPage: number;
  loadAudit: (page: number) => Promise<void>;

  flashMessage: (msg: string) => void;
  isAdvanced: boolean;
  handleToggleAdvanced: (val: boolean) => void;
}

export default function SettingsCenter({
  outlet,
  staff,
  features,
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
  kitchens,
  setKitchens,
  kitchenApi,
  kitchenBusy,
  pwaCfg,
  setPwaCfg,
  handleSavePwa,
  pwaSaving,
  uploadImage,
  auditList,
  auditTotal,
  auditPage,
  loadAudit,
  flashMessage,
  isAdvanced,
  handleToggleAdvanced
}: SettingsCenterProps) {
  // Navigation & States
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileViewingForm, setIsMobileViewingForm] = useState<boolean>(false);
  const [isNavigatingByKeyboard, setIsNavigatingByKeyboard] = useState<boolean>(false);

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

  // Load audit history when Tax tab is opened
  useEffect(() => {
    if (activePanel === 'tax') {
      loadAudit(1);
    }
  }, [activePanel]);

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

  // Check role-based category visibility
  const isCategoryVisible = (item: SettingItem) => {
    if (staff.role === 'cashier') {
      if (item.key === 'general' || item.key === 'tax') return false;
    }
    if (item.enterpriseOnly && outlet.plan?.toLowerCase() !== 'enterprise') return false;
    return true;
  };

  // Filtered sections and items based on search query
  const filteredSections = useMemo(() => {
    const isEnterprise = outlet.plan?.toLowerCase() === 'enterprise';
    const allSections = isEnterprise ? [...SECTIONS, ...ENTERPRISE_SECTIONS] : SECTIONS;

    if (!searchQuery.trim()) {
      return allSections.map(sec => ({
        ...sec,
        items: sec.items.filter(isCategoryVisible)
      })).filter(sec => sec.items.length > 0);
    }

    const query = searchQuery.toLowerCase();
    return allSections.map(section => {
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
  }, [searchQuery, staff.role, outlet.plan]);

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
    upiEnabled: true,
    walletEnabled: false,
    creditsEnabled: true,
    splitPaymentEnabled: true,
    partialPaymentEnabled: false,
    tipEnabled: true,
    tipPercentages: '5, 10, 15',
    autoSettleShifts: true
  });

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
    flashMessage('Operational settings saved successfully');
  };

  // Load custom settings if any exist
  useEffect(() => {
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
        // ─── SETTINGS HOME (DASHBOARD GRID) ───
        <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 py-6">
          {/* Header */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold font-display" style={{ color: 'var(--ink)' }}>Settings</h1>
            <p className="text-sm text-ink-3">Configure every aspect of your restaurant settings, templates, and devices.</p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl w-full">
            <span className="absolute inset-y-0 left-4 grid place-items-center text-ink-3">
              <Search size={18} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search settings (Ctrl+K or Cmd+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="inp pl-11 w-full bg-paper-2 rounded-2xl shadow-sm text-sm"
              style={{ minHeight: '48px' }}
              aria-label="Search Settings"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-12 grid place-items-center text-ink-3 hover:text-ink"
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

          {/* Recently Used & Favorites */}
          {(recentlyUsed.length > 0 || favorites.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {recentlyUsed.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-ink-3 px-1">Recently Used</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {recentlyUsed.map(key => {
                      const allItems = [...SECTIONS.flatMap(s => s.items), ...ENTERPRISE_SECTIONS.flatMap(s => s.items)];
                      const item = allItems.find(i => i.key === key);
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActivePanel(key);
                            trackRecentlyUsed(key);
                          }}
                          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-line bg-paper-2 hover:bg-turmeric/10 hover:border-turmeric hover:-translate-y-[1px] shadow-sm transition-all text-xs font-bold"
                        >
                          <Icon size={14} className="text-turmeric" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {favorites.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-ink-3 px-1">Favorites</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {favorites.map(key => {
                      const allItems = [...SECTIONS.flatMap(s => s.items), ...ENTERPRISE_SECTIONS.flatMap(s => s.items)];
                      const item = allItems.find(i => i.key === key);
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setActivePanel(key);
                            trackRecentlyUsed(key);
                          }}
                          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-line bg-paper-2 hover:bg-turmeric/10 hover:border-turmeric hover:-translate-y-[1px] shadow-sm transition-all text-xs font-bold"
                        >
                          <Icon size={14} className="text-turmeric" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Category Groups */}
          <div className="flex flex-col gap-8 mt-2">
            {filteredSections.map(section => (
              <div key={section.title} className="flex flex-col gap-3">
                <h3 className="text-xs uppercase font-bold tracking-wider text-ink-3 px-1">{section.title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.items.map(item => {
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
                        className={`group relative flex flex-col justify-between p-5 rounded-[22px] border bg-paper-2 hover:shadow-lg transition-all duration-200 cursor-pointer ${
                          isKeyboardSelected
                            ? 'border-turmeric ring-2 ring-turmeric-l shadow-md'
                            : 'border-line hover:border-turmeric/40'
                        }`}
                        style={{
                          transform: isKeyboardSelected ? 'translateY(-2px)' : 'none',
                          minHeight: '142px'
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="grid place-items-center rounded-xl shrink-0"
                            style={{
                              width: 42,
                              height: 42,
                              background: 'var(--paper-3)',
                              color: 'var(--turmeric)'
                            }}
                          >
                            <Icon size={20} />
                          </span>
                          
                          {/* Icons row: Favorite heart/pin + Badge */}
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={e => toggleFavorite(item.key, e)}
                              className="p-1 rounded-lg text-ink-3 hover:text-red-500 hover:bg-paper-3 transition-colors"
                              aria-label="Toggle favorite"
                            >
                              <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-ink group-hover:text-turmeric transition-colors">{item.label}</h4>
                            {item.sensitive && (
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
                                Secure
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-3 mt-1 leading-normal line-clamp-2">
                            {item.desc}
                          </p>
                        </div>

                        {/* Chevron right at bottom-right */}
                        <span className="absolute bottom-4 right-4 text-ink-3 group-hover:text-turmeric group-hover:translate-x-0.5 transition-all">
                          <ChevronRight size={16} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredSections.length === 0 && (
              <div className="text-center py-16 card bg-paper-2 border border-line">
                <AlertCircle className="mx-auto mb-3 text-ink-3" size={32} />
                <p className="text-base font-semibold text-ink-2">No matching settings found</p>
                <p className="text-xs text-ink-3 mt-1">Try checking another keyword or category name</p>
                <button onClick={() => setSearchQuery('')} className="btn btn-sm btn-ghost mt-4">Clear search</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ─── DEDICATED SETTINGS PAGE (SINGLE SCREEN VIEW) ───
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full px-4 py-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-2.5 border-b pb-4" style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => setActivePanel(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-turmeric hover:text-turmeric-d transition-all self-start"
            >
              <ChevronLeft size={16} /> Back to Settings
            </button>
            
            <div className="flex items-center gap-2 text-xs font-bold text-ink-3">
              <span className="hover:text-ink cursor-pointer" onClick={() => setActivePanel(null)}>Settings</span>
              <ChevronRight size={12} />
              <span className="text-ink-2 capitalize">{activeSettingItem.key.replace(/_/g, ' ')}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-1">
              <div>
                <h1 className="text-2xl font-bold font-display text-ink">{activeSettingItem.label}</h1>
                <p className="text-xs text-ink-3 mt-0.5">{activeSettingItem.desc}</p>
              </div>
              
              {activeSettingItem.sensitive && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase w-fit">
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
                          <input type="file" accept="image/*" className="hidden" disabled={logoBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.currentTarget.value = ''; }} />
                        </label>
                        <span className="text-[10px] text-ink-3">Max size: 2MB. Format: PNG, JPG</span>
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

                  <div>
                    <label className="lbl">Festival & Upcoming Holidays Notes</label>
                    <textarea
                      value={businessHours.festivalHours}
                      onChange={(e) => setBusinessHours(b => ({ ...b, festivalHours: e.target.value }))}
                      placeholder="e.g. Diwali Holiday: Nov 12 - Open 9 AM to 4 PM only."
                      className="inp min-h-[70px] bg-paper-3"
                    />
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
                              
                              {auditTotal > 10 && (
                                <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: 'var(--line-2)' }}>
                                  <button
                                    type="button"
                                    disabled={auditPage <= 1}
                                    onClick={() => handleAuditPageChange(auditPage - 1)}
                                    className="btn py-1 px-2.5 text-[10px]"
                                    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}
                                  >
                                    Previous
                                  </button>
                                  <span className="text-[10px] text-ink-3">Page {auditPage}</span>
                                  <button
                                    type="button"
                                    disabled={auditPage * 10 >= auditTotal}
                                    onClick={() => handleAuditPageChange(auditPage + 1)}
                                    className="btn py-1 px-2.5 text-[10px]"
                                    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}
                                  >
                                    Next
                                  </button>
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
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Sparkles className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Floor &amp; QR Branding</h2>
                      <p className="text-xs text-ink-3">Manage physical table layouts, print QR labels, and configure dining sections.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-2xl font-mono text-turmeric-d">{floors.length}</h4>
                        <b className="text-xs uppercase text-ink-3 mt-1 block">Sections</b>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">e.g. Ground Floor, Rooftop</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-2xl font-mono text-turmeric-d">{floorTables.length}</h4>
                        <b className="text-xs uppercase text-ink-3 mt-1 block">Active Tables</b>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">Capacity tracking active</span>
                    </div>

                    <div className="card p-4 text-center bg-paper-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-green-600 block">✓ Self Ordering Active</span>
                        <span className="text-[10px] text-ink-3 block">QR-Scan to Place orders</span>
                      </div>
                      <span className="text-[10px] text-ink-3 mt-2 block border-t pt-2">With branding splash customiser</span>
                    </div>
                  </div>

                  {/* Tables mapping and Floor assignments */}
                  <div>
                    <h3 className="font-bold text-sm mb-3">Sections &amp; Floor Setup</h3>
                    <div className="divide-y divide-line border rounded-xl overflow-hidden bg-paper-3">
                      {floors.map((f) => {
                        const matchingTables = floorTables.filter(t => t.floorId === f.id);
                        return (
                          <div key={f.id} className="p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <b className="text-sm block">{f.name}</b>
                              <span className="text-ink-3">{matchingTables.length} Tables configured</span>
                            </div>
                            <span className="pill text-[10px] font-bold">Sort Index: {f.sort}</span>
                          </div>
                        );
                      })}
                    </div>
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

                    {/* Receipt text configurations */}
                    <div className="border-t pt-4">
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
                      {receiptSaving ? 'Saving layout...' : 'Save Billing Rules'}
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
                </div>
              )}

              {/* ── 10. DEVICES & PRINTERS ── */}
              {activePanel === 'devices' && (
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Printer className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Devices &amp; Printers</h2>
                      <p className="text-xs text-ink-3">Registry of thermal receipt printers, kitchen display systems, Bluetooth scales and POS drawer triggers.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">Hardware Registry</h4>
                      <button
                        onClick={() => openDeviceForm()}
                        className="btn btn-sm btn-primary"
                      >
                        <Plus size={14} /> Add Device
                      </button>
                    </div>

                    {/* Active Printers List */}
                    <div className="divide-y divide-line border rounded-xl overflow-hidden bg-paper-3">
                      {devices.map((d) => (
                        <div key={d.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <b className="text-sm block">{d.name}</b>
                              {d.isDefault && <span className="pill text-[9px] font-bold text-green-700 bg-green-500/10 border-green-500/20">Default</span>}
                            </div>
                            <span className="text-ink-3 capitalize">{d.type.replace('_', ' ')} · Connection: {d.connection} ({d.target})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {!d.isDefault && (
                              <button
                                onClick={() => handleSetDefaultDevice(d)}
                                className="px-2 py-1 bg-paper-2 hover:bg-line border rounded text-[11px]"
                              >
                                Make Default
                              </button>
                            )}
                            <button
                              onClick={() => openDeviceForm(d)}
                              className="px-2 py-1 bg-paper-2 hover:bg-line border rounded text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(d.id, d.name)}
                              className="text-red-500 hover:text-red-600 transition-colors ml-1"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {devices.length === 0 && (
                        <div className="p-8 text-center text-ink-3">No hardware devices configured yet. Click Add Device above.</div>
                      )}
                    </div>
                  </div>

                  {/* Inline Modal Form for Device Add/Edit */}
                  {showDeviceForm && (
                    <div className="border border-line rounded-2xl p-4 bg-paper-3 mt-2">
                      <div className="flex justify-between items-center border-b pb-2 mb-3">
                        <b className="text-sm">{deviceForm.id ? 'Edit Device Properties' : 'Register New Device'}</b>
                        <button onClick={() => setShowDeviceForm(false)} className="text-ink-3 hover:text-ink"><X size={16} /></button>
                      </div>

                      <form onSubmit={handleSaveDevice} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="lbl">Device Alias Name</label>
                            <input
                              value={deviceForm.name}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g. Billing Counter Printer"
                              required
                              className="inp bg-paper-2"
                            />
                          </div>

                          <div>
                            <label className="lbl">Device Hardware Class</label>
                            <select
                              value={deviceForm.type}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, type: e.target.value }))}
                              className="inp bg-paper-2"
                            >
                              <option value="receipt_printer">Receipt Printer (80mm / 58mm)</option>
                              <option value="kot_printer">Kitchen Ticket Printer (KOT)</option>
                              <option value="label_printer">Label Barcode Printer</option>
                              <option value="cash_drawer">Cash Drawer Trigger</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="lbl">Port Connection</label>
                            <select
                              value={deviceForm.connection}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, connection: e.target.value }))}
                              className="inp bg-paper-2"
                            >
                              <option value="network">Network IP Address</option>
                              <option value="usb">USB Raw Port</option>
                              <option value="bluetooth">Bluetooth Device</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="lbl">Target / IP / Port Descriptor</label>
                            <input
                              value={deviceForm.target}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, target: e.target.value }))}
                              placeholder="e.g. 192.168.1.200, COM1, LPT1"
                              required
                              className="inp bg-paper-2"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 select-none">
                            <input
                              type="checkbox"
                              checked={deviceForm.isDefault}
                              onChange={(e) => setDeviceForm((prev: any) => ({ ...prev, isDefault: e.target.checked }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric"
                            />
                            Set as default output node
                          </label>

                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowDeviceForm(false)} className="btn btn-sm">Cancel</button>
                            <button type="submit" className="btn btn-sm btn-primary">Save Device</button>
                          </div>
                        </div>
                      </form>
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
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Smartphone className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">PWA Settings</h2>
                      <p className="text-xs text-ink-3">Configure mobile web applications layouts, themes and offline notifications.</p>
                    </div>
                  </div>

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
                            value={pwaCfg.theme.heroTagline}
                            onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...c.theme, heroTagline: e.target.value } }))}
                            className="inp animate-glow"
                            placeholder="e.g. Freshly brewed daily"
                          />
                        </div>

                        <div>
                          <label className="lbl">Theme Accent Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={pwaCfg.theme.accent || '#D4A373'}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...c.theme, accent: e.target.value } }))}
                              className="h-10 w-12 rounded-xl border p-1 bg-paper-3 cursor-pointer"
                            />
                            <input
                              value={pwaCfg.theme.accent || ''}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, theme: { ...c.theme, accent: e.target.value } }))}
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
                            value={pwaCfg.table.welcomePrefix}
                            onChange={(e) => setPwaCfg((c: any) => ({ ...c, table: { ...c.table, welcomePrefix: e.target.value } }))}
                            className="inp"
                            placeholder="e.g. Welcome to Table"
                          />
                        </div>

                        <div className="flex flex-col justify-end">
                          <label className="flex items-center gap-2 text-xs text-ink-2 select-none h-11">
                            <input
                              type="checkbox"
                              checked={pwaCfg.table.allowManualPick}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, table: { ...c.table, allowManualPick: e.target.checked } }))}
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
                              checked={pwaCfg.registration.enabled}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, registration: { ...c.registration, enabled: e.target.checked } }))}
                              className="rounded border-line-2 text-turmeric accent-turmeric w-4 h-4"
                            />
                            Enable Customer Registration / Login
                          </label>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs text-ink-2 select-none">
                            <input
                              type="checkbox"
                              checked={pwaCfg.registration.collectName}
                              onChange={(e) => setPwaCfg((c: any) => ({ ...c, registration: { ...c.registration, collectName: e.target.checked } }))}
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
                          {pwaCfg.theme.logoUrl && <img src={pwaCfg.theme.logoUrl} alt="" className="rounded-lg object-contain" style={{ width: 44, height: 44, background: 'var(--paper-3)' }} />}
                          <label className="btn btn-sm cursor-pointer border" style={{ background: 'var(--paper-3)', borderColor: 'var(--line)' }}>
                            {pwaCfg.theme.logoUrl ? 'Replace logo' : 'Upload logo'}
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                const url = await uploadImage(f);
                                if (url) setPwaCfg((c: any) => ({ ...c, theme: { ...c.theme, logoUrl: url } }));
                              }
                            }} />
                          </label>
                          {pwaCfg.theme.logoUrl && <button type="button" onClick={() => setPwaCfg((c: any) => ({ ...c, theme: { ...c.theme, logoUrl: null } }))} className="btn btn-danger btn-sm">Remove</button>}
                        </div>
                      </div>

                      <button type="submit" disabled={pwaSaving} className="btn btn-primary self-end px-6">
                        {pwaSaving ? 'Saving app config...' : 'Save App settings'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center p-8 text-ink-3">
                      Loading Customer Web App properties...
                    </div>
                  )}
                </div>
              )}

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
                <div className="card p-5 sm:p-6 flex flex-col gap-6 bg-paper-2">
                  <div className="border-b pb-3 border-line flex items-center gap-3">
                    <Sliders className="text-turmeric" size={24} />
                    <div>
                      <h2 className="text-xl font-bold font-display">Developer Diagnostics</h2>
                      <p className="text-xs text-ink-3">Enable sandbox billing mode, configure cache triggers and local database seeds.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4 card p-4 bg-paper-3">
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
                        Sandbox Mode (Mock credit card transactions)
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
                        Verbose diagnostic logs in console
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 card p-4 bg-paper-3 justify-between">
                      <div>
                        <b className="text-xs uppercase font-bold text-ink-3 mb-2 block">System Cache Actions</b>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.clear();
                            flashMessage('All local cache cleared successfully!');
                          }}
                          className="btn btn-danger btn-sm btn-block text-xs"
                        >
                          Clear Local Storage Cache
                        </button>
                      </div>
                      <div className="text-[10px] text-ink-3 bg-paper-2 border p-2.5 rounded-lg">
                        ⚠️ Clearing the local storage cache will reset your favorites, recently used settings, and local operational modifications.
                      </div>
                    </div>
                  </div>
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

    </div>
  );
}
