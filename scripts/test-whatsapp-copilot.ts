import dotenv from 'dotenv';
dotenv.config();

import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';

async function runTest() {
  console.log('🧪 Testing WhatsApp Merchant Copilot Engine...\n');

  // Test 1: Menu command
  console.log('--- Test 1: Sending "মেনু" ---');
  const res1 = await processMerchantWhatsAppMessage('01712345678', 'মেনু');
  console.log('Merchant:', res1.merchantName, '| Store:', res1.storeName);
  console.log('Reply:\n', res1.replyText);
  console.log('\n----------------------------------------\n');

  // Test 2: Order command
  console.log('--- Test 2: Sending "অর্ডার" ---');
  const res2 = await processMerchantWhatsAppMessage('01712345678', 'অর্ডার');
  console.log('Reply:\n', res2.replyText);
  console.log('\n----------------------------------------\n');

  // Test 3: Stock command
  console.log('--- Test 3: Sending "স্টক" ---');
  const res3 = await processMerchantWhatsAppMessage('01712345678', 'স্টক');
  console.log('Reply:\n', res3.replyText);
  console.log('\n----------------------------------------\n');

  // Test 4: Sales command
  console.log('--- Test 4: Sending "বিক্রি" ---');
  const res4 = await processMerchantWhatsAppMessage('01712345678', 'বিক্রি');
  console.log('Reply:\n', res4.replyText);
  console.log('\n----------------------------------------\n');

  // Test 5: Natural query
  console.log('--- Test 5: Sending "আজকের মোট লাভ কত?" ---');
  const res5 = await processMerchantWhatsAppMessage('01712345678', 'আজকের মোট লাভ কত?');
  console.log('Reply:\n', res5.replyText);
  console.log('\n----------------------------------------\n');

  console.log('🎉 All WhatsApp Merchant Copilot tests completed!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
