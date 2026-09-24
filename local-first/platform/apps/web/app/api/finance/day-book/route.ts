import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DayBookService } from '@/lib/services/day-book.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/finance/day-book
 * Query params:
 *  - dateFrom (YYYY-MM-DD)
 *  - dateTo (YYYY-MM-DD)
 *  - financialYearId (UUID)
 *  - type (all, sales, expenses, payments, refunds, vendor, bank, payroll, cash_drawer)
 *  - paymentMethod (all, cash, card, upi, bank, other)
 *  - search (string)
 *  - page (number)
 *  - pageSize (number)
 *  - sortOrder ('asc' | 'desc')
 *  - export ('csv')
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const financialYearId = searchParams.get('financialYearId') || undefined;
  const type = searchParams.get('type') || undefined;
  const paymentMethod = searchParams.get('paymentMethod') || undefined;
  const search = searchParams.get('search') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 25;
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
  const exportFormat = searchParams.get('export');

  try {
    // If CSV export is requested, we fetch all matching entries without small pagination
    const isExport = exportFormat === 'csv';
    const queryPageSize = isExport ? 5000 : pageSize;

    const result = await DayBookService.getDayBook(session.tenantId, session.outletId, {
      dateFrom,
      dateTo,
      financialYearId,
      type,
      paymentMethod,
      search,
      page: isExport ? 1 : page,
      pageSize: queryPageSize,
      sortOrder,
    });

    if (isExport) {
      const csvData = DayBookService.generateCSV(
        result.entries,
        result.summary,
        `${result.dateFrom} to ${result.dateTo}`
      );

      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="day-book-${result.dateFrom}-${result.dateTo}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Error fetching Day Book:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
