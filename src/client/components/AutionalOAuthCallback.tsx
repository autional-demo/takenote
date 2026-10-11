import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useAutionalContext } from '@autional/react'

/**
 * SSO callback page (§5.2b) — route /oauth/callback must match the registered
 * redirect_uri of the OAuth client (client-O6XjAjdi3OZK).
 */
export const AutionalOAuthCallback: React.FC = () => {
  const { autional } = useAutionalContext()
  const history = useHistory()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    autional
      .handleOAuthCallback(window.location.href)
      .then(() => {
        if (!cancelled) history.replace('/app')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'SSO sign-in failed')
      })

    return () => {
      cancelled = true
    }
  }, [autional, history])

  if (error) {
    return (
      <section className="login-page">
        <div className="login-card">
          <h1>Sign-in failed</h1>
          <p className="login-error">{error}</p>
          <button className="button" type="button" onClick={() => history.replace('/login')}>
            Back to sign in
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <h1>Completing sign-in…</h1>
      </div>
    </section>
  )
}
