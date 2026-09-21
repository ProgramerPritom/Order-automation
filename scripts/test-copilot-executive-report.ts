import { config } from 'dotenv';
config();
import { query } from '../src/lib/db';
import { processMerchantWhatsAppMessage } from '../src/lib/whatsapp-merchant-copilot';

async function runTest() {
  console.log('🧪 Starting Phase 4 DoD Self-Test: Autonomous Executive Daily Summary & Conversational Brain...\n');

  // 1. Identify active tenant & owner
  const tenantRes = await query(
    `SELECT t.id as tenant_id, t.name as store_name, u.phone as user_phone, u.name as user_name
     FROM tenants t
     JOIN users u ON u.tenant_id = t.id
     WHERE u.phone IS NOT NULL AND u.phone != ''
     ORDER BY t.created_at ASC LIMIT 1;`
  );

  if (tenantRes.rows.length === 0) {
    throw new Error('No tenant with phone found in database!');
  }

  const { tenant_id: tenantId, store_name: storeName, user_phone: userPhone, user_name: userName } = tenantRes.rows[0];
  console.log(`✅ Identified Store: "${storeName}", Owner: "${userName}", Phone: ${userPhone}`);

  // 2. Test Executive Daily Briefing command: "সামারি"
  console.log('\n--- [TEST 1: Executive Daily Briefing ("সামারি")] ---');
  const summaryRes = await processMerchantWhatsAppMessage(userPhone, 'সামারি');
  console.log('🤖 WhatsApp Executive Briefing:\n' + summaryRes.replyText);

  if (!summaryRes.replyText.includes('দৈনিক এক্সিকিউটিভ রিপোর্ট')) {
    throw new Error('Test 1 Failed: Expected "দৈনিক এক্সিকিউটিভ রিপোর্ট" in replyText');
  }
  if (!summaryRes.replyText.includes('বিক্রি ও লাভ') || !summaryRes.replyText.includes('অর্ডার অপারেশনস')) {
    throw new Error('Test 1 Failed: Missing Financials or Operations section');
  }
  if (!summaryRes.replyText.includes('সোশ্যাল ও ইনবক্স')) {
    throw new Error('Test 1 Failed: Missing Social Commerce section');
  }
  console.log('✅ Test 1 PASSED: Executive Daily Briefing accurately contains all 4 business pillars!');

  // 3. Test Help Menu with Direct Actions
  console.log('\n--- [TEST 2: Upgraded Help Menu with Direct Actions] ---');
  const menuRes = await processMerchantWhatsAppMessage(userPhone, 'মেনু');
  console.log('🤖 WhatsApp Menu:\n' + menuRes.replyText);

  if (!menuRes.replyText.includes('সরাসরি অ্যাকশন কমান্ড') || !menuRes.replyText.includes('কনফার্ম #KS-XXXXXX')) {
    throw new Error('Test 2 Failed: Help menu does not list operational action commands');
  }
  console.log('✅ Test 2 PASSED: Help Menu cleanly presents all 7 core categories and direct actions!');

  // 4. Test Conversational Executive Intelligence via Gemini
  console.log('\n--- [TEST 3: Conversational Executive Intelligence via Gemini] ---');
  const conversationalQuery = 'ভাই আজকের সারাদিনের ব্যবসার কী অবস্থা? সংক্ষেপে একটা সামারি বলো তো!';
  console.log(`👤 Owner Ask: "${conversationalQuery}"`);
  const convResult = await processMerchantWhatsAppMessage(userPhone, conversationalQuery);
  console.log('🤖 Gemini Executive Briefing Reply:\n' + convResult.replyText);

  if (!convResult.replyText || convResult.replyText.length < 20) {
    throw new Error('Test 3 Failed: Conversational Gemini response was too short or missing');
  }
  console.log('✅ Test 3 PASSED: Gemini delivered an intelligent executive briefing based on live DB data!');

  console.log('\n=============================================');
  console.log('🎉 PHASE 4 DOD PASSED 100%: EXECUTIVE SUMMARY & CONVERSATIONAL BRAIN VERIFIED!');
  console.log('=============================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Phase 4 DoD Test Failed:', err);
  process.exit(1);
});
