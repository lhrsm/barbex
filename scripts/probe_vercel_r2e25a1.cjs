const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function probeVercel() {
  console.log('--- PROBING VERCEL PRODUCTION DEPLOYMENT (R2E.25A.1) ---');
  console.log('Timestamp:', new Date().toISOString());

  const res = await get('https://barbex.shop/dashboard');
  console.log('Status: HTTP', res.status);
  console.log('x-vercel-id:', res.headers['x-vercel-id']);
  console.log('Date:', res.headers['date']);
  console.log('Age:', res.headers['age']);

  const dashboardIndexChunks = res.body.match(/\/assets\/dashboard\.index-[A-Za-z0-9_-]+\.js/g) || [];
  const appLayoutChunks = res.body.match(/\/assets\/AppLayout-[A-Za-z0-9_-]+\.js/g) || [];
  const allScriptChunks = res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [];

  console.log('Found dashboard.index chunks:', dashboardIndexChunks);
  console.log('Found total asset chunks:', allScriptChunks.length);

  let verified = false;

  for (const chunk of allScriptChunks.slice(0, 15)) {
    const chunkUrl = 'https://barbex.shop' + chunk;
    const chunkRes = await get(chunkUrl);
    if (chunkRes.body.includes('REFRESH_DASHBOARD_DATA')) {
      console.log(`[VERIFIED] Chunk ${chunk} contains REFRESH_DASHBOARD_DATA!`);
      verified = true;
    }
    if (chunkRes.body.includes('Ver Página Pública')) {
      console.log(`[VERIFIED] Chunk ${chunk} contains 'Ver Página Pública'!`);
      verified = true;
    }
  }

  if (verified) {
    console.log('\n>>> SUCCESS: R2E.25A.1 CODE IS CONFIRMED ACTIVE ON PRODUCTION VERCEL! <<<');
  } else {
    console.log('\n... Waiting for deployment propagation or checking other chunks ...');
  }
}

probeVercel();
