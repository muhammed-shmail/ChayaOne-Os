import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@cafeos/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'manager' && session.role !== 'accountant') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let outletId = session.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true },
    });
    outletId = firstOutlet?.id ?? null;
  }
  if (!outletId) return NextResponse.json({ error: 'no_outlet' }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  if (body.action !== 'outlet') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  if (typeof body.logoUrl === 'string' && body.logoUrl.startsWith('blob:')) {
    return NextResponse.json(
      { error: 'invalid_logo_url', message: 'Temporary blob URLs cannot be persisted.' },
      { status: 400 }
    );
  }

  const data: Prisma.OutletUpdateInput = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (body.gstin !== undefined) data.gstin = body.gstin ? String(body.gstin).trim() : null;
  if (body.stateCode !== undefined) data.stateCode = body.stateCode ? String(body.stateCode).trim().toUpperCase().slice(0, 2) : null;
  if (body.address && typeof body.address === 'object') {
    data.address = {
      line1: String(body.address.line1 ?? '').trim(),
      city: String(body.address.city ?? '').trim(),
      pincode: String(body.address.pincode ?? '').trim(),
    } as Prisma.InputJsonValue;
  }

  if (body.gstEnabled !== undefined || body.gstRate !== undefined || body.gstType !== undefined || body.logoUrl !== undefined) {
    const current = await prisma.outlet.findUnique({ where: { id: outletId }, select: { settings: true } });
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    if (body.gstEnabled !== undefined || body.gstRate !== undefined || body.gstType !== undefined) {
      const gst = (settings.gst as Record<string, unknown>) ?? {};
      if (body.gstEnabled !== undefined) gst.enabled = !!body.gstEnabled;
      if (body.gstRate !== undefined) {
        const rate = Number(body.gstRate);
        gst.rate = Number.isFinite(rate) && rate > 0 ? Math.min(28, Math.round(rate * 100) / 100) : null;
      }
      if (body.gstType !== undefined) gst.type = body.gstType === 'inclusive' ? 'inclusive' : 'exclusive';
      settings.gst = gst;
    }
    if (body.logoUrl !== undefined) {
      const cleanLogoUrl = body.logoUrl ? String(body.logoUrl).trim().slice(0, 1000) : null;
      settings.logoUrl = cleanLogoUrl;

      // Sync to TenantBranding so tenant-level brand fallback receives the logo
      await prisma.tenantBranding.upsert({
        where: { tenantId: session.tenantId },
        create: { tenantId: session.tenantId, logoUrl: cleanLogoUrl },
        update: { logoUrl: cleanLogoUrl },
      }).catch((err) => console.warn('[Owner settings] TenantBranding sync error:', err));
    }
    data.settings = settings as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  const outlet = await prisma.outlet.update({
    where: { id: outletId },
    data,
    select: { name: true, gstin: true, stateCode: true, address: true, timezone: true, settings: true },
  });

  const updatedLogoUrl = (outlet.settings as any)?.logoUrl || null;

  await prisma.auditLog.create({
    data: {
      outletId,
      actorId: session.staffId,
      action: 'outlet.updated',
      entity: 'outlet',
      entityId: outletId,
      after: data as Prisma.InputJsonValue,
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    outlet: {
      ...outlet,
      logoUrl: updatedLogoUrl,
    },
  });
}
