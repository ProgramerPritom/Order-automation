import { pool } from '../src/lib/db';

async function testAuth() {
  const baseUrl = 'http://localhost:3000';
  const testPhone = '017' + Math.floor(10000000 + Math.random() * 90000000);
  const testEmail = `merchant_${Date.now()}@teststore.com`;
  const testPassword = 'Password123!';

  console.log('Testing Phone Auth with Phone:', testPhone);

  // 1. Register with Phone Number
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'সোহেল রানা',
      storeName: 'রানা ফ্যাশন জোন',
      phone: testPhone,
      email: testEmail,
      password: testPassword,
    }),
  });

  const regData = await regRes.json();
  console.log('1. Registration Status:', regRes.status);
  console.log('   User Phone:', regData?.user?.phone);
  console.log('   Tenant Phone:', regData?.tenant?.phone);
  if (regRes.status !== 201) {
    throw new Error('Registration failed: ' + JSON.stringify(regData));
  }

  // 2. Login with Phone Number
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testPhone,
      password: testPassword,
    }),
  });

  const loginData = await loginRes.json();
  console.log('2. Phone Login Status:', loginRes.status);
  console.log('   Logged in User:', loginData?.user?.name);
  console.log('   Token received:', !!loginData?.accessToken);
  if (loginRes.status !== 200 || !loginData.accessToken) {
    throw new Error('Phone Login failed: ' + JSON.stringify(loginData));
  }

  // 3. Login with Demo Phone (01700000000)
  const demoLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '01700000000',
      password: 'PritomSecure2026!',
    }),
  });

  const demoData = await demoLoginRes.json();
  console.log('3. Demo Phone (01700000000) Login Status:', demoLoginRes.status);
  console.log('   Demo Tenant Name:', demoData?.tenant?.name);
  if (demoLoginRes.status !== 200) {
    throw new Error('Demo Phone Login failed: ' + JSON.stringify(demoData));
  }

  console.log('✅ ALL PHONE NUMBER AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testAuth().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
