const https = require('https');

function headOrGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', reject);
  });
}

async function smokeTest() {
  console.log("=== NON-DESTRUCTIVE PRODUCTION SMOKE TEST (R2E.25A.1) ===\n");
  const endpoints = [
    'https://barbex.shop/',
    'https://barbex.shop/dashboard',
    'https://barbex.shop/lm',
    'https://barbex.shop/calendar',
    'https://barbex.shop/auth',
    'https://barbex.shop/settings'
  ];

  let allOk = true;

  for (const url of endpoints) {
    try {
      const res = await headOrGet(url);
      console.log(`[HTTP ${res.status}] ${url} (x-vercel-id: ${res.headers['x-vercel-id'] || 'n/a'})`);
      if (res.status !== 200 && res.status !== 302 && res.status !== 307 && res.status !== 308) {
        allOk = false;
      }
    } catch (err) {
      console.error(`[FAIL] ${url}: ${err.message}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log("\n>>> ALL CRITICAL ENDPOINTS HEALTHY AND RESPONDING NORMALLY <<<");
  } else {
    process.exit(1);
  }
}

smokeTest();
