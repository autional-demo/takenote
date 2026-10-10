/**
 * Autional config — adapted from the onboarding procedure's config template
 * Date: 2026-10-10 · Framework: webpack (custom config, React 16)
 * Deviations from the template are noted inline and in AI-ONBOARDING-NOTES.md (section D).
 */

import { AutionalProvider, useAutional, RequireAuth } from '@autional/react'

const isDemo = process.env.DEMO

export const autionalConfig = {
  // No appId is obtainable for a freshly registered tenant (notes D3); SDK warns only.
  appId: '',
  issuer: 'https://api.autional.com',
  // The gateway routes ONLY /bff/<svc>/... — the template's root-domain value 404s every call (notes D1).
  // The demo build goes same-origin through the dev-server proxy (notes D17): the API server's CORS
  // allowlist rejects this origin, so cross-origin browser calls are blocked (curl is not). The demo
  // URL must stay absolute — the SDK strips the trailing /bff to derive the discovery base, and a
  // bare '/bff' would strip to an empty string and silently fall back to the cross-origin issuer.
  apiUrl: isDemo ? `${window.location.origin}/bff` : 'https://api.autional.com/bff',
  syncTabs: true,
}

// @autional/react's provider drops tenantId (notes D2), so login calls must pass it per call.
export const AUTIONAL_TENANT_ID = '01M4J4BF8M2WQCTGVS2S0T9024'

// React-free handle on the SDK session, for code that runs outside the provider tree.
// The provider layer registers the real logout (index.tsx); Redux-only logout leaves the
// SDK token alive, so the logout saga must end the SDK session too (notes D19).
type SessionEndHandler = () => Promise<void>
let sessionEndHandler: SessionEndHandler | null = null

export const setAutionalSessionEnd = (handler: SessionEndHandler | null): void => {
  sessionEndHandler = handler
}

export const endAutionalSession = (): Promise<void> =>
  sessionEndHandler ? sessionEndHandler() : Promise.resolve()

export { AutionalProvider, useAutional, RequireAuth }
