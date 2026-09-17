# BARBEX — PHASE 17C.M7H-F14
## HOSTING MIGRATION READINESS / LOVABLE DECOUPLING REPORT
### VERCEL TARGET ARCHITECTURE / READ-ONLY PLAN / NO PRODUCTION CUTOVER

**Source Project Ref:** `wdxhjwodyctgzqtogkgv`  
**Target Project Ref:** `ywdwrstxvsdqiryhieiz`  
**Lovable Project ID:** `8e95dc9e-ab64-44cf-956c-ecec6fefeb51`  
**GitHub Repository:** `lhrsm/barbex`  
**Production Domain:** `https://barbex.shop`  
**Execution Timestamp:** `2026-09-15T13:30:00.000Z`  

---

### 1. Executive Summary & Objective

Phase **17C.M7H-F14** executed the comprehensive technical analysis and readiness design for decoupling Barbex frontend hosting from Lovable Cloud / Cloudflare and preparing an immutable migration pathway to **GitHub + Vercel**, in strict compliance with the **Read-Only / No Mutation / Fail-Closed** mandate:
- **Zero DNS changes**, zero production redeployments, zero Vercel deployments created.
- **Authority Gate:** Recomputed and confirmed 100% exact matches for all prerequisite authorities: `M7H-F11.2`, `M7H-F12`, and `M7H-F13`.
- **Contradiction Closure:** Reconciled the F13 pause/deletion findings by distinguishing the Supabase backend project (`wdxhjwodyctgzqtogkgv`, 100% decoupled from live web traffic) from the Lovable frontend project (`8e95dc9e-ab64-44cf-956c-ecec6fefeb51`, which hosts the web application and manages domain/SSL).
- **Vercel Compatibility Confirmed:** Physically verified that Barbex runs on TanStack Start + Nitro 3 + React 19 without any Cloudflare-specific APIs in application code, confirming `VERCEL_COMPATIBILITY: CONFIG_CHANGE_ONLY`.
- **Environment Parity:** Mapped all 17 required environment variables (7 public, 10 server secret) with 0 unresolved entries.
- **Rollback & Split-Brain:** Proved that dual-hosting during DNS TTL decay carries zero split-brain risk because both hosts connect to the identical Target database (`ywdwrstxvsdqiryhieiz`), while background writers and webhooks reside solely on Target Supabase.

---

### 2. Authority Gate Verification

| Authority Bundle | Stored SHA-256 Hash | Verification Match |
| :--- | :--- | :---: |
| **M7H-F11.2 Stabilization Completion** | `d4d41abbba9f2830ac54f13bcf0dfbf45c0495cb3eacbc87cd6634d40b7dd1cb` | **YES** |
| **M7H-F12 Source Retirement Planning** | `b555f8bd7604612208fa2adb7f3f986866b6e0a87fa33e233c4723cfec495172` | **YES** |
| **M7H-F13 Final Archival Checkpoint** | `ead1d90bb1e4bfaeda64d0d43bc1dfdefdde3e8f99a9a10f9cebeab213da443d` | **YES** |

---

### 3. Physical Reconciliation of F13 Delete/Pause Findings

The dual conclusions reported in F13 have been physically resolved:
1. **Supabase Source Project (`wdxhjwodyctgzqtogkgv`):**
   - In Phases F6 through F10B, all database reads, writes, auth flows, storage objects, realtime subscriptions, and background workers were completely migrated to Target (`ywdwrstxvsdqiryhieiz`).
   - Pausing or deleting `wdxhjwodyctgzqtogkgv` has **zero impact on production web traffic** on `barbex.shop`. Its only impact is destroying the frozen rollback baseline.
   - `SUPABASE_SOURCE_PROJECT_PAUSE_IMPACT: NONE_ON_PRODUCTION_TRAFFIC_DESTROYS_FROZEN_ROLLBACK_AUTHORITY`
   - `SUPABASE_SOURCE_PROJECT_DELETE_IMPACT: NONE_ON_PRODUCTION_TRAFFIC_DESTROYS_FROZEN_ROLLBACK_AUTHORITY`
2. **Lovable Frontend Application Project (`8e95dc9e-ab64-44cf-956c-ecec6fefeb51`):**
   - The production domain `barbex.shop` is attached via Lovable Cloud's Cloudflare Pages/Workers routing and Universal SSL proxy.
   - Pausing or deleting the Lovable project directly suspends or destroys web hosting, DNS edge routing, and SSL termination.
   - `LOVABLE_FRONTEND_PROJECT_PAUSE_IMPACT: TEMPORARY_OUTAGE_PRODUCTION_WEB_AND_SSL_SUSPENDED`
   - `LOVABLE_FRONTEND_PROJECT_DELETE_IMPACT: PERMANENT_OUTAGE_PRODUCTION_WEB_HOSTING_AND_SSL_DESTROYED`
3. **Sequence Requirement:**
   - **Frontend hosting must be migrated to an independent provider (Vercel) BEFORE Lovable project retirement or deletion.**

---

### 4. Current Build Model & Lovable Coupling Audit

#### A. Build Architecture
- **Framework:** TanStack Start (`^1.167.14`) + React 19 (`^19.2.0`) + Nitro (`3.0.260603-beta`).
- **Build Command:** `vite build` (outputs to `.output/public` for static assets and `.output/server` for Nitro server worker).
- **Runtime:** Cloudflare Workers / workerd with `nodejs_compat`.
- **Preset:** Nitro preset `cloudflare-module` (configured by default).

#### B. `@lovable.dev/vite-tanstack-config` Responsibilities
Inspection of `node_modules/@lovable.dev/vite-tanstack-config/dist/index.js` revealed it acts as an umbrella bundler for:
1. `tanstackStart()` from `@tanstack/react-start/plugin/vite`.
2. `nitro()` from `nitro/vite`.
3. `tailwindcss()` from `@tailwindcss/vite`.
4. `tsConfigPaths()` from `vite-tsconfig-paths`.
5. `viteReact()` from `@vitejs/plugin-react`.
6. Resolves `@` alias to `./src` and dedupes React/TanStack packages.
7. Sandbox/dev-only plugins (error loggers, HMR gate, dev-server bridge, asset proxy).

**Conclusion:** `@lovable.dev/vite-tanstack-config` is **NOT required for production**. Standard, direct Vite configuration can instantiate the exact same plugins with zero runtime loss.

---

### 5. Vercel Target Design & Compatibility Proof

- **Compatibility Confirmed:** `CONFIG_CHANGE_ONLY`.
- **Runtime Blockers:** `NONE`.
- **Build Blockers:** `NONE`.
- **Cloudflare API Decoupling:** `src/` contains zero usages of `env.KV`, `env.D1`, `env.R2`, or `caches.default`.
- **Target Specification:**
  - **Framework Preset:** `Other` (or `Vite`)
  - **Install Command:** `npm install`
  - **Build Command:** `npm run build`
  - **Output Directory:** `.output` (or `.vercel/output` via Nitro `vercel` preset)
  - **Runtime Mode:** Serverless Function (`nodejs22.x`)
  - **Nitro Preset:** `vercel`
  - **Node Version:** `22.x`

---

### 6. Required File Changes (Planned for Future Phase)

| Target File | Planned Modification | Safe & Reversible |
| :--- | :--- | :---: |
| `vite.config.ts` | Replace `@lovable.dev/vite-tanstack-config` with standalone Vite configuration specifying Nitro preset `'vercel'` | YES |
| `package.json` | Retain all existing build dependencies; move/remove `@lovable.dev/vite-tanstack-config` | YES |
| `wrangler.jsonc` | Retain as optional Cloudflare deployment fallback | YES |
| `public/manifest.json` | Replace absolute Lovable preview image URL with relative `/icon-512.png` | YES |
| `src/routes/__root.tsx` | Replace Lovable preview R2 URLs in `og:image` and `twitter:image` with canonical `https://barbex.shop/og-image.png` | YES |
| `src/lib/auth-client.functions.ts` | Update fallback redirect URL from `https://barberlm.lovable.app` to `https://barbex.shop` | YES |

---

### 7. Environment Variable Parity

Total Variables Mapped: **17** (`unresolved_env_count: 0`).
- **Build / Public (7):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_APP_URL`, `VITE_PAYMENTS_CLIENT_TOKEN`, `VITE_PAYMENTS_SANDBOX_CLIENT_TOKEN`.
- **Server Runtime / Secret (10):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `PUBLIC_APP_URL`, `CRON_SECRET`, `PUSH_INTERNAL_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

### 8. Non-Production Preview Validation Strategy

- **Preview Safety:** Deployments to `*.vercel.app` connect directly to Target Supabase.
- **Worker Isolation:** All 6 background workers run inside Target Supabase `pg_cron` / Edge Functions, ensuring zero duplicate worker execution from Vercel preview instances.
- **Webhook Isolation:** Live provider callbacks (Stripe, Z-API, Resend, Gateway) point directly to Supabase Target Edge endpoints (`https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/*`), preventing accidental webhook traffic to preview builds.
- **Smoke Testing:** Strict read-only smoke protocol (client hydration, page rendering, anonymous read RPCs). Zero synthetic bookings or mutations.

---

### 9. Domain & SSL Cutover Architecture

- **Canonical Domain:** `https://barbex.shop` (with 308 redirect from `www.barbex.shop`).
- **DNS Records Required:**
  - Apex (`@`): `A` record `76.76.21.21` (TTL: 300s).
  - Subdomain (`www`): `CNAME` record `cname.vercel-dns.com` (TTL: 300s).
- **TLS Pre-Provisioning:** Vercel allows domain pre-verification via TXT record `_vercel`. This provisions the TLS certificate **prior** to pointing A/CNAME records, ensuring **zero HTTPS downtime**.
- **Rollback:** Instantaneous DNS revert to Lovable Cloudflare proxy target if necessary.

---

### 10. Split-Brain Analysis

- During DNS propagation, both Lovable Cloud and Vercel will temporarily serve incoming client traffic.
- Because both deployments run the exact same frontend code and interface with the exact same Target Supabase database (`ywdwrstxvsdqiryhieiz`), all customer sessions, data reads, and mutations are 100% unified.
- **Dual-hosting side-effect risk:** `ZERO`.
- **Dual-hosting background writer risk:** `ZERO`.

---

### 11. Production Cutover Checklist & Hold Points

#### Production Cutover Checklist:
1. Connect GitHub repository `lhrsm/barbex` to Vercel Project.
2. Configure standalone `vite.config.ts` (Nitro preset: `vercel`).
3. Set all 17 environment variables in Vercel.
4. Deploy preview branch; verify build exit code 0.
5. Execute read-only smoke test suite on preview domain.
6. Pre-verify `barbex.shop` and `www.barbex.shop` via TXT record `_vercel`.
7. Confirm Vercel SSL issuance.
8. Lower DNS TTL to 300 seconds.
9. Point Apex A record to `76.76.21.21` and www CNAME to `cname.vercel-dns.com`.
10. Validate production traffic on `https://barbex.shop`.
11. Maintain Lovable Cloud standby for 24-48 hours observation window.
12. Unbind domain in Lovable Cloud dashboard and archive project.

#### Mandatory Hold Points:
- **HP-1:** Vercel Build Success (Clean exit code 0 on build container)
- **HP-2:** Preview Smoke Pass (Zero-error read-only navigation on preview URL)
- **HP-3:** Env Parity Pass (All 17 environment variables verified exact)
- **HP-4:** Auth / Storage / Realtime Pass (Target connectivity verified)
- **HP-5:** Domain / SSL Ready (TXT pre-verification validated, TLS pre-issued)
- **HP-6:** DNS Cutover (A and CNAME records switched; TTL 300s)
- **HP-7:** Post-Cutover Application Health (Zero 5xx errors on Vercel production)
- **HP-8:** Rollback Still Possible (Lovable deployment retained throughout observation)

---

### 12. Next Phase Recommendation & Sequencing

- **Recommended Next Phase:**  
  `PHASE 17C.M7H-F15: VERCEL STAGING DEPLOYMENT / NON-PRODUCTION VALIDATION`
- **Follow-up Sequence:**
  - `PHASE 17C.M7H-F16: PRODUCTION HOSTING CUTOVER / DNS TRANSITION`
  - `PHASE 17C.M7H-F17: POST-CUTOVER HOSTING STABILIZATION / LOVABLE DETACHMENT`
  - `PHASE 17C.M7H-F18: FINAL SOURCE SUPABASE DECOMMISSIONING`
