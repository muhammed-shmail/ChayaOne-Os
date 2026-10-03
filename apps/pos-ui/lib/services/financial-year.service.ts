import { prisma } from '@cafeos/db';
import { formatYmdInTz, DEFAULT_TIMEZONE } from '../businessDay';
import { type FinancialYearCreateInput } from '@cafeos/core';

export interface FinancialYearItem {
  id: string;
  tenantId: string;
  outletId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
  isDefault: boolean;
  closedAt: Date | null;
  closedById: string | null;
  closedByName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FinancialYearService {
  /**
   * Helper to compute default Indian / global financial year bounds for a given date
   */
  static getDefaultFinancialYearBounds(now = new Date(), tz = DEFAULT_TIMEZONE): { name: string; startDate: string; endDate: string } {
    const todayStr = formatYmdInTz(now, tz);
    const parts = todayStr.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const startYear = m >= 4 ? y : y - 1;
    const endYear = startYear + 1;
    const shortEndYear = String(endYear).slice(-2);
    return {
      name: `FY ${startYear}–${shortEndYear}`,
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }


  /**
   * List all financial years for a tenant. If none exist, seeds the default FY.
   */
  static async listFinancialYears(tenantId: string, outletId?: string): Promise<FinancialYearItem[]> {
    let list = await prisma.financialYear.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });

    if (list.length === 0) {
      // Seed default active financial year
      const defaultFY = this.getDefaultFinancialYearBounds();
      const created = await prisma.financialYear.create({
        data: {
          tenantId,
          outletId: outletId || null,
          name: defaultFY.name,
          startDate: defaultFY.startDate,
          endDate: defaultFY.endDate,
          status: 'active',
          isDefault: true,
          notes: 'Auto-initialized active financial year',
        },
      });
      list = [created];
    }

    return list as FinancialYearItem[];
  }

  /**
   * Get the active financial year for a given date or today
   */
  static async getActiveFinancialYear(tenantId: string, outletId?: string, targetDate?: string): Promise<FinancialYearItem | null> {
    const dateStr = targetDate || formatYmdInTz(new Date(), DEFAULT_TIMEZONE);

    // 1. Look for active FY covering the date
    const matching = await prisma.financialYear.findFirst({
      where: {
        tenantId,
        status: 'active',
        startDate: { lte: dateStr },
        endDate: { gte: dateStr },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (matching) return matching as FinancialYearItem;

    // 2. Fallback to any active default FY or list
    const list = await this.listFinancialYears(tenantId, outletId);
    return (list.find((fy) => fy.status === 'active' && fy.isDefault) ||
      list.find((fy) => fy.status === 'active') ||
      list[0] ||
      null) as FinancialYearItem | null;
  }

  /**
   * Create a new financial year with strict validation
   */
  static async createFinancialYear(
    tenantId: string,
    outletId: string | null,
    input: FinancialYearCreateInput
  ): Promise<FinancialYearItem> {
    const { name, startDate, endDate, isDefault, notes } = input;

    if (startDate >= endDate) {
      throw new Error('Start date must be before end date.');
    }

    // Check duration: at least 28 days, at most 731 days (2 years)
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 28) {
      throw new Error('Financial year must span at least 28 days.');
    }
    if (diffDays > 731) {
      throw new Error('Financial year cannot exceed 2 years.');
    }

    // Check name uniqueness for this tenant
    const existingName = await prisma.financialYear.findFirst({
      where: { tenantId, name: name.trim() },
    });
    if (existingName) {
      throw new Error(`A financial year with name "${name.trim()}" already exists.`);
    }

    // Check for overlapping ACTIVE financial years
    const overlappingActive = await prisma.financialYear.findFirst({
      where: {
        tenantId,
        status: 'active',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlappingActive) {
      throw new Error(
        `Overlaps with active financial year "${overlappingActive.name}" (${overlappingActive.startDate} to ${overlappingActive.endDate}). Only one financial year can be active for a given date.`
      );
    }

    // If marked default, unset previous default
    if (isDefault) {
      await prisma.financialYear.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await prisma.financialYear.create({
      data: {
        tenantId,
        outletId: outletId || null,
        name: name.trim(),
        startDate,
        endDate,
        status: 'active',
        isDefault: !!isDefault,
        notes: notes?.trim() || null,
      },
    });

    return created as FinancialYearItem;
  }

  /**
   * Update an existing financial year
   */
  static async updateFinancialYear(
    tenantId: string,
    id: string,
    input: Partial<FinancialYearCreateInput>
  ): Promise<FinancialYearItem> {
    const existing = await prisma.financialYear.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('FINANCIAL_YEAR_NOT_FOUND');

    if (existing.status === 'closed') {
      throw new Error('Cannot edit a closed financial year. Reopen it first if adjustments are authorized.');
    }

    const startDate = input.startDate || existing.startDate;
    const endDate = input.endDate || existing.endDate;

    if (startDate >= endDate) {
      throw new Error('Start date must be before end date.');
    }

    // Check overlapping with OTHER active financial years
    const overlapping = await prisma.financialYear.findFirst({
      where: {
        tenantId,
        id: { not: id },
        status: 'active',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new Error(`Overlaps with active financial year "${overlapping.name}".`);
    }

    const updated = await prisma.financialYear.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        startDate,
        endDate,
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });

    return updated as FinancialYearItem;
  }

  /**
   * Close a financial year (Period Locking)
   */
  static async closeFinancialYear(
    tenantId: string,
    id: string,
    staffUser: { id?: string; name?: string; role?: string }
  ): Promise<FinancialYearItem> {
    const existing = await prisma.financialYear.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('FINANCIAL_YEAR_NOT_FOUND');

    if (existing.status === 'closed') {
      throw new Error('Financial year is already closed.');
    }

    const closed = await prisma.financialYear.update({
      where: { id },
      data: {
        status: 'closed',
        isDefault: false,
        closedAt: new Date(),
        closedById: staffUser.id || null,
        closedByName: staffUser.name || 'Manager',
      },
    });

    return closed as FinancialYearItem;
  }

  /**
   * Reopen a closed financial year
   */
  static async reopenFinancialYear(
    tenantId: string,
    id: string,
    _staffUser: { id?: string; name?: string; role?: string }
  ): Promise<FinancialYearItem> {
    const existing = await prisma.financialYear.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('FINANCIAL_YEAR_NOT_FOUND');

    if (existing.status === 'active') {
      throw new Error('Financial year is already active.');
    }

    // Check if reopening would overlap with any currently active FY
    const overlappingActive = await prisma.financialYear.findFirst({
      where: {
        tenantId,
        id: { not: id },
        status: 'active',
        startDate: { lte: existing.endDate },
        endDate: { gte: existing.startDate },
      },
    });

    if (overlappingActive) {
      throw new Error(
        `Cannot reopen "${existing.name}". Its date range overlaps with currently active financial year "${overlappingActive.name}".`
      );
    }

    const reopened = await prisma.financialYear.update({
      where: { id },
      data: {
        status: 'active',
        closedAt: null,
        closedById: null,
        closedByName: null,
      },
    });

    return reopened as FinancialYearItem;
  }

  /**
   * Check whether a given business date falls in a closed financial year
   */
  static async isDateInClosedFinancialYear(
    tenantId: string,
    _outletId: string | null | undefined,
    dateStr: string
  ): Promise<{ isClosed: boolean; financialYear?: FinancialYearItem }> {
    const closedFY = await prisma.financialYear.findFirst({
      where: {
        tenantId,
        status: 'closed',
        startDate: { lte: dateStr },
        endDate: { gte: dateStr },
      },
    });

    if (closedFY) {
      return { isClosed: true, financialYear: closedFY as FinancialYearItem };
    }
    return { isClosed: false };
  }

  /**
   * Period Locking Guard: Throws error if date falls inside a closed financial year
   */
  static async assertDateNotLocked(
    tenantId: string,
    outletId: string | null | undefined,
    dateStr: string
  ): Promise<void> {
    const { isClosed, financialYear } = await this.isDateInClosedFinancialYear(tenantId, outletId, dateStr);
    if (isClosed && financialYear) {
      throw new Error(
        `FINANCIAL_YEAR_LOCKED: Financial Year "${financialYear.name}" (${financialYear.startDate} to ${financialYear.endDate}) is CLOSED. Modifications or additions to historical accounting records in a locked period are strictly blocked.`
      );
    }
  }
}
