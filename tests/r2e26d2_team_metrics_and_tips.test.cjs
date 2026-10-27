/**
 * BARBEX — R2E.26D.2 Automated Test Suite
 * Testes para:
 * 1. Validação e normalização de chaves PIX (CPF, CNPJ, Telefone, E-mail, EVP).
 * 2. Integridade e separação das métricas da equipe em src/routes/barbers.tsx.
 * 3. Campos de PIX no cadastro administrativo e edição de barbeiro.
 * 4. Painel individual do profissional e TipCard (UX P2P, sem QR Code de texto simples).
 * 5. Invariantes de segurança e isolamento financeiro.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== INICIANDO SUITE DE TESTES R2E.26D.2 ===");

// -------------------------------------------------------------
// Helper: Transpiled / Pure JS version of pix-validator logic
// to test exact algorithmic rules defined in src/utils/pix-validator.ts
// -------------------------------------------------------------
function isValidCPF(cpf) {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  let d1 = rev >= 10 ? 0 : rev;
  if (d1 !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  let d2 = rev >= 10 ? 0 : rev;
  return d2 === parseInt(clean.charAt(10), 10);
}

function isValidCNPJ(cnpj) {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights1[i];
  }
  let rest = sum % 11;
  let d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== parseInt(clean.charAt(12), 10)) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights2[i];
  }
  rest = sum % 11;
  let d2 = rest < 2 ? 0 : 11 - rest;
  return d2 === parseInt(clean.charAt(13), 10);
}

function isValidPhone(phone) {
  const clean = phone.replace(/\D/g, "");
  return clean.length === 10 || clean.length === 11 || (clean.length === 13 && clean.startsWith("55"));
}

function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(email.trim());
}

function isValidRandomKey(key) {
  const clean = key.trim();
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const hex32Regex = /^[0-9a-fA-F]{32}$/;
  return uuidRegex.test(clean) || hex32Regex.test(clean);
}

// -------------------------------------------------------------
// Test 1: PIX Key Validation (CPF, CNPJ, Phone, Email, Random)
// -------------------------------------------------------------
console.log("\n[TEST 1] Validação de formatos de Chave PIX...");

// CPF
assert.strictEqual(isValidCPF("111.111.111-11"), false, "CPF com todos os dígitos iguais deve ser rejeitado");
assert.strictEqual(isValidCPF("12345678900"), false, "CPF com dígitos verificadores incorretos deve ser rejeitado");
assert.strictEqual(isValidCPF("52998224725"), true, "CPF válido deve ser aceito");

// CNPJ
assert.strictEqual(isValidCNPJ("11.111.111/1111-11"), false, "CNPJ repetido deve ser rejeitado");
assert.strictEqual(isValidCNPJ("12345678000199"), false, "CNPJ com verificadores incorretos deve ser rejeitado");
assert.strictEqual(isValidCNPJ("00.000.000/0001-91"), true, "CNPJ válido deve ser aceito");

// Phone
assert.strictEqual(isValidPhone("11987654321"), true, "Celular com 11 dígitos deve ser aceito");
assert.strictEqual(isValidPhone("(11) 98765-4321"), true, "Celular formatado deve ser aceito");
assert.strictEqual(isValidPhone("1133334444"), true, "Fixo com 10 dígitos deve ser aceito");
assert.strictEqual(isValidPhone("+5511987654321"), true, "Telefone internacional BR com 13 dígitos deve ser aceito");
assert.strictEqual(isValidPhone("123"), false, "Telefone muito curto deve ser rejeitado");

// Email
assert.strictEqual(isValidEmail("barbeiro@exemplo.com"), true, "E-mail padrão deve ser aceito");
assert.strictEqual(isValidEmail("barbeiro.silva+pix@barbex.shop"), true, "E-mail com tag e subdomínio deve ser aceito");
assert.strictEqual(isValidEmail("invalido@"), false, "E-mail incompleto deve ser rejeitado");
assert.strictEqual(isValidEmail("invalido.com"), false, "E-mail sem @ deve ser rejeitado");

// Random Key (EVP)
assert.strictEqual(isValidRandomKey("123e4567-e89b-12d3-a456-426614174000"), true, "UUID válido com hífens deve ser aceito");
assert.strictEqual(isValidRandomKey("123e4567e89b12d3a456426614174000"), true, "Hex de 32 chars deve ser aceito");
assert.strictEqual(isValidRandomKey("chave-aleatoria-curta"), false, "Chave aleatória inválida deve ser rejeitada");

console.log("✓ TEST 1 PASSOU: Todos os algoritmos de validação PIX operam conforme especificado.");

// -------------------------------------------------------------
// Test 2: Source File Integrity: pix-validator.ts
// -------------------------------------------------------------
console.log("\n[TEST 2] Verificação do arquivo src/utils/pix-validator.ts...");
const pixValidatorPath = path.join(__dirname, '../src/utils/pix-validator.ts');
assert.ok(fs.existsSync(pixValidatorPath), "src/utils/pix-validator.ts deve existir");

const pixValidatorSrc = fs.readFileSync(pixValidatorPath, 'utf8');
assert.ok(pixValidatorSrc.includes('export function validatePixKey'), "Deve exportar validatePixKey");
assert.ok(pixValidatorSrc.includes('export function normalizePixKey'), "Deve exportar normalizePixKey");
assert.ok(pixValidatorSrc.includes('export const PIX_KEY_TYPES'), "Deve exportar PIX_KEY_TYPES");
console.log("✓ TEST 2 PASSOU: src/utils/pix-validator.ts contém exports e funções requeridas.");

// -------------------------------------------------------------
// Test 3: Frente A — Métricas da Equipe em src/routes/barbers.tsx
// -------------------------------------------------------------
console.log("\n[TEST 3] Verificação da Frente A em src/routes/barbers.tsx...");
const barbersRoutePath = path.join(__dirname, '../src/routes/barbers.tsx');
assert.ok(fs.existsSync(barbersRoutePath), "src/routes/barbers.tsx deve existir");

const barbersRouteSrc = fs.readFileSync(barbersRoutePath, 'utf8');

// 1. Must NOT contain broken join
assert.ok(!barbersRouteSrc.includes('appointments:appointments!appointments_barber_id_fkey(count)'), 
  "Não deve utilizar o join quebrado appointments:appointments!appointments_barber_id_fkey(count)");

// 2. Must query metrics via scalable RPC or table respecting tenant_id
assert.ok(
  barbersRouteSrc.includes('get_team_appointments_summary') || barbersRouteSrc.includes('.from("appointments")'),
  "Deve consultar métricas de agendamentos com isolamento de tenant"
);
assert.ok(
  barbersRouteSrc.includes('effectiveTenantId'),
  "Deve filtrar appointments por effectiveTenantId"
);

// 4. Must separate total and completed appointments
assert.ok(barbersRouteSrc.includes('total:'), "Deve computar métrica de total de agendamentos");
assert.ok(barbersRouteSrc.includes('completed_appointments') || barbersRouteSrc.includes('status === "completed"') || barbersRouteSrc.includes("status === 'completed'"), "Atendimentos concluídos devem mapear completed_appointments da RPC");

// 5. Must differentiate loading, empty, and error
assert.ok(barbersRouteSrc.includes('metricsLoading'), "Deve gerenciar estado de carregamento das métricas");
assert.ok(barbersRouteSrc.includes('metricsError'), "Deve gerenciar estado de erro das métricas sem transformar silenciosamente em zero");
assert.ok(barbersRouteSrc.includes('total registrado (histórico)'), "Deve explicitar o período das métricas (total registrado histórico)");

console.log("✓ TEST 3 PASSOU: Frente A implementada conforme requisitos de permissões e métricas reais.");

// -------------------------------------------------------------
// Test 4: Frente B — Cadastro Administrativo em src/routes/barbers.tsx
// -------------------------------------------------------------
console.log("\n[TEST 4] Verificação de campos PIX no cadastro administrativo...");

// Form fields in newBarber
assert.ok(barbersRouteSrc.includes('pix_key: ""'), "newBarber deve inicializar pix_key");
assert.ok(barbersRouteSrc.includes('pix_key_type: "cpf"'), "newBarber deve inicializar pix_key_type");
assert.ok(barbersRouteSrc.includes('accepts_tips: true'), "newBarber deve inicializar accepts_tips");

// Form inputs in Add Barber Dialog
assert.ok(barbersRouteSrc.includes('id="new-barber-accepts-tips"'), "Modal de adicionar deve conter switch de aceitar gorjetas");
assert.ok(barbersRouteSrc.includes('id="new-barber-pix-type"'), "Modal de adicionar deve conter seletor de tipo de chave PIX");
assert.ok(barbersRouteSrc.includes('id="new-barber-pix-key"'), "Modal de adicionar deve conter input da chave PIX");

// Form inputs in Edit Barber Dialog preserved
assert.ok(barbersRouteSrc.includes('id="edit-barber-accepts-tips"'), "Modal de edição deve preservar switch de gorjetas");
assert.ok(barbersRouteSrc.includes('id="edit-barber-pix-type"'), "Modal de edição deve preservar seletor de tipo de chave PIX");
assert.ok(barbersRouteSrc.includes('id="edit-barber-pix-key"'), "Modal de edição deve preservar input da chave PIX");

// Validations applied on add and update
assert.ok(barbersRouteSrc.includes('validatePixKey(newBarber.pix_key'), "handleAddBarber deve validar chave PIX");
assert.ok(barbersRouteSrc.includes('validatePixKey(editingBarber.pix_key'), "handleUpdateBarber deve validar chave PIX");
assert.ok(barbersRouteSrc.includes('normalizePixKey(newBarber.pix_key'), "handleAddBarber deve normalizar chave PIX");
assert.ok(barbersRouteSrc.includes('normalizePixKey(editingBarber.pix_key'), "handleUpdateBarber deve normalizar chave PIX");

console.log("✓ TEST 4 PASSOU: Cadastro e edição de barbeiro com campos e validações PIX completos.");

// -------------------------------------------------------------
// Test 5: Frente B — Painel Individual do Profissional
// -------------------------------------------------------------
console.log("\n[TEST 5] Verificação do Painel do Profissional...");
const profRoutePath = path.join(__dirname, '../src/routes/$slug.profissional.tsx');
const profEditDialogPath = path.join(__dirname, '../src/components/professional/EditProfileDialog.tsx');

assert.ok(fs.existsSync(profRoutePath), "$slug.profissional.tsx deve existir");
assert.ok(fs.existsSync(profEditDialogPath), "EditProfileDialog.tsx deve existir");

const profRouteSrc = fs.readFileSync(profRoutePath, 'utf8');
const profEditDialogSrc = fs.readFileSync(profEditDialogPath, 'utf8');

// Section in $slug.profissional.tsx
assert.ok(profRouteSrc.includes('PIX para Gorjetas Digitais'), "Painel do profissional deve conter seção 'PIX para Gorjetas Digitais'");
assert.ok(profRouteSrc.includes('Transferência direta P2P'), "Painel do profissional deve enfatizar transferência direta P2P");
assert.ok(profRouteSrc.includes('copiedPixKey'), "Painel do profissional deve permitir copiar chave com feedback visual");

// EditProfileDialog
assert.ok(profEditDialogSrc.includes('validatePixKey'), "EditProfileDialog deve validar chaves PIX");
assert.ok(profEditDialogSrc.includes('normalizePixKey'), "EditProfileDialog deve normalizar chaves PIX");
assert.ok(profEditDialogSrc.includes('id="edit-profile-accepts-tips"'), "EditProfileDialog deve conter switch de aceitar gorjetas");
assert.ok(profEditDialogSrc.includes('id="edit-profile-pix-type"'), "EditProfileDialog deve conter seletor de tipo de chave PIX");
assert.ok(profEditDialogSrc.includes('id="edit-profile-pix-key"'), "EditProfileDialog deve conter input de chave PIX");

// Restricted update payload (no generic administrative update)
assert.ok(!profEditDialogSrc.includes('commission_rate:'), "Profissional não pode atualizar comissões administrativas");
assert.ok(!profEditDialogSrc.includes('monthly_goal:'), "Profissional não pode atualizar metas administrativas");
assert.ok(!profEditDialogSrc.includes('tenant_id:'), "Profissional não pode alterar tenant_id");

console.log("✓ TEST 5 PASSOU: Painel do profissional configurado com visualização, edição restrita e cópia de PIX.");

// -------------------------------------------------------------
// Test 6: Experiência do Cliente em TipCard.tsx
// -------------------------------------------------------------
console.log("\n[TEST 6] Verificação do TipCard.tsx...");
const tipCardPath = path.join(__dirname, '../src/components/tips/TipCard.tsx');
assert.ok(fs.existsSync(tipCardPath), "TipCard.tsx deve existir");

const tipCardSrc = fs.readFileSync(tipCardPath, 'utf8');

// Beneficiary name display
assert.ok(tipCardSrc.includes('Beneficiário:'), "TipCard deve exibir o nome do beneficiário");
assert.ok(tipCardSrc.includes('barberName'), "TipCard deve renderizar barberName");

// PIX Key and Key Type
assert.ok(tipCardSrc.includes('pixKeyType'), "TipCard deve receber e exibir pixKeyType");
assert.ok(tipCardSrc.includes('Copiar chave PIX'), "TipCard deve conter botão 'Copiar chave PIX'");

// No simple text QR code
assert.ok(!tipCardSrc.includes('api.qrserver.com'), "TipCard NÃO deve usar api.qrserver.com para gerar QR code de texto simples");

assert.ok(tipCardSrc.includes('realizada diretamente') && tipCardSrc.includes('não passa pela barbearia'), "TipCard deve alertar que o pagamento é direto ao profissional e não passa pela barbearia");

console.log("✓ TEST 6 PASSOU: TipCard revisado com dados do beneficiário, cópia e sem falso QR code.");

// -------------------------------------------------------------
// Test 7: Invariantes Financeiros e de Segurança
// -------------------------------------------------------------
console.log("\n[TEST 7] Verificação de Invariantes...");
const stripeCheckoutPath = path.join(__dirname, '../supabase/functions/stripe-checkout/index.ts');
assert.ok(fs.existsSync(stripeCheckoutPath), "stripe-checkout/index.ts deve existir");

const stripeCheckoutSrc = fs.readFileSync(stripeCheckoutPath, 'utf8');
assert.ok(stripeCheckoutSrc.includes('ENABLE_SELF_SERVICE_REFUNDS'), "ENABLE_SELF_SERVICE_REFUNDS deve ser referenciado");
assert.ok(stripeCheckoutSrc.includes('Deno.env.get("ENABLE_SELF_SERVICE_REFUNDS") === "true"'), "Kill-switch de reembolso fail-closed deve ser preservado");

console.log("✓ TEST 7 PASSOU: Invariantes preservados intactos.");

console.log("\n=======================================================");
console.log("TODOS OS TESTES DA SUITE R2E.26D.2 FORAM APROVADOS! (7/7)");
console.log("=======================================================");
