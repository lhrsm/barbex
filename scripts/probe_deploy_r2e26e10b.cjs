const https = require('https');

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Barbex-Probe-10B', 'Cache-Control': 'no-cache, no-store' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

async function probe() {
  console.log('Consultando https://barbex.shop/dashboard/usuarios...');
  const res = await fetchUrl('https://barbex.shop/dashboard/usuarios?t=' + Date.now());
  console.log(`Status: ${res.status}`);
  console.log(`Vercel ID: ${res.headers['x-vercel-id'] || 'none'}`);
  
  const assets = [...new Set(res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
  console.log(`Total de assets encontrados: ${assets.length}`);
  const userAsset = assets.find(a => a.includes('dashboard.usuarios'));
  console.log(`Asset dashboard.usuarios: ${userAsset || 'NÃO ENCONTRADO'}`);

  if (userAsset) {
    console.log(`Baixando asset ${userAsset}...`);
    const aRes = await fetchUrl('https://barbex.shop' + userAsset);
    console.log(`Tamanho do bundle: ${aRes.body.length} bytes`);
    
    // Verificar se contém o código do modal ou importações
    const hasCanonicalNotice = aRes.body.includes('identificador canônico (UUID) do colaborador');
    const hasActiveAccountNotice = aRes.body.includes('conta de usuário ativa (UUID) vinculada ao sistema');
    const hasRoleRpc = aRes.body.includes('change_tenant_team_member_role');
    
    console.log(`- Contém change_tenant_team_member_role: ${hasRoleRpc}`);
    console.log(`- Contém mensagem de UUID canônico: ${hasCanonicalNotice}`);
    console.log(`- Contém bloqueio de conta de usuário ativa (UUID): ${hasActiveAccountNotice}`);

    // Buscar submódulos se não estiver no bundle principal
    const subChunks = [...new Set(aRes.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
    console.log(`Sub-chunks encontrados em dashboard.usuarios: ${subChunks.length}`);
    for (const sc of subChunks) {
      try {
        const scRes = await fetchUrl('https://barbex.shop' + sc);
        if (scRes.body.includes('identificador canônico (UUID) do colaborador') || scRes.body.includes('conta de usuário ativa (UUID) vinculada ao sistema')) {
          console.log(`>>> SUCESSO! Assinatura R2E.26E.10B confirmada no sub-chunk: ${sc}`);
          return true;
        }
      } catch (e) {
        console.log(`Erro ao baixar subchunk ${sc}: ${e.message}`);
      }
    }

    if (hasCanonicalNotice || hasActiveAccountNotice) {
      console.log('>>> SUCESSO! Assinatura R2E.26E.10B confirmada no bundle principal!');
      return true;
    }
  }

  return false;
}

probe().then(live => {
  if (live) {
    console.log('\n=== GATE 3 APROVADO: DEPLOY VERCEL R2E.26E.10B CONFIRMADO ATIVO EM PRODUÇÃO ===');
  } else {
    console.log('\nDeploy ainda em processamento ou aguardando propagação.');
  }
}).catch(err => {
  console.error('Erro na sondagem:', err);
});
