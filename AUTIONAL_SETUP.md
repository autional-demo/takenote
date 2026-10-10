# Autional Integration — Takenote (fork)

## Basics

- Date: 2026-10-10
- Framework: React 16 + custom webpack 5 (redux-saga · react-router v5 · jest 26)
- Tenant: takenote-demo (trial, expires 2026-10-17)
- Region: .com
- Environment: local demo mode (`DEMO=true`)

## Configuration

- App ID: — (none obtainable for a fresh tenant; the SDK warns and continues)
- Issuer: `https://api.autional.com`
- API URL: `https://api.autional.com/bff` — the gateway routes only `/bff/<svc>/...`
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

| Portal    | Address                        | Purpose                                     |
| --------- | ------------------------------ | ------------------------------------------- |
| Admin     | https://admin.autional.com     | users / roles / security policy / audit log |
| User      | https://user.autional.com      | change password / devices / MFA             |
| Security  | https://security.autional.com  | anomaly detection / login trends            |
| Developer | https://developer.autional.com | API docs / OAuth clients / app settings     |
| Status    | https://status.autional.com    | service health                              |

## Integration adaptations (vs. the onboarding template)

1. **`apiUrl` includes `/bff`** — the gateway only routes `/bff/<svc>/...`; the template value 404s every call.
2. **`tenantId` is a separate constant, passed per call** — the React provider's config type drops it; login/register must carry `tenantId` explicitly.
3. **Register via SDK needs an `X-Tenant-ID` header** (http-adapter injection) — the SDK sends camelCase `tenantId` in the body, which the server ignores.
4. **`sdk.refreshToken()` does not exist on the facade** — use the exported `AuthClient` directly if explicit rotation is needed.
5. Demo mode: login page at `/login`, guarded app at `/app`; original GitHub flow untouched (non-demo branch).
6. **Browser calls must be same-origin** — the API server's CORS allowlist rejects local/unlisted origins (preflight 204 without ACAO → every call blocked). Demo mode therefore routes through a dev-server proxy (`/bff` + `/.well-known` in `config/webpack.dev.js`) with `apiUrl` set to `window.location.origin + '/bff'` (must be absolute; a relative `/bff` silently falls back to the cross-origin issuer in OIDC discovery — notes D17/D18). A production deployment needs the same reverse-proxy shape, or the origin added to the server allowlist.
7. Demo-mode "Log out" also ends the Autional session (notes D19): the logout saga calls a bridged `endAutionalSession()` (registered at the entry point with `useAutional().logout()`) — the stock Redux-only logout left the SDK session alive.

## Reminders

1. Admin password stored separately (shown once) — not in this file.
2. `.env` is gitignored in this repo (the template calls it "safe to commit").
3. Full problem log with evidence: `AI-ONBOARDING-NOTES.md` (sections A–D + Phase 7).
