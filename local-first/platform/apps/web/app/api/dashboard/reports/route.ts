import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';
import { canAccess, hasRole, hasPermission } from '@/lib/rbac';
import { DEFAULT_TIMEZONE } from '@/lib/businessDay';
import { ReportsService, type ReportFilter } from '@/lib/services/reports.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const hasAccess =
    hasRole(session, ['owner', 'manager', 'accountant']) ||
    canAccess(session, 'dashboard') ||
    hasPermission(session, 'reports:sales');

  if (!hasAccess) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') || 'daily') as 'daily' | 'weekly' | 'monthly';
  const report = searchParams.get('report') || 'sales';
  const rawStartDate = searchParams.get('startDate');
  const rawEndDate = searchParams.get('endDate');

  // Optional filters
  const staffId = searchParams.get('staffId') || undefined;
  const paymentMethod = searchParams.get('paymentMethod') || undefined;
  const category = searchParams.get('category') || undefined;
  const tableId = searchParams.get('tableId') || undefined;
  const orderType = searchParams.get('orderType') || undefined;
  const format = searchParams.get('format') || 'json';

  // Read outlet timezone
  const outlet = await prisma.outlet.findUnique({
    where: { id: session.outletId },
    select: { timezone: true, name: true, tenant: { select: { name: true } } },
  });
  const tz = outlet?.timezone || DEFAULT_TIMEZONE;

  const { startDate, endDate } = ReportsService.normalizeDateRange(rawStartDate, rawEndDate, tz);

  const filter: ReportFilter = {
    period,
    startDate,
    endDate,
    staffId,
    paymentMethod,
    category,
    tableId,
    orderType,
  };

  try {
    const meta = await ReportsService.getReportMeta(session.outletId, session.tenantId, filter, tz);

    let reportData: any = null;

    switch (report) {
      case 'sales':
        reportData = await ReportsService.getSalesReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'items':
        reportData = await ReportsService.getItemsReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'gst':
        reportData = await ReportsService.getGstReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'payments':
        reportData = await ReportsService.getPaymentsReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'expenses':
        reportData = await ReportsService.getExpensesReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'staff':
        reportData = await ReportsService.getStaffReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'discounts':
        reportData = await ReportsService.getDiscountsReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'refunds':
        reportData = await ReportsService.getRefundsReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'tables':
        reportData = await ReportsService.getTablesReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'kot':
        reportData = await ReportsService.getKotReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'cash_drawer':
        reportData = await ReportsService.getCashDrawerReport(session.outletId, session.tenantId, filter, tz);
        break;
      case 'orders':
        reportData = await ReportsService.getOrdersReport(session.outletId, session.tenantId, filter, tz);
        break;
      default:
        return NextResponse.json({ error: 'invalid_report_type', message: `Unknown report: ${report}` }, { status: 400 });
    }

    if (format === 'csv') {
      // Export as CSV if requested
      const csvContent = generateCsv(report, reportData);
      return new NextResponse(csvContent, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${outlet?.tenant?.name || 'cafe'}-${report}-${startDate}-to-${endDate}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      meta,
      report,
      data: reportData,
    });
  } catch (err: any) {
    console.error('Reports API error:', err);
    return NextResponse.json({ error: 'reports_error', message: err.message || 'Internal reporting error' }, { status: 500 });
  }
}

function generateCsv(report: string, data: any): string {
  if (!data) return '';
  const rows: string[] = [];

  switch (report) {
    case 'sales': {
      rows.push('Date,Orders,Gross Sales (INR),Discount (INR),Tax (INR),Net Sales (INR),Refunds (INR)');
      if (Array.isArray(data.ledger)) {
        data.ledger.forEach((r: any) => {
          rows.push(`"${r.date}",${r.orders},${(r.grossSalesPaise / 100).toFixed(2)},${(r.discountPaise / 100).toFixed(2)},${(r.taxPaise / 100).toFixed(2)},${(r.netSalesPaise / 100).toFixed(2)},${(r.refundsPaise / 100).toFixed(2)}`);
        });
      }
      break;
    }
    case 'items': {
      rows.push('Item Name,Category,Quantity Sold,Gross Revenue (INR),Avg Price (INR),Share %');
      if (Array.isArray(data.items)) {
        data.items.forEach((i: any) => {
          rows.push(`"${i.name}","${i.category}",${i.qty},${(i.revenuePaise / 100).toFixed(2)},${(i.avgPricePaise / 100).toFixed(2)},${i.sharePct}%`);
        });
      }
      break;
    }
    case 'expenses': {
      rows.push('Date,Category,Vendor,Amount (INR),GST (INR),Method,Status,Reference,Notes');
      if (Array.isArray(data.expenses)) {
        data.expenses.forEach((e: any) => {
          rows.push(`"${e.date}","${e.category}","${e.vendor}",${(e.amountPaise / 100).toFixed(2)},${(e.gstPaise / 100).toFixed(2)},"${e.method}","${e.status}","${e.reference}","${e.notes}"`);
        });
      }
      break;
    }
    case 'payments': {
      rows.push('Payment Method,Transactions,Gross Amount (INR),Refunds (INR),Net Amount (INR),Share %');
      if (Array.isArray(data.methods)) {
        data.methods.forEach((m: any) => {
          rows.push(`"${m.label}",${m.count},${(m.grossPaise / 100).toFixed(2)},${(m.refundPaise / 100).toFixed(2)},${(m.netPaise / 100).toFixed(2)},${m.sharePct}%`);
        });
      }
      break;
    }
    case 'staff': {
      rows.push('Staff Name,Role,Orders Handled,Gross Sales (INR),Discounts Given (INR),Refunds (INR),AOV (INR),Cancelled Orders');
      if (Array.isArray(data.staff)) {
        data.staff.forEach((s: any) => {
          rows.push(`"${s.name}","${s.role}",${s.orders},${(s.grossSalesPaise / 100).toFixed(2)},${(s.discountsPaise / 100).toFixed(2)},${(s.refundsPaise / 100).toFixed(2)},${(s.aovPaise / 100).toFixed(2)},${s.cancelledOrders}`);
        });
      }
      break;
    }
    case 'gst': {
      rows.push('GST Slab,Taxable Amount (INR),CGST (INR),SGST (INR),IGST (INR),Total Tax (INR),Revenue (INR)');
      if (Array.isArray(data.byRate)) {
        data.byRate.forEach((r: any) => {
          rows.push(`"${r.slab}",${(r.taxablePaise / 100).toFixed(2)},${(r.cgstPaise / 100).toFixed(2)},${(r.sgstPaise / 100).toFixed(2)},${(r.igstPaise / 100).toFixed(2)},${(r.totalTaxPaise / 100).toFixed(2)},${(r.revenuePaise / 100).toFixed(2)}`);
        });
      }
      break;
    }
    default: {
      rows.push('Report Data Export');
      rows.push(JSON.stringify(data));
      break;
    }
  }

  return rows.join('\n');
}
