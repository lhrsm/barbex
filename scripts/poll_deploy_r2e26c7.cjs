const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Barbex-R2E26C7-Poll', 'Cache-Control': 'no-cache' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.socket?.on('error', () => {});
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function pollUntilLive() {
  console.log('Iniciando monitoramento do deploy Vercel R2E.26C.7...');
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      const res = await get('https://barbex.shop/reception?t=' + Date.now());
      const assets = [...new Set(res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
      let apptModalAsset = assets.find(a => a.includes('AppointmentModal'));
      console.log(`[Tentativa ${attempt}] Status: ${res.status} | x-vercel-id: ${res.headers['x-vercel-id']} | AppointmentModal: ${apptModalAsset || 'não detectado'}`);

      if (apptModalAsset) {
        const aRes = await get('https://barbex.shop' + apptModalAsset);
        if (aRes.body.includes('stroke-[2.5]') || aRes.body.includes('text-zinc-900">Cadastrar novo cliente')) {
          console.log(`>>> SUCESSO! R2E.26C.7 ATIVO EM PRODUÇÃO NO ASSET: ${apptModalAsset}`);
          process.exit(0);
        }
      }
    } catch (e) {
      console.log(`[Tentativa ${attempt}] Erro:`, e.message);
    }
    await sleep(10000);
  }
  console.log('Timeout aguardando deploy Vercel.');
  process.exit(1);
}

pollUntilLive();
