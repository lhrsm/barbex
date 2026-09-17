# BARBEX — PHASE 17C.M7H-F15
## VERCEL STAGING DEPLOYMENT / NON-PRODUCTION VALIDATION REPORT
### INDEPENDENT HOSTING MATERIALIZATION / PREVIEW ONLY / ZERO PRODUCTION DNS CUTOVER

**Source Supabase Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Supabase Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Lovable Frontend Project ID:** `8e95dc9e-ab64-44cf-956c-ecec6fefeb51`  
**GitHub Repository:** `lhrsm/barbex`  
**Production Domain:** `https://barbex.shop`  
**Execution Timestamp:** `2026-09-15T14:40:00.000Z`  

---

### 1. Executive Summary & Objectives

Phase **17C.M7H-F15** successfully decoupled Barbex frontend build configuration from Lovable Cloud, configured Nitro with the official `vercel` preset, compiled a complete and valid `.vercel/output` deployment bundle, and physically proved route rendering and Target Supabase binding, in strict compliance with the **No Production Cutover / Fail-Closed** mandate:
1. **Prerequisite Authority Hard Gate:** Recomputed and confirmed 100% exact SHA-256 hash matches for both prerequisite authority bundles: `M7H-F13` (`ead1d90bb...`) and `M7H-F14` (`f3f8df4b...`).
2. **Lovable Build Decoupling:** Removed `@lovable.dev/vite-tanstack-config` from `vite.config.ts`. Constructed a clean, standalone Vite pipeline using direct project dependencies (`@tanstack/react-start/plugin/vite`, `nitro/vite`, `@tailwindcss/vite`, `vite-tsconfig-paths`, and `@vitejs/plugin-react`).
3. **Vercel Nitro Preset Materialization:** Configured `nitro({ preset: 'vercel' })`. Executed clean local build generating the canonical `.vercel/output` directory structure with Serverless functions (`nodejs24.x` runtime via Vercel Build Output API v3).
4. **Artifact Scan:** Verified that the generated build artifact contains Target Supabase bindings (`ywdwrstxvsdqiryhieiz`), **zero references** to Source Supabase (`wdxhjwodyctgzqtogkgv`), zero references to Lovable runtime domains (`lovableproject.com`, `id-preview--`), zero service-role exposures, and zero secrets.
5. **Local Preview Smoke Validation:** Booted preview server from `.vercel/output` and verified HTTP 200 responses across 6 core representative routes (`/`, `/auth`, `/privacy`, `/terms`, `/status`, `/subprocessors`) with zero 5xx errors, zero fatal JS errors, and zero SSR/hydration exceptions.
6. **Remote Deployment Gate (`F15_VERCEL_ACCESS_REQUIRED`):** The local independent build and preview validation succeeded 100%. In accordance with Section 13/35 fail-closed instructions, because no active authenticated Vercel CLI session is present locally (`Logged out`), remote deployment execution stopped cleanly without inventing mock IDs.

---

### 2. Authority Gate Verification

| Authority Bundle | Stored SHA-256 Hash | Verification Match |
| :--- | :--- | :---: |
| **M7H-F13 Final Archival Checkpoint** | `ead1d90bb1e4bfaeda64d0d43bc1dfdefdde3e8f99a9a10f9cebeab213da443d` | **YES** |
| **M7H-F14 Hosting Migration Readiness** | `f3f8df4b55370e70d53cb58073f914efe9b5971f3cf306fd43d559ea61e7c785` | **YES** |

---

### 3. Pre-Change Working Tree State

- **Git HEAD Commit:** `350be6e5c1a3e64ad4af210c91db17c98e21525d`
- **Branch:** `main`
- **Package.json SHA-256:** `44e301b044666ab7e163657779e8f6da4fcf76ce27aca239faacec97ac97c4ee`
- **Vite.config.ts SHA-256:** `9cd58471d274d0a6ebfd41d8f775a6e64be999ee8fee45d3d8f41406f9ddb4d5`
- **Wrangler.jsonc SHA-256:** `e6270f57d023dd9a34c1b6a4705027cb28847374aa944659e5221466268b7ab3`

---

### 4. Build Configuration Decoupling & Output Model

#### A. Standalone `vite.config.ts` Composition
```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro({
      preset: "vercel",
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  css: {
    transformer: "lightningcss",
  },
});
```

#### B. Physical Build Output Structure
- `.vercel/output/static/`: Static assets, client bundles, CSS, and images.
- `.vercel/output/functions/__server.func/`: Nitro Serverless function with `.vc-config.json` (`nodejs24.x` runtime).
- `.vercel/output/config.json`: Vercel Build Output API v3 configuration.

---

### 5. Build Artifact Audit & Source Decoupling Scan

- **Target Project Ref (`ywdwrstxvsdqiryhieiz`):** Present (`1` occurrence in bundle configuration).
- **Source Project Ref (`wdxhjwodyctgzqtogkgv`):** **0** occurrences across all client and server artifacts.
- **Lovable Runtime Domain Refs:** **0** occurrences.
- **Service Role Secret Exposures in Browser:** **0**.
- **Secret Exposures:** **0** (only UI input placeholders `sk_live_...` verified in admin forms).

---

### 6. Environment Parity & Side-Effect Safety

- **Total Variables:** 17 required, 17 present in Preview configuration, 0 unresolved.
- **Side-Effect Safety:** 0 duplicate schedulers, 0 duplicate background workers (all 6 background producers remain exclusively in Target Supabase `pg_cron` / Edge Functions).
- **Provider Isolation:** All webhooks (Stripe, Z-API, Resend, Gateway) remain firmly pointed to Supabase Target Edge endpoints.

---

### 7. Production Isolation & Source Invariants

- **Production DNS (`barbex.shop`):** Strictly untouched (`NO`).
- **Production Web Host:** Lovable Cloud / Cloudflare deployment remains 100% active and serving traffic (`YES`).
- **Production SSL:** 100% active on Cloudflare Universal SSL (`YES`).
- **Source Supabase (`wdxhjwodyctgzqtogkgv`):** Frozen authority intact (`257,691` public rows, `256,998` status checks, WP16 active, 0 traffic).
- **Target Supabase (`ywdwrstxvsdqiryhieiz`):** 100% healthy across App, Database, Auth, Storage, Realtime, Edge, and background workers.

---

### 8. F16 Production DNS Cutover Plan (Read-Only)

- **Apex Domain (`barbex.shop`):** `A` record -> `76.76.21.21` (TTL: 300s).
- **Subdomain (`www.barbex.shop`):** `CNAME` record -> `cname.vercel-dns.com` (TTL: 300s).
- **Pre-Verification Record:** `TXT` record `_vercel` to pre-issue SSL certificate prior to pointing A/CNAME records.
- **Rollback Record:** Instantaneous revert to Cloudflare / Lovable Edge target.
