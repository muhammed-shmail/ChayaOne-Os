import { prisma, type StaffRole } from '@cafeos/db';

/**
 * Web Push delivery for staff-targeted notifications (Staff PWA P3).
 *
 * Sends to every opted-in device of the resolved recipients so alerts reach the
 * phone even when the app is closed. Called best-effort from createNotification;
 * a missing config or a send failure never blocks the notification write.
 *
 * VAPID keys live in env (WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY /
 * WEB_PUSH_SUBJECT). The `web-push` lib is imported dynamically so it never ends
 * up in an edge bundle.
 */
export function isPushConfigured(): boolean {
  return !!(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY);
}

type NotificationLike = {
  outletId: string;
  type: string;
  title: string;
  body: string | null;
  audience: string;
  targetRole: string | null;
  targetStaffId: string | null;
  entityId: string | null;
};

/** Which staff a staff-targeted notification should reach (by audience). */
async function recipientStaffIds(n: NotificationLike): Promise<string[]> {
  if (n.audience === 'user') return n.targetStaffId ? [n.targetStaffId] : [];
  if (n.audience === 'role') {
    if (!n.targetRole) return [];
    const rows = await prisma.staffUser.findMany({
      where: { outletId: n.outletId, active: true, role: n.targetRole as StaffRole },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  if (n.audience === 'floor') {
    const rows = await prisma.staffUser.findMany({
      where: { outletId: n.outletId, active: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  return []; // 'owner' is delivered via the owner channels, not staff push
}

/** Deep-link a notification opens to when tapped. */
function urlFor(n: NotificationLike): string {
  if (n.type === 'order_ready' || n.type === 'approval' || n.type === 'broadcast') return '/pos';
  return '/pos';
}

export async function pushToStaff(n: NotificationLike): Promise<void> {
  if (n.audience === 'owner' || !isPushConfigured()) return;

  const staffIds = await recipientStaffIds(n);
  if (!staffIds.length) return;

  const subs = await prisma.pushSubscription.findMany({ where: { staffId: { in: staffIds } } });
  if (!subs.length) return;

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || 'mailto:alerts@cafeos.app',
    process.env.WEB_PUSH_PUBLIC_KEY as string,
    process.env.WEB_PUSH_PRIVATE_KEY as string,
  );

  const payload = JSON.stringify({
    title: n.title,
    body: n.body ?? '',
    url: urlFor(n),
    tag: n.type,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        // 404/410 → the browser dropped the subscription; prune it.
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}
