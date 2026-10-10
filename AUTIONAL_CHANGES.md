# AUTIONAL_CHANGES — what the onboarding changed in this fork

> Companion to `AUTIONAL_SETUP.md`. Full problem log: `AI-ONBOARDING-NOTES.md`.
> Date: 2026-10-10 · Branch: `feature/autional`

## Created

| Path                                        | Purpose                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/client/autional.ts`                    | SDK config + re-exports (the template's `src/autional.ts`, adapted to this repo's `@/` → `src/client/` layout) |
| `src/client/components/AutionalLogin.tsx`   | login page (`/login`) using SDK `login()`                                                                      |
| `src/client/styles/_login.scss`             | login page styles (imported from `styles/index.scss`)                                                          |
| `tests/setup.polyfills.ts`                  | TextEncoder polyfill — jest 26's jsdom lacks it and the SDK needs it at import time                            |
| `tests/unit/client/autional/*`              | Phase 6 unit tests (token manager, password transmission, auth client, api client, route guard, tab sync)      |
| `AUTIONAL_SETUP.md` · `AUTIONAL_CHANGES.md` | this wrap-up                                                                                                   |
| `.env` (gitignored)                         | `DEMO=true` + AUTIONAL\_\* public keys                                                                         |

## Modified

| Path                            | Change                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/index.tsx`          | wrap the app in `AutionalProvider`; `AutionalSessionBridge` registers the SDK logout for non-React code (notes D19)                                                         |
| `src/client/containers/App.tsx` | `/login` route + `RequireAuth` guard on `/app` (demo branch only)                                                                                                           |
| `config/webpack.dev.js`         | same-origin dev proxy for `/bff` + `/.well-known` → `https://api.autional.com` — the API server's CORS allowlist blocks browser calls from this origin (notes D17)          |
| `package.json`                  | +`@autional/core`, `@autional/react`, `@autional/api-identity` (^0.3.0); `typescript` pinned exact 4.5.5; `ts-loader` 8.4.0 — minimal consistent toolchain combo (notes D9) |
| `tsconfig.json`                 | `useUnknownInCatchVariables: false` (TS 4.4+ default change, notes D9)                                                                                                      |
| `src/client/sagas/index.ts`     | `Generator<any, any, any>` annotations on 8 generators (TS7057 fallout, notes D9); demo logout calls the bridged `endAutionalSession()` (notes D19)                         |
| `config/jest.config.js`         | `setupFiles` polyfill entry                                                                                                                                                 |
| `README.md`                     | integration note                                                                                                                                                            |

## Deliberate deviations from the onboarding template

1. `apiUrl` includes `/bff` (notes D1).
2. `tenantId` is an exported constant, not a provider field (notes D2).
3. No passwords in any tracked file (public fork) — template's test-account table carries usernames only.
4. `appId` is an empty string — no app-creation path exists for a fresh tenant (notes D3).
5. Env adaptation (node-sass → sass, TS toolchain) precedes this change set — notes section A.
6. Browser traffic goes same-origin: dev proxy + **absolute** same-origin `apiUrl` in demo mode (notes D17/D18) — the API server's CORS allowlist rejects unlisted origins, and a relative apiUrl silently breaks OIDC discovery.
7. Demo logout calls the SDK logout before clearing Redux (notes D19).

## Not done / out of scope

- No GitHub OAuth app configured (user decision) — email+password login only.
- Original GitHub OAuth flow untouched (non-demo branch of `App.tsx`).
