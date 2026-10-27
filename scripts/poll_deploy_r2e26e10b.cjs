const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Barbex-R2E26E10B-Poll', 'Cache-Control': 'no-cache, no-store' } }, res => {
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
  console.log('Iniciando monitoramento do deploy Vercel R2E.26E.10B (Hotfix UUID)...');
  const targetSignature = 'conta de usuário ativa (UUID) vinculada ao sistema';
  const targetSignature2 = 'identificador canônico (UUID) do colaborador';

  for (let attempt = 1; attempt <= 45; attempt++) {
    try {
      const res = await get('https://barbex.shop/dashboard/usuarios?t=' + Date.now());
      const assets = [...new Set(res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
      
      console.log(`[Tentativa ${attempt}] Status: ${res.status} | x-vercel-id: ${res.headers['x-vercel-id'] || 'none'} | assets: ${assets.length}`);

      for (const asset of assets) {
        const aRes = await get('https://barbex.shop' + asset);
        if (aRes.body.includes(targetSignature) || aRes.body.includes(targetSignature2)) {
          console.log(`\n>>> SUCESSO! R2E.26E.10B ATIVO EM PRODUÇÃO NO ASSET: ${asset}`);
          return;
        }

        // Buscar chunks secundários importados
        const subChunks = aRes.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [];
        for (const sc of subChunks) {
          const scRes = await get('https://barbex.shop' + sc);
          if (scRes.body.includes(targetSignature) || scRes.body.includes(targetSignature2)) {
            console.log(`\n>>> SUCESSO! R2E.26E.10B ATIVO NO SUB-CHUNK: ${sc}`);
            return;
          }
        }
      }
    } catch (e) {
      console.log(`[Tentativa ${attempt}] Erro:`, e.message);
    }
    await sleep(8000);
  }
  console.log('Timeout aguardando deploy Vercel.');
  process.exit(1);
}

pollUntilLive();
