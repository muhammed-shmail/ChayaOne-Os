/**
 * Cafe OS — Kitchen Workflow configuration.
 *
 * A cafe chooses *how* its kitchen receives orders: a live Digital KDS, an
 * auto-printed KOT (paper ticket, no screen), or Hybrid (both). Small tea shops
 * never want a chef touching a tablet; large kitchens want the display. The
 * software adapts to the business — it never forces a screen.
 *
 * Like gst/receipt/kitchens/location, this lives in the existing
 * `Outlet.settings` JSON (no schema change, fully reversible):
 *
 *   settings.kitchenWorkflow → KitchenWorkflowConfig
 *
 * `readKitchenWorkflow` never throws and falls back to defaults that preserve
 * the pre-existing KDS behaviour (digital, dark, oldest-first), so an untouched
 * outlet behaves exactly as before. Consumed by the KDS (display behaviour) and
 * the POS (auto-print KOT on send-to-kitchen).
 */

export type WorkflowMode = 'digital' | 'printed' | 'hybrid';
export type KdsSort = 'newest' | 'oldest' | 'priority' | 'table' | 'pickup';
export type KdsTheme = 'light' | 'dark' | 'auto';
export type KdsFontSize = 'small' | 'medium' | 'large' | 'xl';

export interface KitchenWorkflowConfig {
  /** master switch — show the digital Kitchen Display screen at all */
  kdsEnabled: boolean;
  /** how the kitchen receives orders */
  mode: WorkflowMode;

  // ---- printed KOT (mode = printed | hybrid) ----
  /** print the kitchen ticket automatically after billing / send-to-KOT */
  autoPrintKot: boolean;
  /** number of KOT copies to print (1–4) */
  kotCopies: number;

  // ---- KDS behaviour ----
  /** skip the on-screen "accept" step — new tickets read as Preparing at once */
  autoAcceptOrders: boolean;
  /** play a chime when a new order lands */
  soundNotification: boolean;
  /** remove a completed (served) ticket after this many seconds; -1 = never */
  autoClearSec: number;
  /** flag tickets that have aged past the delay threshold */
  highlightDelayed: boolean;
  /** minutes before a ticket is considered delayed */
  delayThresholdMin: number;
  /** ticket ordering on the display */
  sorting: KdsSort;

  // ---- KDS card content ----
  showCustomerName: boolean;
  showTableNumber: boolean;
  showNotes: boolean;
  /** show the running preparation timer on each card */
  showPrepTime: boolean;

  // ---- KDS presentation ----
  theme: KdsTheme;
  fontSize: KdsFontSize;
}

/** Auto-clear dropdown choices (seconds; -1 = Never). */
export const AUTO_CLEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: -1, label: 'Never' },
];

/** Delay-threshold dropdown choices (minutes). */
export const DELAY_THRESHOLD_OPTIONS = [5, 10, 15, 20];

export const SORT_OPTIONS: { value: KdsSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority (most delayed)' },
  { value: 'table', label: 'Table number' },
  { value: 'pickup', label: 'Pickup / takeaway first' },
];

export const THEME_OPTIONS: { value: KdsTheme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'Auto' },
];

export const FONT_SIZE_OPTIONS: { value: KdsFontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

/** Defaults preserve the original KDS behaviour (digital, dark, oldest-first). */
export const KITCHEN_WORKFLOW_DEFAULTS: KitchenWorkflowConfig = {
  kdsEnabled: true,
  mode: 'digital',
  autoPrintKot: false,
  kotCopies: 1,
  autoAcceptOrders: false,
  soundNotification: false,
  autoClearSec: 30,
  highlightDelayed: true,
  delayThresholdMin: 5,
  sorting: 'oldest',
  showCustomerName: false,
  showTableNumber: true,
  showNotes: true,
  showPrepTime: true,
  theme: 'dark',
  fontSize: 'medium',
};

const MODES: WorkflowMode[] = ['digital', 'printed', 'hybrid'];
const SORTS: KdsSort[] = ['newest', 'oldest', 'priority', 'table', 'pickup'];
const THEMES: KdsTheme[] = ['light', 'dark', 'auto'];
const FONT_SIZES: KdsFontSize[] = ['small', 'medium', 'large', 'xl'];

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const oneOf = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
  typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;

const intIn = (v: unknown, allowed: number[], fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && allowed.includes(n) ? n : fallback;
};

/** Read & normalize the kitchen-workflow config from Outlet.settings. Never throws. */
export function readKitchenWorkflow(settings: unknown): KitchenWorkflowConfig {
  const w = ((settings as { kitchenWorkflow?: unknown } | null)?.kitchenWorkflow ?? {}) as Record<string, unknown>;
  const d = KITCHEN_WORKFLOW_DEFAULTS;
  const copies = Number(w.kotCopies);
  return {
    kdsEnabled: bool(w.kdsEnabled, d.kdsEnabled),
    mode: oneOf(w.mode, MODES, d.mode),
    autoPrintKot: bool(w.autoPrintKot, d.autoPrintKot),
    kotCopies: Number.isFinite(copies) && copies >= 1 ? Math.min(4, Math.round(copies)) : d.kotCopies,
    autoAcceptOrders: bool(w.autoAcceptOrders, d.autoAcceptOrders),
    soundNotification: bool(w.soundNotification, d.soundNotification),
    autoClearSec: intIn(w.autoClearSec, AUTO_CLEAR_OPTIONS.map((o) => o.value), d.autoClearSec),
    highlightDelayed: bool(w.highlightDelayed, d.highlightDelayed),
    delayThresholdMin: intIn(w.delayThresholdMin, DELAY_THRESHOLD_OPTIONS, d.delayThresholdMin),
    sorting: oneOf(w.sorting, SORTS, d.sorting),
    showCustomerName: bool(w.showCustomerName, d.showCustomerName),
    showTableNumber: bool(w.showTableNumber, d.showTableNumber),
    showNotes: bool(w.showNotes, d.showNotes),
    showPrepTime: bool(w.showPrepTime, d.showPrepTime),
    theme: oneOf(w.theme, THEMES, d.theme),
    fontSize: oneOf(w.fontSize, FONT_SIZES, d.fontSize),
  };
}

/**
 * Normalize a raw client payload into a persistable config (used by the
 * settings write path). Same rules as readKitchenWorkflow but from a flat body.
 */
export function normalizeKitchenWorkflowInput(input: unknown): KitchenWorkflowConfig {
  return readKitchenWorkflow({ kitchenWorkflow: input });
}
