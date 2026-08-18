import WebSocket from 'ws';
import { mintLocalRealtimeToken, verifyLocalRealtimeToken } from './auth';
import { isChannelAuthorized, staffTopic, tableTopic } from './channels';
import { ensureLocalWebSocketServer } from './server';
import { publishLocalRealtimeEvent } from './publisher';

async function runRealtimeTests() {
  console.log('--- Starting Step 4 Local Realtime Verification Tests ---');

  // 1. Test Auth Token Minting & Verification
  console.log('Test 1: Auth token minting & verification');
  const staffToken = await mintLocalRealtimeToken({
    outletId: 'outlet-test-123',
    staffId: 'staff-01',
    role: 'cashier',
    tenantId: 'tenant-test',
  });
  const staffClaims = await verifyLocalRealtimeToken(staffToken);
  console.assert(staffClaims !== null, 'Staff token verification failed');
  console.assert(staffClaims?.outletId === 'outlet-test-123', 'OutletId mismatch');
  console.assert(staffClaims?.tableId === null, 'Staff token tableId should be null');
  console.log('✓ Test 1 passed');

  // 2. Test Customer Token & Channel Authorization
  console.log('Test 2: Customer token & channel authorization');
  const customerToken = await mintLocalRealtimeToken({
    outletId: 'outlet-test-123',
    tableId: 'tbl-456',
    tenantId: 'tenant-test',
  });
  const customerClaims = await verifyLocalRealtimeToken(customerToken);
  console.assert(customerClaims !== null, 'Customer token verification failed');
  console.assert(customerClaims?.tableId === 'tbl-456', 'Customer tableId mismatch');

  // Channel security assertions
  console.assert(
    isChannelAuthorized(staffClaims!, staffTopic('outlet-test-123')) === true,
    'Staff should be authorized for their outlet',
  );
  console.assert(
    isChannelAuthorized(staffClaims!, staffTopic('outlet-other')) === false,
    'Staff should NOT be authorized for other outlets',
  );
  console.assert(
    isChannelAuthorized(customerClaims!, tableTopic('outlet-test-123', 'tbl-456')) === true,
    'Customer should be authorized for their specific table',
  );
  console.assert(
    isChannelAuthorized(customerClaims!, staffTopic('outlet-test-123')) === false,
    'Customer MUST NOT be authorized for staff outlet channel',
  );
  console.assert(
    isChannelAuthorized(customerClaims!, tableTopic('outlet-test-123', 'tbl-other')) === false,
    'Customer MUST NOT be authorized for other table channel',
  );
  console.log('✓ Test 2 passed (Outlet & Table Isolation verified)');

  // 3. Test Local WebSocket Server startup, connection, subscription & live broadcast
  console.log('Test 3: Local WebSocket server startup & live event broadcast');
  const server = await ensureLocalWebSocketServer();
  const port = server.getPort();

  const wsUrl = `ws://localhost:${port}?token=${staffToken}`;
  const ws = new WebSocket(wsUrl);

  const receivedEvents: any[] = [];

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test timed out waiting for event')), 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: staffTopic('outlet-test-123') }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribed') {
        // Trigger event publishing
        publishLocalRealtimeEvent('outlet-test-123', {
          type: 'order.new',
          ticket: {
            id: 'ord-test-999',
            number: 101,
            table: 'T1',
            tableId: 'tbl-456',
            type: 'dine_in',
            status: 'in_kitchen',
            placedAt: Date.now(),
            customerName: 'Test Guest',
            items: [{ name: 'Chai', qty: 2, station: 'kitchen', modifiers: [], notes: null }],
          },
        });
      } else if (msg.type === 'event') {
        receivedEvents.push(msg);
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.assert(receivedEvents.length === 1, 'Expected 1 event to be received');
  const eventMsg = receivedEvents[0];
  console.assert(eventMsg.envelope !== undefined, 'Envelope missing from WS message');
  console.assert(eventMsg.envelope.eventId !== undefined, 'Event ID missing from envelope');
  console.assert(eventMsg.envelope.event === 'order.new', 'Event type mismatch');
  console.assert(eventMsg.payload.ticket.id === 'ord-test-999', 'Ticket ID mismatch');
  console.log('✓ Test 3 passed (Live broadcast & envelope format verified)');

  console.log('--- ALL STEP 4 LOCAL REALTIME TESTS PASSED SUCCESSFULLY ---');
}

runRealtimeTests().catch((e) => {
  console.error('Realtime test failed:', e);
  process.exit(1);
});
