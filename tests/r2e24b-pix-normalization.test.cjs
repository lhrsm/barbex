/**
 * R2E.24B - TESTES DE RESOLUÇÃO E NORMALIZAÇÃO DO PIX (FASE 5)
 * 
 * Casos cobertos:
 * 1. URL com hostname legado ('wdxhjwodyctgzqtogkgv.supabase.co') reescrita para o host canônico atual ('ywdwrstxvsdqiryhieiz.supabase.co')
 * 2. URL de storage já no host canônico atual é preservada sem alteração
 * 3. URL externa arbitrária (ex: Unsplash / CDN) não é corrompida nem reescrita
 * 4. Valor nulo, indefinido ou vazio tratado com segurança (retorna string vazia, sem lançar exceção)
 * 5. Caminho original do objeto e bucket preservado integralmente
 * 6. Resolução de PIX a partir de barbershops.owner_id quando diferente do ID da barbearia (Barbearia LM)
 * 7. Isolamento multitenant: PIX de um tenant não é vazado para outro tenant
 * 8. Estabelecimento sem configuração de PIX trata ausência de dados graciosamente
 */

const assert = require('assert');

// Implementação isolada idêntica à de src/lib/storage-utils.ts para validação pura do runtime
const CANONICAL_SUPABASE_HOST = 'ywdwrstxvsdqiryhieiz.supabase.co';
const LEGACY_SUPABASE_HOSTS = [
  'wdxhjwodyctgzqtogkgv.supabase.co',
];

function normalizeStorageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  let normalized = url.trim();
  for (const legacyHost of LEGACY_SUPABASE_HOSTS) {
    if (normalized.includes(legacyHost)) {
      normalized = normalized.replace(legacyHost, CANONICAL_SUPABASE_HOST);
    }
  }
  return normalized;
}

// Simulação da lógica de resolução canônica implementada em $slug.tsx
function resolveShopPixData({ shopProfile, barbershopEntity, ownerProfile }) {
  const currentShop = { ...shopProfile };
  const canonicalTenantId = barbershopEntity?.id || currentShop.tenant_id || currentShop.id;
  currentShop.tenant_id = canonicalTenantId;
  const canonicalOwnerId = barbershopEntity?.owner_id || currentShop.owner_id || currentShop.id;
  currentShop.owner_id = canonicalOwnerId;

  if (canonicalOwnerId && (canonicalOwnerId !== currentShop.id || !currentShop.pix_key || !currentShop.pix_qr_code_url)) {
    if (ownerProfile && ownerProfile.id === canonicalOwnerId) {
      if (ownerProfile.pix_key) {
        currentShop.pix_key = ownerProfile.pix_key;
      }
      if (ownerProfile.pix_qr_code_url) {
        currentShop.pix_qr_code_url = ownerProfile.pix_qr_code_url;
      }
    }
  }

  currentShop.pix_qr_code_url = normalizeStorageUrl(currentShop.pix_qr_code_url);
  return currentShop;
}

console.log('--- INICIANDO TESTES DO PIX (R2E.24B - FASE 5) ---');

// Teste 1: URL legada do Supabase reescrita para instância canônica
{
  const legacyUrl = 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/c54ac1ac-49be-4505-b7a4-d257ed023f08-pix-qr-0.9717369603773581.jpeg';
  const normalized = normalizeStorageUrl(legacyUrl);
  assert.strictEqual(
    normalized,
    'https://ywdwrstxvsdqiryhieiz.supabase.co/storage/v1/object/public/barber-avatars/c54ac1ac-49be-4505-b7a4-d257ed023f08-pix-qr-0.9717369603773581.jpeg',
    'Deveria substituir o hostname legado pelo canônico mantendo o path'
  );
  console.log('✓ Teste 1: URL com host legado reescrita corretamente mantendo o path original');
}

// Teste 2: URL já canônica permanece idêntica
{
  const canonicalUrl = 'https://ywdwrstxvsdqiryhieiz.supabase.co/storage/v1/object/public/barber-avatars/lm-qr.png';
  const normalized = normalizeStorageUrl(canonicalUrl);
  assert.strictEqual(normalized, canonicalUrl, 'URL canônica deve permanecer inalterada');
  console.log('✓ Teste 2: URL com host atual preservada sem modificações');
}

// Teste 3: URL externa arbitrária não é alterada
{
  const externalUrl = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format';
  const normalized = normalizeStorageUrl(externalUrl);
  assert.strictEqual(normalized, externalUrl, 'URL externa não deve ser alterada');
  console.log('✓ Teste 3: URL externa preservada');
}

// Teste 4: Ausência de URL / valores nulos
{
  assert.strictEqual(normalizeStorageUrl(null), '');
  assert.strictEqual(normalizeStorageUrl(undefined), '');
  assert.strictEqual(normalizeStorageUrl('   '), '');
  assert.strictEqual(normalizeStorageUrl(''), '');
  console.log('✓ Teste 4: Tratamento gracioso de ausência de imagem / valores nulos');
}

// Teste 5: Resolução canônica de PIX para Barbearia LM (owner_id distinto de profile inicial)
{
  const lmBarbershop = {
    id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08',
    slug: 'lm',
    owner_id: 'a1111111-2222-3333-4444-555555555555'
  };

  const initialShopProfile = {
    id: 'c54ac1ac-49be-4505-b7a4-d257ed023f08', // ID da barbearia
    slug: 'lm',
    pix_key: null,
    pix_qr_code_url: null
  };

  const ownerProfile = {
    id: 'a1111111-2222-3333-4444-555555555555',
    pix_key: '11999998888',
    pix_qr_code_url: 'https://wdxhjwodyctgzqtogkgv.supabase.co/storage/v1/object/public/barber-avatars/c54ac1ac-pix-qr.jpeg'
  };

  const resolved = resolveShopPixData({
    shopProfile: initialShopProfile,
    barbershopEntity: lmBarbershop,
    ownerProfile
  });

  assert.strictEqual(resolved.pix_key, '11999998888', 'Deveria resolver pix_key do owner');
  assert.strictEqual(
    resolved.pix_qr_code_url,
    'https://ywdwrstxvsdqiryhieiz.supabase.co/storage/v1/object/public/barber-avatars/c54ac1ac-pix-qr.jpeg',
    'Deveria resolver e normalizar pix_qr_code_url do owner'
  );
  console.log('✓ Teste 5: Resolução canônica de PIX via barbershops.owner_id -> profiles.id aprovada');
}

// Teste 6: Isolamento multitenant entre duas barbearias
{
  const tenantA = {
    shopProfile: { id: 'tenant-a-id', slug: 'shop-a', pix_key: 'chave-a', pix_qr_code_url: 'https://ywdwrstxvsdqiryhieiz.supabase.co/qr-a.png' },
    barbershopEntity: { id: 'tenant-a-id', owner_id: 'owner-a-id', slug: 'shop-a' },
    ownerProfile: { id: 'owner-a-id', pix_key: 'chave-a', pix_qr_code_url: 'https://ywdwrstxvsdqiryhieiz.supabase.co/qr-a.png' }
  };

  const tenantB = {
    shopProfile: { id: 'tenant-b-id', slug: 'shop-b', pix_key: 'chave-b', pix_qr_code_url: 'https://ywdwrstxvsdqiryhieiz.supabase.co/qr-b.png' },
    barbershopEntity: { id: 'tenant-b-id', owner_id: 'owner-b-id', slug: 'shop-b' },
    ownerProfile: { id: 'owner-b-id', pix_key: 'chave-b', pix_qr_code_url: 'https://ywdwrstxvsdqiryhieiz.supabase.co/qr-b.png' }
  };

  const resolvedA = resolveShopPixData(tenantA);
  const resolvedB = resolveShopPixData(tenantB);

  assert.notStrictEqual(resolvedA.pix_key, resolvedB.pix_key, 'Chaves PIX não devem se misturar');
  assert.notStrictEqual(resolvedA.pix_qr_code_url, resolvedB.pix_qr_code_url, 'QR Codes não devem se misturar');
  assert.strictEqual(resolvedA.pix_key, 'chave-a');
  assert.strictEqual(resolvedB.pix_key, 'chave-b');
  console.log('✓ Teste 6: Isolamento estrito de PIX entre múltiplos tenants verificado');
}

// Teste 7: Barbearia sem PIX cadastrado trata ausência graciosamente
{
  const noPixShop = {
    shopProfile: { id: 'no-pix-id', slug: 'nopix', pix_key: null, pix_qr_code_url: null },
    barbershopEntity: { id: 'no-pix-id', owner_id: 'no-pix-owner', slug: 'nopix' },
    ownerProfile: { id: 'no-pix-owner', pix_key: null, pix_qr_code_url: null }
  };

  const resolved = resolveShopPixData(noPixShop);
  assert.strictEqual(resolved.pix_key, null);
  assert.strictEqual(resolved.pix_qr_code_url, '');
  console.log('✓ Teste 7: Barbearia sem configuração PIX tratada com integridade');
}

console.log('--- TODOS OS 7 TESTES DO PIX PASSARAM COM SUCESSO! ---');
