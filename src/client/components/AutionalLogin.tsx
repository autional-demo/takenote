import React, { useState } from 'react'
import { Redirect, useHistory } from 'react-router-dom'

import { useAutional, AUTIONAL_TENANT_ID } from '@/autional'

export const AutionalLogin: React.FC = () => {
  const { login, loginWithOAuth, isAuthenticated } = useAutional()
  const history = useHistory()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Redirect to="/app" />
  }

  // SSO (§5.2b): full-page redirect to the Autional auth page, PKCE handled by the SDK.
  // authorizeUrl is pinned to the auth plane: with the proxy apiUrl (localhost/bff)
  // the SDK default derives a same-origin /oauth/api path that the proxy forwards to
  // the api plane, which renders no login UI (silent error=login_required, F5 note).
  const handleOAuth = async () => {
    setError('')
    try {
      await loginWithOAuth({
        authorizeUrl: 'https://auth.autional.cn/oauth/api/v1/oauth/authorize',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO sign-in failed')
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // tenantId must be passed per call: the React provider drops it (notes D2).
      const credentials = identity.includes('@')
        ? { email: identity, password, tenantId: AUTIONAL_TENANT_ID }
        : { username: identity, password, tenantId: AUTIONAL_TENANT_ID }
      await login(credentials)
      history.replace('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <h1>Sign in to TakeNote</h1>
        <p className="login-subtitle">Authentication by Autional</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="identity">Email or username</label>
          <input
            id="identity"
            type="text"
            autoComplete="username"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="login-error">{error}</p>}
          <button className="button" type="submit" disabled={submitting || !identity || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-subtitle" style={{ margin: '1rem 0 0.25rem' }}>
          or continue with
        </p>
        <button className="button" type="button" onClick={handleOAuth}>
          Continue with Autional
        </button>
      </div>
    </section>
  )
}
