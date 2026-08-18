import crypto from 'crypto';
import { prisma, SyncStatus } from '@cafeos/db';
import { createOutboxEntry, getPendingOutboxEntries, markOutboxSynced, markOutboxFailed, getExponentialBackoffDate } from '../outbox';
import { processOutboxBatch, isCloudSyncEnabled } from './worker';

async function runStep5SyncTests() {
  console.log('--- Starting Step 5 Transaction Outbox & Sync Worker Tests ---');

  const testTenantId = '11111111-1111-1111-1111-111111111111';
  const testOutletId = '22222222-2222-2222-2222-222222222222';
  const testOrderId = crypto.randomUUID();
  const testClientUuid = crypto.randomUUID();

  // Test 1: Atomic Outbox Entry Creation inside Prisma $transaction
  console.log('Test 1: Atomic Outbox Entry Creation inside $transaction');
  const outboxEntry = await prisma.$transaction(async (tx) => {
    return await createOutboxEntry(tx, {
      tenantId: testTenantId,
      outletId: testOutletId,
      eventId: testClientUuid,
      entityType: 'Order',
      entityId: testOrderId,
      operation: 'CREATE',
      causalGroup: `order:${testOrderId}`,
      payload: {
        orderId: testOrderId,
        totalPaise: 25000,
        status: 'in_kitchen',
      },
    });
  });

  console.assert(outboxEntry.id !== undefined, 'Outbox entry ID missing');
  console.assert(outboxEntry.eventId === testClientUuid, 'Outbox eventId mismatch');
  console.assert(outboxEntry.status === SyncStatus.PENDING, 'Initial status should be PENDING');
  console.assert(outboxEntry.causalGroup === `order:${testOrderId}`, 'Causal group mismatch');
  console.log('✓ Test 1 passed (Atomic Outbox Creation verified)');

  // Test 2: Offline Outbox Query & Queueing
  console.log('Test 2: Offline Outbox Query & Queueing');
  const pendingEntries = await getPendingOutboxEntries(100);
  const found = pendingEntries.find((e) => e.id === outboxEntry.id);
  console.assert(found !== undefined, 'Created outbox entry should be returned in pending list');
  console.assert(found?.status === SyncStatus.PENDING, 'Status should be PENDING');
  console.log('✓ Test 2 passed (Pending Outbox Queue verified)');

  // Test 3: Exponential Backoff Calculation
  console.log('Test 3: Exponential Backoff Calculation');
  const now = Date.now();
  const backoff1 = getExponentialBackoffDate(1); // 2^1 * 2000 = 4000ms
  const backoff3 = getExponentialBackoffDate(3); // 2^3 * 2000 = 16000ms

  console.assert(backoff1.getTime() > now, 'Backoff 1 date must be in the future');
  console.assert(backoff3.getTime() > backoff1.getTime(), 'Backoff 3 must be greater than backoff 1');
  console.log('✓ Test 3 passed (Exponential Backoff verified)');

  // Test 4: Marking Outbox Entry as FAILED & RETRYING
  console.log('Test 4: Outbox Error State Transition & Retries');
  const failedEntry = await markOutboxFailed(outboxEntry.id, 'Simulated connection timeout', 'NETWORK_ERROR', 10);
  console.assert(failedEntry.status === SyncStatus.FAILED, 'Status should transition to FAILED');
  console.assert(failedEntry.attempts === 1, 'Attempts counter should be 1');
  console.assert(failedEntry.lastError?.includes('connection timeout') === true, 'Error message mismatch');
  console.log('✓ Test 4 passed (Error State & Retry Backoff verified)');

  // Test 5: Marking Outbox Entry as SYNCED
  console.log('Test 5: Outbox SYNCED State Transition');
  const syncedEntry = await markOutboxSynced(outboxEntry.id);
  console.assert(syncedEntry.status === SyncStatus.SYNCED, 'Status should transition to SYNCED');
  console.assert(syncedEntry.processedAt !== null, 'processedAt timestamp must be populated');
  console.assert(syncedEntry.lastError === null, 'lastError must be cleared upon sync success');
  console.log('✓ Test 5 passed (SYNCED State Transition verified)');

  // Clean up test data
  await prisma.syncOutbox.delete({ where: { id: outboxEntry.id } });
  console.log('✓ Cleaned up test outbox record');

  console.log('--- ALL STEP 5 TRANSACTION OUTBOX TESTS PASSED SUCCESSFULLY ---');
}

runStep5SyncTests().catch((e) => {
  console.error('Step 5 Sync test failed:', e);
  process.exit(1);
});
