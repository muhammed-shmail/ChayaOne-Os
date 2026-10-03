/**
 * Cafe OS — Business Day & Night Shift Extension Engine.
 *
 * Designed specifically for cafes and night venues operating until or past
 * midnight (12:00 AM / 00:00).
 *
 * Core Concept:
 * Calendar date flips at 00:00:00. However, in restaurant operations, a
 * "Business Day" continues as long as the service is running.
 * Roles above Cashier (Store Manager & Admin/Owner) have the authority to:
 * 1. Extend the business day so all sales after midnight stay on today's date.
 * 2. Close the business day to settle shifts and roll over to tomorrow.
 * 3. Configure closing time, cutoff buffer hours (default 4:00 AM), and auto-prompts.
 *
 * Stored safely in `Outlet.settings.businessDay`.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export interface BusinessDayState {
  /** Active business date in YYYY-MM-DD */
  currentBusinessDate: string;
  /** Whether the night shift extension is currently active */
  isExtended: boolean;
  /** Extension expiration timestamp (ISO string or null for open until manual close) */
  extendedUntil: string | null;
  /** When the day was extended */
  extendedAt: string | null;
  /** Staff ID of manager/owner who authorized */
  extendedByStaffId: string | null;
  /** Role of staff who authorized ('owner' | 'manager') */
  extendedByRole: string | null;
  /** Current operating status */
  status: 'open' | 'extended' | 'closed';
  /** Target scheduled closing time in HH:mm (default '00:00' / 12:00 AM) */
  closingTime: string;
  /** Night shift cutoff hour (0–6 AM, default 4 AM) where rollover forced */
  cutoffHour: number;
  /** Show interactive prompt at closing/midnight if shop is running */
  autoPromptAtMidnight: boolean;
  /** Timestamp when the previous business day was closed */
  lastClosedAt: string | null;
}

export const DEFAULT_BUSINESS_DAY: BusinessDayState = {
  currentBusinessDate: '',
  isExtended: false,
  extendedUntil: null,
  extendedAt: null,
  extendedByStaffId: null,
  extendedByRole: null,
  status: 'open',
  closingTime: '00:00',
  cutoffHour: 4,
  autoPromptAtMidnight: true,
  lastClosedAt: null,
};

/** Format Date object as YYYY-MM-DD in local or given timezone */
export function formatYmdInTz(d: Date, tz = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

/** Get wall-clock hour & minute in the outlet timezone */
export function getWallClockTimeInTz(d: Date, tz = DEFAULT_TIMEZONE): { hour: number; minute: number; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { hour, minute, timeStr };
}

/** Check if staff role is strictly above cashier (manager or owner) */
export function canManageBusinessDay(staff: { role?: string | null } | null | undefined): boolean {
  if (!staff?.role) return false;
  const r = staff.role.toLowerCase();
  return r === 'owner' || r === 'manager' || r === 'admin';
}

/**
 * Safely parse business day state from `Outlet.settings`.
 */
export function readBusinessDay(settings: unknown, now = new Date(), tz = DEFAULT_TIMEZONE): BusinessDayState {
  const raw = (settings && typeof settings === 'object' ? (settings as Record<string, any>).businessDay : null) ?? {};

  const cutoffHour = typeof raw.cutoffHour === 'number' && raw.cutoffHour >= 0 && raw.cutoffHour <= 8
    ? raw.cutoffHour
    : DEFAULT_BUSINESS_DAY.cutoffHour;

  const closingTime = typeof raw.closingTime === 'string' && /^\d{2}:\d{2}$/.test(raw.closingTime)
    ? raw.closingTime
    : DEFAULT_BUSINESS_DAY.closingTime;

  const autoPromptAtMidnight = typeof raw.autoPromptAtMidnight === 'boolean'
    ? raw.autoPromptAtMidnight
    : DEFAULT_BUSINESS_DAY.autoPromptAtMidnight;

  const isExtended = !!raw.isExtended;
  const extendedUntil = typeof raw.extendedUntil === 'string' ? raw.extendedUntil : null;
  const extendedAt = typeof raw.extendedAt === 'string' ? raw.extendedAt : null;
  const extendedByStaffId = typeof raw.extendedByStaffId === 'string' ? raw.extendedByStaffId : null;
  const extendedByRole = typeof raw.extendedByRole === 'string' ? raw.extendedByRole : null;
  const lastClosedAt = typeof raw.lastClosedAt === 'string' ? raw.lastClosedAt : null;

  // Check if active extension has expired
  let activeExtended = isExtended;
  if (isExtended && extendedUntil) {
    const expiry = new Date(extendedUntil);
    if (!isNaN(expiry.getTime()) && now.getTime() > expiry.getTime()) {
      activeExtended = false;
    }
  }

  // Resolve business date:
  // If explicitly stored and day is not closed, respect it.
  // Otherwise, if time is between 00:00 and cutoffHour, and either isExtended is true OR shop hasn't closed,
  // the business date is yesterday's date!
  const wallClock = getWallClockTimeInTz(now, tz);
  const calendarToday = formatYmdInTz(now, tz);
  const yesterday = formatYmdInTz(new Date(now.getTime() - 864e5), tz);

  let currentBusinessDate = typeof raw.currentBusinessDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.currentBusinessDate)
    ? raw.currentBusinessDate
    : '';

  if (!currentBusinessDate) {
    if (wallClock.hour < cutoffHour) {
      // Early morning (between 00:00 and cutoff): default to yesterday's business day unless explicitly closed today
      currentBusinessDate = yesterday;
    } else {
      currentBusinessDate = calendarToday;
    }
  }

  const status: 'open' | 'extended' | 'closed' = activeExtended
    ? 'extended'
    : raw.status === 'closed'
    ? 'closed'
    : 'open';

  return {
    currentBusinessDate,
    isExtended: activeExtended,
    extendedUntil,
    extendedAt,
    extendedByStaffId,
    extendedByRole,
    status,
    closingTime,
    cutoffHour,
    autoPromptAtMidnight,
    lastClosedAt,
  };
}

/**
 * Determine if the midnight / closing prompt should appear to the user.
 * Returns true if:
 * 1. autoPromptAtMidnight is enabled
 * 2. Current time is at or past closing time (or past 23:45 / midnight) and before cutoffHour
 * 3. The business day is not yet extended or closed
 */
export function shouldPromptBusinessDayExtension(
  state: BusinessDayState,
  now = new Date(),
  tz = DEFAULT_TIMEZONE
): boolean {
  if (!state.autoPromptAtMidnight) return false;
  if (state.isExtended) return false;
  if (state.status === 'closed') return false;

  const { hour, minute, timeStr } = getWallClockTimeInTz(now, tz);

  // Check if we are approaching or past closing time (e.g. 23:45 onwards or >= 00:00)
  // Window: 23:45 to cutoffHour:00
  const isLateNight = hour >= 23 && minute >= 45;
  const isPastMidnightBeforeCutoff = hour < state.cutoffHour;
  const isPastConfiguredClosing = timeStr >= state.closingTime && state.closingTime !== '00:00';

  return isLateNight || isPastMidnightBeforeCutoff || isPastConfiguredClosing;
}
