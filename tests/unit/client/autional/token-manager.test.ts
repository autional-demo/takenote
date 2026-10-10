import { TokenManager, memoryPlatform } from '@autional/core'

import { makeJwt } from './helpers'

describe('TokenManager (skill Phase 6: store / expire / decode)', () => {
  const makeManager = (prefix?: string) => {
    const platform = memoryPlatform()

    return { manager: new TokenManager(platform.storage, prefix), platform }
  }

  it('stores tokens and reports authentication for a valid JWT', () => {
    const { manager } = makeManager()
    const jwt = makeJwt(60 * 60)

    manager.setTokens(jwt, 'refresh-token-1', 3600)

    expect(manager.getAccessToken()).toBe(jwt)
    expect(manager.getRefreshToken()).toBe('refresh-token-1')
    expect(manager.isAuthenticated()).toBe(true)
    expect(manager.getExpiresAt()).toBeGreaterThan(Date.now())
  })

  it('persists under <prefix>tokens and reloads the same store', async () => {
    const platform = memoryPlatform()
    const writer = new TokenManager(platform.storage)
    const jwt = makeJwt(60 * 60)
    writer.setTokens(jwt, 'refresh-token-2', 3600)
    writer.setUser({ id: 'u-1', username: 'alice' })
    writer.setTenantId('tenant-abc')
    await writer.persist()

    const reader = new TokenManager(platform.storage)
    await reader.load()

    expect(reader.getAccessToken()).toBe(jwt)
    expect(reader.getRefreshToken()).toBe('refresh-token-2')
    expect(reader.getUser()).toEqual({ id: 'u-1', username: 'alice' })
    expect(reader.getTenantId()).toBe('tenant-abc')
    expect(reader.isAuthenticated()).toBe(true)
  })

  it('treats an expired JWT as unauthenticated and returns null', () => {
    const { manager } = makeManager()
    const expiredJwt = makeJwt(-10)
    manager.setTokens(expiredJwt, 'refresh-token-3', 900)

    expect(manager.isTokenExpired(expiredJwt)).toBe(true)
    expect(manager.getAccessToken()).toBeNull()
    expect(manager.isAuthenticated()).toBe(false)
  })

  it('treats tokens without a decodable exp claim as expired', () => {
    const { manager } = makeManager()
    manager.setTokens('not-a-jwt', 'refresh-token-4', 900)

    expect(manager.getAccessToken()).toBeNull()
    expect(manager.isAuthenticated()).toBe(false)
  })

  it('decodes JWT claims and returns null for malformed tokens', () => {
    const { manager } = makeManager()

    const claims = manager.decodeToken(makeJwt(120, { sub: 'user-7', role: 'admin' }))
    expect(claims).not.toBeNull()
    expect(claims!.sub).toBe('user-7')
    expect(claims!.role).toBe('admin')
    expect(claims!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))

    expect(manager.decodeToken('garbage')).toBeNull()
    expect(manager.decodeToken('a.b')).toBeNull()
  })

  it('clears the store and notifies change listeners', () => {
    const { manager } = makeManager()
    const listener = jest.fn()
    manager.onTokenChange(listener)
    manager.setTokens(makeJwt(60), 'refresh-token-5', 900)
    expect(listener).toHaveBeenCalledWith(expect.any(String))

    manager.clear()
    expect(listener).toHaveBeenLastCalledWith(null)
    expect(manager.getAccessToken()).toBeNull()
    expect(manager.isAuthenticated()).toBe(false)
  })
})
