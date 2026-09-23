import { extractBangladeshiPhone, extractCustomerName, extractPotentialAddress, convertBengaliToEnglishNumerals } from '../src/lib/agent-skills/sales-agent';
import { executeDataRetentionCleanup } from '../src/lib/data-retention';

async function testAll() {
  console.log('🧪 Testing Banglish NLP & Data Retention...');

  // 1. Bengali Digits
  const converted = convertBengaliToEnglishNumerals('০১৭৯৮৭৬৫৪৩২');
  console.log('Bengali Numeral Conversion:', converted === '01798765432' ? '✅ PASS' : '❌ FAIL');

  // 2. Banglish Phone Extraction
  const phone1 = extractBangladeshiPhone('vai amar number holo 01712-345678, amake send koren');
  const phone2 = extractBangladeshiPhone('amar phone: ০১৭১২৩৪৫৬৭৮');
  const phone3 = extractBangladeshiPhone('call me at +8801812345678');
  console.log('Banglish Phone 1:', phone1 === '01712345678' ? '✅ PASS' : '❌ FAIL', phone1);
  console.log('Banglish Phone 2 (Bengali Digits):', phone2 === '01712345678' ? '✅ PASS' : '❌ FAIL', phone2);
  console.log('Banglish Phone 3 (+880):', phone3 === '01812345678' ? '✅ PASS' : '❌ FAIL', phone3);

  // 3. Banglish Name Extraction
  const name1 = extractCustomerName('amar nam Tanvir Rahman, 1 ta lagbe');
  const name2 = extractCustomerName('name: Pritom Saha');
  console.log('Banglish Name 1:', name1 === 'Tanvir Rahman' ? '✅ PASS' : '❌ FAIL', name1);
  console.log('Banglish Name 2:', name2 === 'Pritom Saha' ? '✅ PASS' : '❌ FAIL', name2);

  // 4. Banglish Address Extraction
  const addr1 = extractPotentialAddress('amar thikana: Mirpur 10, Block C, Road 4, House 12');
  const addr2 = extractPotentialAddress('delivery address: House 23, Dhanmondi 27, Dhaka');
  console.log('Banglish Address 1:', addr1 ? '✅ PASS' : '❌ FAIL', addr1);
  console.log('Banglish Address 2:', addr2 ? '✅ PASS' : '❌ FAIL', addr2);

  // 5. Test Data Retention Clean Run
  const retention = await executeDataRetentionCleanup(90);
  console.log('Data Retention Execution:', retention.success ? '✅ PASS' : '❌ FAIL', retention);

  console.log('🎉 All automated tests completed!');
  process.exit(0);
}

testAll().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
