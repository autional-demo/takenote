import React from 'react'
import { MemoryRouter, Redirect, Route, Switch } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'

import { AutionalProvider, autionalConfig, RequireAuth } from '@/autional'

import { makeJwt, mockResponse } from './helpers'

const discoveryMetadata = {
  issuer: 'https://api.autional.cn',
  authorization_endpoint: 'https://api.autional.cn/oauth/api/v1/oauth/authorize',
  token_endpoint: 'https://api.autional.cn/oauth/api/v1/oauth/token',
  jwks_uri: 'https://api.autional.cn/oauth/api/v1/oauth/.well-known/jwks.json',
  response_types_supported: ['code'],
}

// Mirrors the wiring in src/client/containers/App.tsx (demo branch).
const renderGuardedApp = () =>
  render(
    <MemoryRouter initialEntries={['/app']}>
      <AutionalProvider config={autionalConfig}>
        <Switch>
          <Route exact path="/login" render={() => <div>LOGIN PAGE</div>} />
          <Route
            path="/app"
            render={() => (
              <RequireAuth fallback={<Redirect to="/login" />}>
                <div>APP CONTENT</div>
              </RequireAuth>
            )}
          />
        </Switch>
      </AutionalProvider>
    </MemoryRouter>
  )

describe('RequireAuth route guard (skill Phase 6: logged-out -> redirect)', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    window.localStorage.clear()
    fetchMock = jest.fn(async (input: string) => {
      if (String(input).includes('/.well-known/openid-configuration')) {
        return mockResponse({ body: discoveryMetadata })
      }

      return mockResponse({ status: 404, body: { code: 404, message: 'not found' } })
    })
    ;(global as any).fetch = fetchMock
  })

  it('renders the fallback (redirect to /login) when no session is stored', async () => {
    renderGuardedApp()

    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument()
    expect(screen.queryByText('APP CONTENT')).not.toBeInTheDocument()
    // Discovery always runs against the apiUrl origin, with /bff stripped.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.autional.cn/.well-known/openid-configuration',
      undefined
    )
  })

  it('renders children when a valid session is stored under autional_tokens', async () => {
    window.localStorage.setItem(
      'autional_tokens',
      JSON.stringify({
        accessToken: makeJwt(3600),
        refreshToken: 'refresh-token-1',
        user: { id: 'u-1', username: 'takenote-alice' },
        tenantId: 'tenant-abcd1234',
        expiresAt: Date.now() + 3600 * 1000,
      })
    )

    renderGuardedApp()

    expect(await screen.findByText('APP CONTENT')).toBeInTheDocument()
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument()
  })

  // Characterization test for a documented SDK quirk (notes D10):
  // the hook's `isAuthenticated` is `!!user`, and `autional.user` falls back to the
  // persisted user even when the access token is expired — so RequireAuth passes
  // until some API call 401s and forces logout. Asserting current behavior on purpose.
  it('expired session with a persisted user still renders children (stale-user fallback)', async () => {
    window.localStorage.setItem(
      'autional_tokens',
      JSON.stringify({
        accessToken: makeJwt(-60),
        refreshToken: 'refresh-token-2',
        user: { id: 'u-1', username: 'takenote-alice' },
        tenantId: 'tenant-abcd1234',
        expiresAt: Date.now() - 60 * 1000,
      })
    )

    renderGuardedApp()

    await waitFor(() => expect(screen.getByText('APP CONTENT')).toBeInTheDocument())
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument()
  })
})
