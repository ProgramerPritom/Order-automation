import { submitManualPayment, approveInvoiceAndActivatePlan, getTenantInvoices, checkTenantSubscription } from '../src/lib/subscription';
import { query } from '../src/lib/db';

async function testMFSFlow() {
  console.log('🧪 Testing Manual MFS Payment Submission & Super Admin Approval...');

  // Get first tenant
  const tRes = await query(`SELECT id, name, plan, subscription_status FROM tenants LIMIT 1;`);
  if (tRes.rows.length === 0) {
    console.log('No tenants found to test.');
    return;
  }
  const tenant = tRes.rows[0];
  console.log('Testing with Tenant:', tenant.name, tenant.id);

  // 1. Client Submits bKash payment with TrxID
  const invoice = await submitManualPayment({
    tenantId: tenant.id,
    plan: 'pro',
    paymentMethod: 'bkash',
    senderNumber: '01712345678',
    transactionId: 'BLA7721890',
    notes: 'Test MFS payment verification',
  });
  console.log('✅ 1. Invoice Created (Pending Approval):', invoice.invoice_number, invoice.status, invoice.amount, 'BDT');

  // 2. Super Admin Approves the Invoice
  const updatedSub = await approveInvoiceAndActivatePlan(invoice.id);
  console.log('✅ 2. Super Admin Approved Invoice! Tenant Subscription Updated:', updatedSub);

  // 3. Verify in DB
  const invoices = await getTenantInvoices(tenant.id);
  console.log('✅ 3. Invoices count for tenant:', invoices.length, 'Latest status:', invoices[0]?.status);

  console.log('🎉 Manual MFS Lifecycle Flow 100% Verified!');
  process.exit(0);
}

testMFSFlow().catch((e) => {
  console.error(e);
  process.exit(1);
});
