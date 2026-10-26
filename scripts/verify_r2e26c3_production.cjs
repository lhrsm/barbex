const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function monitorDeployment() {
  console.log("=== MONITORAMENTO DO DEPLOYMENT R2E.26C.3 NA VERCEL ===");
  console.log("Timestamp:", new Date().toISOString());

  const targetUrl = 'https://barbex.shop/reception';
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n[Tentativa ${attempts}/${maxAttempts}] Consultando ${targetUrl}...`);
    const res = await fetchUrl(targetUrl);
    
    if (res.error) {
      console.log(`Erro na conexão: ${res.error}`);
    } else {
      console.log(`Status HTTP: ${res.status} | x-vercel-id: ${res.headers['x-vercel-id']}`);
      
      // Procurar chunks no HTML
      const chunkMatches = res.body ? res.body.match(/\/assets\/[a-zA-Z0-9_\-]+\.js/g) : null;
      if (chunkMatches && chunkMatches.length > 0) {
        console.log(`Encontrados ${chunkMatches.length} chunks no HTML`);
        
        // Verificar se os assets trazem o seletor atualizado com a busca de profissional
        for (const chunk of chunkMatches) {
          const chunkRes = await fetchUrl(`https://barbex.shop${chunk}`);
          if (chunkRes.body && chunkRes.body.includes("Buscar profissional por nome")) {
            console.log("\n>>> CONFIRMADO: Novo bundle R2E.26C.3 ATIVO em produção! <<<");
            console.log("Asset com evidência:", chunk);
            console.log("Vercel ID ativo:", res.headers['x-vercel-id']);
            console.log("\nDeployment R2E.26C.3 validado com sucesso em produção!");
            return true;
          }
        }
      }
    }

    console.log("Aguardando 10 segundos antes da próxima verificação...");
    await new Promise((r) => setTimeout(r, 10000));
  }

  console.error("Timeout aguardando deployment da Vercel.");
  process.exit(1);
}

monitorDeployment();
