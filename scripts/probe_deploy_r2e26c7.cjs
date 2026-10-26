const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Barbex-R2E26C7-Probe', 'Cache-Control': 'no-cache' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.socket?.on('error', () => {});
  });
}

async function probeVercel() {
  console.log('=== VERIFICANDO DEPLOYMENT VERCEL R2E.26C.7 (https://barbex.shop) ===');
  console.log('Timestamp:', new Date().toISOString());

  const res = await get('https://barbex.shop/reception');
  console.log('Status /reception:', res.status);
  console.log('x-vercel-id:', res.headers['x-vercel-id']);
  console.log('Date:', res.headers['date']);

  const assets = [...new Set(res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
  console.log(`Assets detectados: ${assets.length}`);

  let foundNewBundle = false;
  let activeAppointmentBundle = null;
  for (const asset of assets) {
    if (asset.includes('AppointmentModal')) {
      activeAppointmentBundle = asset;
    }
    try {
      const aRes = await get('https://barbex.shop' + asset);
      if (aRes.body.includes('AppointmentModal-DTADoZRT') || (aRes.body.includes('text-zinc-900">Cadastrar novo cliente') && aRes.body.includes('stroke-[2.5]'))) {
        console.log(`>>> CONFIRMADO: R2E.26C.7 ATIVO NO ASSET ${asset}!`);
        foundNewBundle = true;
        break;
      }
    } catch (e) {
      // continue
    }
  }

  if (activeAppointmentBundle) {
    console.log('Bundle AppointmentModal detectado:', activeAppointmentBundle);
  }

  if (foundNewBundle) {
    console.log('[SUCCESS] Deployment R2E.26C.7 está LIVE em produção!');
    process.exit(0);
  } else {
    console.log('[PENDING] Novo bundle ainda está sendo processado pela Vercel...');
    process.exit(1);
  }
}

probeVercel().catch(e => {
  console.error('Probe error:', e.message);
  process.exit(1);
});
