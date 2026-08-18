import type { LocalRealtimeClaims } from './types';

export function staffTopic(outletId: string): string {
  return `outlet:${outletId}`;
}

export function tableTopic(outletId: string, tableId: string): string {
  return `outlet:${outletId}:tbl:${tableId}`;
}

/**
 * Validate whether a client's verified claims authorize them to subscribe to a channel.
 *
 * Rules:
 * 1. Staff Token (no tableId): Can subscribe ONLY to `outlet:<outletId>`. Mismatched outletId is rejected.
 * 2. Customer Token (tableId set): Can subscribe ONLY to `outlet:<outletId>:tbl:<tableId>`.
 *    A customer MUST NOT be allowed to subscribe to staff `outlet:<outletId>` or other tables!
 */
export function isChannelAuthorized(claims: LocalRealtimeClaims, channel: string): boolean {
  if (!claims.outletId || !channel) return false;

  const staffChannel = staffTopic(claims.outletId);

  if (claims.tableId) {
    const customerChannel = tableTopic(claims.outletId, claims.tableId);
    return channel === customerChannel;
  }

  return channel === staffChannel;
}
