# BARBEX — PRE-PHASE 17C RECOVERY PROCEDURES

**Baseline Commit:** `50b6e5390cf60c247f850d357aba77b8b9d52819`  
**Stable Tag:** `post-phase17b-stable`  
**Recovery Branch:** `backup/post-phase17b-stable`  
**Supabase Project Ref:** `wdxhjwodyctgzqtogkgv`

---

## 1. Code Rollback Procedure (Git)

In the event of an issue during subsequent phases, restore the codebase to the verified Phase 17B production state:

### Option A: Checkout and Reset to Tag (Destructive to untracked local changes)
```bash
git checkout main
git fetch origin --tags
git reset --hard post-phase17b-stable
git clean -fd -e backups/ -e .env
```

### Option B: Restore from Backup Branch
```bash
git checkout main
git fetch origin
git reset --hard origin/backup/post-phase17b-stable
```

### Option C: Restore from Source Zip Archive
Extract `backups/pre-phase17c/barbex-pre-phase17c-source.zip` into a clean workspace directory.

---

## 2. Database Schema Restore Procedure

1. Enter maintenance window.
2. Generate an ad-hoc pre-restore snapshot:
   ```bash
   # Create emergency snapshot before restoring
   ```
3. Apply `backups/pre-phase17c/database-schema.sql` via Supabase SQL Editor or CLI:
   ```bash
   supabase db push
   # OR execute database-schema.sql in the Supabase Dashboard SQL Editor
   ```
4. Verify RLS enablement across all public tables:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```

---

## 3. Database Data Restore Procedure

1. Restore data using the sanitized SQL dump:
   `backups/pre-phase17c/database-data.sql`
2. Execute data statements with table constraints preserved:
   - `profiles`
   - `barbers`
   - `customers`
   - `barbershops`
   - `services`
   - `products`
   - `appointments`

---

## 4. Storage Restore Procedure

1. Verify bucket access in `backups/pre-phase17c/storage-inventory.json`.
2. Ensure buckets exist:
   - `barbershop-logos` (Public)
   - `avatars` (Public)
   - `services` (Public)
   - `receipts` (Private)
   - `support` (Private)

---

## 5. Post-Recovery Smoke Plan

Execute the standard validation matrix:
1. `GET /` (Landing Page)
2. `GET /auth` (Staff Auth Page)
3. Staff Email Login (`/auth`)
4. Staff Phone Login (`/auth`)
5. Staff Password Reset by Phone (`/auth`)
6. `GET /lm/portal` (Customer Portal)
7. Customer Email Login (`/lm/portal`)
8. Customer Phone Login (`/lm/portal`)
9. Customer Password Reset by Phone (`/lm/portal`)
10. Barber / Reception Dashboard access
11. Admin Dashboard access
12. Booking creation workflow
13. Storage images loading
