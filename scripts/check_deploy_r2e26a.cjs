const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Barbex-Deploy-Check' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function checkDeploy() {
  console.log('=== VERIFICANDO STATUS DE DEPLOY EM https://barbex.shop ===');
  const res = await get('https://barbex.shop/reception');
  console.log('Status /reception:', res.status);
  console.log('Vercel ID:', res.headers['x-vercel-id']);
  console.log('Vercel Cache:', res.headers['x-vercel-cache']);
  console.log('Date:', res.headers['date']);

  // Procurar por chunks no body
  const chunks = [...new Set(res.body.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || [])];
  console.log(`Encontrados ${chunks.length} chunks em /reception.`);
  
  // Vamos inspecionar chunks relacionados a reception ou calendar ou sync
  let foundSync = false;
  for (const chunk of chunks) {
    if (chunk.includes('reception') || chunk.includes('sync') || chunk.includes('calendar') || chunk.includes('Appointment')) {
      console.log('Checando chunk:', chunk);
      const cRes = await get('https://barbex.shop' + chunk);
      if (cRes.body.includes('REFRESH_APPOINTMENTS_DATA') || cRes.body.includes('sync-appointments') || cRes.body.includes('reception-queue')) {
        console.log('-> DETECTADO REFRESH_APPOINTMENTS_DATA / sync no chunk:', chunk);
        foundSync = true;
      }
    }
  }
  return { status: res.status, foundSync, chunksCount: chunks.length };
}

checkDeploy().then(res => console.log('Resultado:', res)).catch(console.error);
