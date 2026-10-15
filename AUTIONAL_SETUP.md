# Autional Integration — Takenote (fork)

## Basics

- Date: 2026-10-10 · SSO upgrade 2026-10-11
- Framework: React 16 + custom webpack 5 (redux-saga · react-router v5 · jest 26)
- Tenant: takenote-demo (permanent since 2026-10-15 — trial=false, no expiry)
- Tenant slug: `takenote-demo`
- Region: **.cn** (SSO line pinned to .cn — the .com auth `/bff` proxy 502s at time of writing; tenant/accounts verified 200 on .cn, notes F6)
- Environment: local demo mode (`DEMO=true`)
- Login methods: **password + SSO** (both live on `/login`; SSO per skill §5.2b)

## Configuration

- App ID: `client-O6XjAjdi3OZK` — registered public OAuth client for SSO (`redirect_uri` = `http://localhost:3000/oauth/callback`; supersedes the "no appId" limitation, notes D3)
- Issuer: `https://api.autional.cn`
- API URL: `https://api.autional.cn/bff` — the gateway routes only `/bff/<svc>/...`
- Authorize (SSO): pinned to `https://auth.autional.cn/oauth/api/v1/oauth/authorize` — in proxy form the SDK default derives a same-origin path that lands on the API plane (no login UI), notes F5
- Tenant ID: `01M4J4BF8M2WQCTGVS2S0T9024` — supplied per login/register call (see below)
- Admin: takenote@autional.net

## Security policy (tenant settings)

- Password transmission: **hash** — `sha256hex(password + "|" + tenantId)`
- Min length: 8 · requires upper + lower + digit
- MFA: not enabled · Breached-password check: not enabled

## Test accounts

| Account         | Role                              | Password                                          |
| --------------- | --------------------------------- | ------------------------------------------------- |
| takenote-alice  | test user                         | delivered separately — never written to this repo |
| takenote-carol  | test user                         | delivered separately                              |
| bob             | test user                         | delivered separately                              |
| takenote-phase7 | test user (Phase 7 register flow) | delivered separately                              |

> Deviation from the setup template: this fork is public, so no password appears in any tracked file — all credentials (test accounts, tenant admin, mailbox) are recorded outside the repository on the local machine only (`provision/`).

## Portals

| Portal    | Address                                     | Purpose                                          |
| --------- | ------------------------------------------- | ------------------------------------------------ |
| Admin     | https://admin.autional.cn/takenote-demo/    | users / roles / security policy / audit log      |
| User      | https://user.autional.cn/takenote-demo/     | change password / devices / MFA                  |
| Security  | https://security.autional.cn/takenote-demo/ | anomaly detection / login trends                 |
| Developer | https://developer.autional.cn               | API docs / OAuth clients / app settings (global) |
| Status    | https://status.autional.cn                  | service health (global)                          |

> Console portals are tenant-scoped — the `/takenote-demo/` slug keeps users on the tenant. A bare root drops them on the tenant picker.

> Portals listed on the .cn plane to match the integration (the .com variants exist; its auth leg 502ed during the SSO work — notes F6).

## Integration adaptations (vs. the onboarding template)

1. **`apiUrl` includes `/bff`** — the gateway only routes `/bff/<svc>/...`; the template value 404s every call.
2. **`tenantId` is a separate constant, passed per call** — the React provider's config type drops it; login/register must carry `tenantId` explicitly.
3. **Register via SDK needs an `X-Tenant-ID` header** (http-adapter injection) — the SDK sends camelCase `tenantId` in the body, which the server ignores.
4. **`sdk.refreshToken()` does not exist on the facade** — use the exported `AuthClient` directly if explicit rotation is needed.
5. Demo mode: login page at `/login`, guarded app at `/app`; original GitHub flow untouched (non-demo branch).
6. **Browser calls must be same-origin** — the API server's CORS allowlist rejects local/unlisted origins (preflight 204 without ACAO → every call blocked). Demo mode therefore routes through a dev-server proxy (`/bff` + `/.well-known` + `/oauth/api` in `config/webpack.dev.js`) with `apiUrl` set to `window.location.origin + '/bff'` (must be absolute; a relative `/bff` silently falls back to the cross-origin issuer in OIDC discovery — notes D17/D18). A production deployment needs the same reverse-proxy shape, or the origin added to the server allowlist. Proxy key must be the exact prefix `/oauth/api` — a bare `/oauth` would swallow the SPA callback route `/oauth/callback` (notes F1).
7. Demo-mode "Log out" also ends the Autional session (notes D19): the logout saga calls a bridged `endAutionalSession()` (registered at the entry point with `useAutional().logout()`) — the stock Redux-only logout left the SDK session alive.
8. **SSO (§5.2b)** — `AutionalLogin` renders both the password form and "Continue with Autional"; `loginWithOAuth` pins `authorizeUrl` to the auth plane (notes F5); the callback lands on the new `/oauth/callback` route (`AutionalOAuthCallback` → `handleOAuthCallback` → `/app`). First visit shows a consent page (approve once per client).
9. **Login-method config source of truth** (notes F7): the tenant `auth-policy` (tenant-service `PUT /admin/tenants/:id/auth-policy`) is authoritative; identity's `PUT /admin/security/auth-config` returns 200 but silently no-ops for the auth family (A-112 migration gap).

## Reminders

1. All credentials (test accounts, tenant admin, mailbox) are recorded outside the repository (`provision/` on the local machine) — not in this file.
2. `.env` is gitignored in this repo (the template calls it "safe to commit").
3. Full problem log with evidence: `AI-ONBOARDING-NOTES.md` (sections A–D + Phase 7).
