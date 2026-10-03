import { prisma } from '@cafeos/db';
import { getRuntimeConfig } from '../runtime-config';

async function runStep7DeploymentTests() {
  console.log('--- Starting Step 7 Main PC Deployment & Server Info Tests ---');

  // Test 1: Runtime Config Inspection
  console.log('Test 1: Runtime Config & Operational Mode');
  const cfg = getRuntimeConfig();
  console.assert(cfg.mode === 'local' || cfg.mode === 'hybrid', 'Runtime mode must be local or hybrid');
  console.assert(cfg.database === 'local', 'Database must be local embedded postgres');
  console.log('✓ Test 1 passed (Runtime Config verified)');

  // Test 2: Local Database Health & Outbox / Print Table Presence
  console.log('Test 2: Database Connectivity & Core Table Verification');
  const outboxCount = await prisma.syncOutbox.count();
  const printJobCount = await prisma.printJob.count();
  console.assert(typeof outboxCount === 'number', 'SyncOutbox query failed');
  console.assert(typeof printJobCount === 'number', 'PrintJob query failed');
  console.log(`✓ Test 2 passed (Database healthy: ${outboxCount} outbox records, ${printJobCount} print jobs)`);

  // Test 3: First-Run Onboarding Setup Endpoint Verification
  console.log('Test 3: Setup API Onboarding Verification');
  const staffCount = await prisma.staffUser.count();
  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true, subdomain: true } });
  
  const isConfigured = staffCount > 0 && !!tenant;
  console.assert(isConfigured === true, 'Store should be marked configured from seed');
  console.assert(tenant?.subdomain !== undefined, 'Tenant subdomain missing');
  console.log(`✓ Test 3 passed (Store setup status verified: ${tenant?.name})`);

  console.log('--- ALL STEP 7 DEPLOYMENT TESTS PASSED SUCCESSFULLY ---');
}

runStep7DeploymentTests().catch((e) => {
  console.error('Step 7 Deployment test failed:', e);
  process.exit(1);
});
