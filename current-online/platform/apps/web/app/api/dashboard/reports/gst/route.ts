import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager' && session.role !== 'accountant') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const format = searchParams.get('format') ?? 'json';

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: 'missing_dates', message: 'startDate and endDate are required.' }, { status: 400 });
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  end.setHours(23, 59, 59, 999);

  try {
    const orders = await prisma.order.findMany({
      where: {
        outletId: session.outletId,
        settledAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: true,
        customer: {
          select: { name: true, phone: true, notes: true },
        },
      },
      orderBy: { settledAt: 'asc' },
    });

    const itemIds = Array.from(new Set(orders.flatMap((o: any) => o.items.map((i: any) => i.itemId).filter((id: any): id is string => !!id))));
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, hsnCode: true, gstRate: true, category: { select: { name: true } } },
    });
    const menuItemMap = new Map<string, any>(menuItems.map((i: any) => [i.id, i]));

    // Aggregated Metrics
    let totalSalesPaise = 0;
    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalExemptPaise = 0;
    let totalDiscountPaise = 0;

    const rateSummary: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
    const hsnSummary: Record<string, { qty: number; taxable: number; cgst: number; sgst: number; igst: number }> = {};

    orders.forEach((o: any) => {
      totalSalesPaise += o.totalPaise;
      totalCgstPaise += o.cgstPaise;
      totalSgstPaise += o.sgstPaise;
      totalIgstPaise += o.igstPaise;
      totalDiscountPaise += o.discountPaise;

      const isInterstate = o.igstPaise > 0;
      let orderTaxAmt = o.cgstPaise + o.sgstPaise + o.igstPaise;
      
      // Subtotal minus taxes = base taxable value
      const baseTaxable = Math.max(0, o.subtotalPaise - orderTaxAmt);
      totalTaxablePaise += baseTaxable;

      // Group items of this order to distribute taxes
      o.items.forEach((item: any) => {
        const dbItem = item.itemId ? menuItemMap.get(item.itemId) : null;
        const rate = dbItem ? Number(dbItem.gstRate) : 5;
        const hsn = dbItem?.hsnCode || (item.itemId ? '9963' : '—');
        
        const catName = dbItem?.category?.name?.toLowerCase() ?? '';
        const isExempt = catName.includes('exempt') || catName.includes('zero') || rate === 0;

        const modifiersPrice = Array.isArray(item.modifiers)
          ? (item.modifiers as any[]).reduce((sum, m) => sum + (m.pricePaise ?? 0), 0)
          : 0;
        const itemLineTotal = (item.unitPricePaise + modifiersPrice) * item.qty;

        if (isExempt) {
          totalExemptPaise += itemLineTotal;
        }

        // Calculate estimated tax share for this item
        let lineTax = 0;
        if (orderTaxAmt > 0 && o.subtotalPaise > 0) {
          lineTax = Math.round((itemLineTotal / o.subtotalPaise) * orderTaxAmt);
        }

        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (isInterstate) {
          lineIgst = lineTax;
        } else {
          lineCgst = Math.round(lineTax / 2);
          lineSgst = lineTax - lineCgst;
        }

        const lineTaxable = itemLineTotal - lineTax;

        // Populate rate summary
        if (!rateSummary[rate]) {
          rateSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        }
        rateSummary[rate].taxable += lineTaxable;
        rateSummary[rate].cgst += lineCgst;
        rateSummary[rate].sgst += lineSgst;
        rateSummary[rate].igst += lineIgst;

        // Populate HSN summary
        if (!hsnSummary[hsn]) {
          hsnSummary[hsn] = { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        }
        hsnSummary[hsn].qty += item.qty;
        hsnSummary[hsn].taxable += lineTaxable;
        hsnSummary[hsn].cgst += lineCgst;
        hsnSummary[hsn].sgst += lineSgst;
        hsnSummary[hsn].igst += lineIgst;
      });
    });

    if (format === 'csv') {
      const csvRows: string[] = [];
      // Headers
      csvRows.push('Date,Invoice No,Customer Name,Customer GSTIN,Interstate,Subtotal (INR),Discount (INR),CGST (INR),SGST (INR),IGST (INR),Total (INR),Exempt / Nil Rated (INR)');
      
      orders.forEach((o: any) => {
        const dateStr = o.settledAt ? new Date(o.settledAt).toLocaleDateString('en-IN') : '—';
        const isInterstateStr = o.igstPaise > 0 ? 'Yes' : 'No';
        const subtotal = (o.subtotalPaise / 100).toFixed(2);
        const discount = (o.discountPaise / 100).toFixed(2);
        const cgst = (o.cgstPaise / 100).toFixed(2);
        const sgst = (o.sgstPaise / 100).toFixed(2);
        const igst = (o.igstPaise / 100).toFixed(2);
        const total = (o.totalPaise / 100).toFixed(2);
        
        let orderExempt = 0;
        o.items.forEach((item: any) => {
          const dbItem = item.itemId ? menuItemMap.get(item.itemId) : null;
          const rate = dbItem ? Number(dbItem.gstRate) : 5;
          const catName = dbItem?.category?.name?.toLowerCase() ?? '';
          if (catName.includes('exempt') || catName.includes('zero') || rate === 0) {
            const mods = Array.isArray(item.modifiers) ? (item.modifiers as any[]).reduce((s, m) => s + (m.pricePaise ?? 0), 0) : 0;
            orderExempt += (item.unitPricePaise + mods) * item.qty;
          }
        });
        const exemptStr = (orderExempt / 100).toFixed(2);

        let customerGstin = '—';
        if (o.customer?.notes) {
          const match = o.customer.notes.match(/GSTIN:\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
          if (match) {
            customerGstin = match[1];
          }
        }

        csvRows.push(
          `"${dateStr}","${o.number}","${o.customer?.name ?? 'Walk-in'}","${customerGstin}","${isInterstateStr}",${subtotal},${discount},${cgst},${sgst},${igst},${total},${exemptStr}`
        );
      });

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'content-type': 'text/csv;charset=utf-8',
          'content-disposition': `attachment; filename=gst-sales-report-${startDateStr}-to-${endDateStr}.csv`,
        },
      });
    }

    // Default: JSON response
    return NextResponse.json({
      ok: true,
      summary: {
        totalSales: totalSalesPaise / 100,
        totalTaxable: totalTaxablePaise / 100,
        totalCgst: totalCgstPaise / 100,
        totalSgst: totalSgstPaise / 100,
        totalIgst: totalIgstPaise / 100,
        totalTax: (totalCgstPaise + totalSgstPaise + totalIgstPaise) / 100,
        totalExempt: totalExemptPaise / 100,
        totalDiscount: totalDiscountPaise / 100,
      },
      rateSummary: Object.fromEntries(
        Object.entries(rateSummary).map(([rate, v]) => [
          rate,
          {
            taxable: v.taxable / 100,
            cgst: v.cgst / 100,
            sgst: v.sgst / 100,
            igst: v.igst / 100,
            totalTax: (v.cgst + v.sgst + v.igst) / 100,
          },
        ])
      ),
      hsnSummary: Object.fromEntries(
        Object.entries(hsnSummary).map(([hsn, v]) => [
          hsn,
          {
            qty: v.qty,
            taxable: v.taxable / 100,
            cgst: v.cgst / 100,
            sgst: v.sgst / 100,
            igst: v.igst / 100,
            totalTax: (v.cgst + v.sgst + v.igst) / 100,
          },
        ])
      ),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'server_error', message: err.message }, { status: 500 });
  }
}
