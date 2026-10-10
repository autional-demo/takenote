import React, { useState } from 'react'
import { Redirect, useHistory } from 'react-router-dom'

import { useAutional, AUTIONAL_TENANT_ID } from '@/autional'

export const AutionalLogin: React.FC = () => {
  const { login, isAuthenticated } = useAutional()
  const history = useHistory()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Redirect to="/app" />
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
      </div>
    </section>
  )
}
