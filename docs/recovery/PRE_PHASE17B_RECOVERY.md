# PRE-PHASE17B RECOVERY PLAN & MASTER BASELINE

Este documento estabelece o procedimento formal de restauração e os metadados de segurança capturados imediatamente antes do início da **Phase 17B (Login por Telefone)**.

---

## 1. Identificadores Canônicos de Recuperação
- **Commit Estável:** `08016f7608cb193db3c00871d3f2808cec776f9b`
- **Tag Git Anotada:** `pre-phase17b-stable`
- **Branch de Recuperação:** `backup/pre-phase17b-stable`
- **Branch Principal:** `main`
- **Remote:** `https://github.com/lhrsm/barbex`

---

## 2. Inventário de Dados e Schemas de Backup
- **Localização dos Dumps:** `backups/pre-phase17b/` (ignorado no Git para proteção de dados)
- **Database Schema Dump:** `backups/pre-phase17b/database-schema.sql`
- **Database Data Dump:** `backups/pre-phase17b/database-data.sql`
- **Checksums SHA-256:** `backups/pre-phase17b/SHA256SUMS.txt`
  - `database-schema.sql`: `9fa8578cdd9063d63b35b68fee3eb2c0b3d725fdf895b68c076c9ea1efe0e624`
  - `database-data.sql`: `7a9c887cc70f221374cc42c122791d681bffd796f2f47ee39de02a46b580ab28`

---

## 3. Inventário Supabase Auth & Storage
- **Auth Total Users:** 0 usuários registrados
- **Auth Providers Ativos:** Email / Password, Magic Link
- **Storage Buckets Ativos:**


---

## 4. Matriz de Roteamento e RBAC Baseline
- `super_admin`: Destino `/admin/dashboard` (Contexto Global SaaS Barbex)
- `admin` / `tenant_admin`: Destino `/dashboard` (Visão Executiva do Tenant)
- `manager`: Destino `/dashboard` (Gestão Operacional do Tenant)
- `reception`: Destino `/reception` (Central de Atendimento)
- `financial`: Destino `/finances` (Centro Financeiro)
- `barber` / `professional`: Destino `/{slug}/profissional` (Painel do Profissional)
- `client` / `customer`: Destino `/{slug}/portal` (Portal do Cliente)

---

## 5. Procedimento de Rollback de Código (Git)
Em caso de necessidade de reversão imediata:

```bash
# 1. Obter referências remotas
git fetch origin

# 2. Reverter a branch de trabalho para a tag estável
git checkout main
git reset --hard pre-phase17b-stable

# 3. Forçar sincronização (se necessário após autorização expressa)
# git push origin main --force
```

---

## 6. Procedimento de Restauração de Banco de Dados (Supabase)
Em caso de corrupção ou necessidade de restabelecimento do estado pré-17B:

1. **Validação de Integridade:**
   ```bash
   # Verificar checksums
   sha256sum -c backups/pre-phase17b/SHA256SUMS.txt
   ```
2. **Execução de Script SQL:**
   * Executar o arquivo `backups/pre-phase17b/database-data.sql` via Supabase SQL Editor ou conexão direta Postgres autorizada.
   * *Aviso: Qualquer restauração em ambiente de produção exige validação e autorização prévia.*
