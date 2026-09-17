# BARBEX — PHASE 17C M3 AUTH MIGRATION STRATEGY

## OBJETIVO
Migrar as 10 identidades de usuários do projeto `wdxhjwodyctgzqtogkgv` para o projeto canônico `ywdwrstxvsdqiryhieiz` com preservação estrita dos UUIDs originais e integridade referencial com `profiles`, `barbers` e `customers`.

## 1. MÉTODO DE PRESERVAÇÃO DE UUIDs
- **Mecanismo Selecionado:** **Controlled SQL Bootstrap em `auth.users` e `auth.identities`**.
- **Justificativa:** A API administrativa `auth.admin.createUser()` gera UUIDs aleatórios internamente na maioria das versões GoTrue. A inserção direta controlada no schema `auth` via SQL Editor do target garante a preservação exata do `id` (UUID), garantindo integridade de chave estrangeira com `public.profiles.id`, `public.barbers.user_id` e `public.customers.auth_user_id`.

## 2. ESTRATÉGIA DE TRANSIÇÃO DE SENHAS
- Hashes de senha não são exportáveis pela API PostgREST do projeto legado.
- Todos os usuários serão provisionados como confirmados (`email_confirmed_at = NOW()`, `confirmed_at = NOW()`).
- **Transição no 1º Login:** Fluxo de ativação transparente via Redefinição de Senha (Password Reset / OTP).
- As sessões legadas expirarão naturalmente, exigindo reautenticação no novo host.

## 3. IDENTIDADES E PROVIDERS
- Criação de registros correspondentes na tabela `auth.identities` com `provider = 'email'` e `provider_id = email` para cada usuário.

## 4. INTEGRIDADE REFERENCIAL
- **Staff Barbers:** 8 barbeiros mapeados com `barbers.user_id -> profiles.id`.
- **Clientes com Portal:** 2 clientes com `customers.auth_user_id -> auth.users.id`.
- **Clientes Walk-in:** 10 clientes sem necessidade de conta Auth (`auth_user_id = null`).

## 5. REVERSÃO / ROLLBACK
- Em caso de necessidade de limpeza no target antes do cutover:
  `DELETE FROM auth.users WHERE id IN ('<migrated_uuids>');`
