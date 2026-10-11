# AUTIONAL_CHANGES — what the onboarding changed in this fork

> Companion to `AUTIONAL_SETUP.md`. Full problem log: `AI-ONBOARDING-NOTES.md`.
> Date: 2026-10-10 · SSO upgrade 2026-10-11 · Branch: `feature/autional`

## Created

| Path                                              | Purpose                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/client/autional.ts`                          | SDK config + re-exports (the template's `src/autional.ts`, adapted to this repo's `@/` → `src/client/` layout); `appId` = registered public client for SSO (notes F5–F7) |
| `src/client/components/AutionalLogin.tsx`         | login page (`/login`): SDK password `login()` **+ "Continue with Autional" SSO button** (authorizeUrl pinned to the auth plane, notes F5)                                |
| `src/client/components/AutionalOAuthCallback.tsx` | SSO callback route (`/oauth/callback`): `handleOAuthCallback` → `/app`; error branch falls back to sign-in                                                               |
| `src/client/styles/_login.scss`                   | login page styles (imported from `styles/index.scss`)                                                                                                                    |
| `tests/setup.polyfills.ts`                        | TextEncoder polyfill — jest 26's jsdom lacks it and the SDK needs it at import time                                                                                      |
| `tests/unit/client/autional/*`                    | Phase 6 unit tests (token manager, password transmission, auth client, api client, route guard, tab sync)                                                                |
| `AUTIONAL_SETUP.md` · `AUTIONAL_CHANGES.md`       | this wrap-up                                                                                                                                                             |
| `.env` (gitignored)                               | `DEMO=true` + AUTIONAL\_\* public keys                                                                                                                                   |

## Modified

| Path                            | Change                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/index.tsx`          | wrap the app in `AutionalProvider`; `AutionalSessionBridge` registers the SDK logout for non-React code (notes D19)                                                                                                                                                                                                                       |
| `src/client/containers/App.tsx` | `/login` route + `/oauth/callback` SSO route + `RequireAuth` guard on `/app` (demo branch only)                                                                                                                                                                                                                                           |
| `config/webpack.dev.js`         | same-origin dev proxy for `/bff` + `/.well-known` + `/oauth/api` → `https://api.autional.cn` — the API server's CORS allowlist blocks browser calls from this origin (notes D17); `.cn` target because the `.com` auth leg 502s (notes F6); `/oauth/api` only (never a bare `/oauth` — it would swallow the SPA callback route, notes F1) |
| `package.json`                  | +`@autional/core`, `@autional/react`, `@autional/api-identity` (^0.3.0); `typescript` pinned exact 4.5.5; `ts-loader` 8.4.0 — minimal consistent toolchain combo (notes D9)                                                                                                                                                               |
| `tsconfig.json`                 | `useUnknownInCatchVariables: false` (TS 4.4+ default change, notes D9)                                                                                                                                                                                                                                                                    |
| `src/client/sagas/index.ts`     | `Generator<any, any, any>` annotations on 8 generators (TS7057 fallout, notes D9); demo logout calls the bridged `endAutionalSession()` (notes D19)                                                                                                                                                                                       |
| `config/jest.config.js`         | `setupFiles` polyfill entry                                                                                                                                                                                                                                                                                                               |
| `README.md`                     | integration note                                                                                                                                                                                                                                                                                                                          |

## Deliberate deviations from the onboarding template

1. `apiUrl` includes `/bff` (notes D1).
2. `tenantId` is an exported constant, not a provider field (notes D2).
3. No passwords in any tracked file (public fork) — template's test-account table carries usernames only.
4. `appId` = `client-O6XjAjdi3OZK`, registered as a public OAuth client (origin `http://localhost:3000`) — resolves the earlier "no appId for a fresh tenant" limitation (notes D3), enabled by the SSO upgrade.
5. Env adaptation (node-sass → sass, TS toolchain) precedes this change set — notes section A.
6. Browser traffic goes same-origin: dev proxy + **absolute** same-origin `apiUrl` in demo mode (notes D17/D18) — the API server's CORS allowlist rejects unlisted origins, and a relative apiUrl silently breaks OIDC discovery.
7. Demo logout calls the SDK logout before clearing Redux (notes D19).

## Not done / out of scope

- No GitHub OAuth app configured (user decision) — Autional password + Autional SSO only.
- Original GitHub OAuth flow untouched (non-demo branch of `App.tsx`).
- The `deviation 6` proxy shape is a dev-mode measure; a real deployment needs the reverse proxy or a `cors_origins` entry (registering the origin on the client lifts it — notes F1 实测).
