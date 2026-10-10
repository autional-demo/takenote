import { AuthClient, TokenManager, memoryPlatform } from '@autional/core'

import { makeJwt, mockResponse, sha256Hex } from './helpers'

const BASE_URL = 'https://api.autional.com/bff'
const TENANT_ID = 'tenant-abcd1234'
// Synthetic credentials only — real demo-account passwords never enter the repo.
const PASSWORD = 'Synthetic-Passw0rd!'

interface RecordedRequest {
  url: string
  init?: RequestInit
}

const tenantAuthConfigBody = {
  data: {
    tenant_id: TENANT_ID,
    tenant_name: 'takenote-demo',
    display_name: 'Takenote Demo',
    login_methods: ['password'],
    password_policy: {
      password_transmission: 'hash',
      min_length: 8,
      max_length: 128,
      require_upper: true,
      require_lower: true,
      require_digit: true,
    },
  },
}

const buildClient = (responder: (req: RecordedRequest) => Response) => {
  const platform = memoryPlatform()
  const tokenManager = new TokenManager(platform.storage)
  const requests: RecordedRequest[] = []
  const http = {
    request: jest.fn(async (url: string, init?: RequestInit) => {
      const req = { url, init }
      requests.push(req)

      return responder(req)
    }),
  }
  const client = new AuthClient({ tokenManager, http, baseUrl: BASE_URL, tenantId: TENANT_ID })

  return { client, tokenManager, requests, http }
}

const defaultResponder = (req: RecordedRequest): Response => {
  if (req.url.includes('/public/auth-config/')) return mockResponse({ body: tenantAuthConfigBody })
  if (req.url.includes('/auth/login')) {
    return mockResponse({
      body: {
        code: 0,
        data: {
          access_token: makeJwt(900, { sub: 'u-1' }),
          refresh_token: 'refresh-token-1',
          expires_in: 900,
          token_type: 'Bearer',
          user: { id: 'u-1', username: 'takenote-alice' },
        },
      },
    })
  }
  if (req.url.includes('/auth/register')) {
    return mockResponse({
      body: {
        code: 0,
        data: {
          access_token: makeJwt(900, { sub: 'u-2' }),
          refresh_token: 'refresh-token-2',
          expires_in: 900,
          user: { id: 'u-2', username: 'takenote-bob' },
        },
      },
    })
  }
  if (req.url.includes('/auth/logout')) return mockResponse({ body: { code: 0 } })

  return mockResponse({ status: 404, body: { code: 404, message: 'not found' } })
}

describe('AuthClient (skill Phase 6: login / register / logout over mock HTTP)', () => {
  it('login: fetches per-tenant auth-config, hashes the password, stores tokens', async () => {
    const { client, tokenManager, requests } = buildClient(defaultResponder)

    const result = await client.login({
      username: 'takenote-alice',
      password: PASSWORD,
      tenantId: TENANT_ID,
    })

    expect(result.accessToken).toEqual(expect.any(String))
    expect(result.user).toEqual({ id: 'u-1', username: 'takenote-alice' })
    expect(tokenManager.isAuthenticated()).toBe(true)

    const configReq = requests.find((r) => r.url.includes('/public/auth-config/'))
    expect(configReq?.url).toBe(`${BASE_URL}/identity/api/v1/public/auth-config/${TENANT_ID}`)

    const loginReq = requests.find((r) => r.url.includes('/auth/login'))
    expect(loginReq?.url).toBe(`${BASE_URL}/identity/api/v1/auth/login`)
    const body = JSON.parse(String(loginReq?.init?.body))
    expect(body.identity).toBe('takenote-alice')
    expect(body.tenant_id).toBe(TENANT_ID)
    expect(body.password).toBe(sha256Hex(`${PASSWORD}|${TENANT_ID}`))
    expect(body.password_transmission).toBe('hash')
  })

  it('login: email is used as identity when present', async () => {
    const { client, requests } = buildClient(defaultResponder)

    await client.login({ email: 'alice@example.com', password: PASSWORD, tenantId: TENANT_ID })

    const loginReq = requests.find((r) => r.url.includes('/auth/login'))
    const body = JSON.parse(String(loginReq?.init?.body))
    expect(body.identity).toBe('alice@example.com')
  })

  it('login: failed HTTP surfaces AutionalAuthError with server code', async () => {
    const { client } = buildClient((req) =>
      req.url.includes('/public/auth-config/')
        ? mockResponse({ body: tenantAuthConfigBody })
        : mockResponse({ status: 401, body: { code: '40000502', message: 'invalid credentials' } })
    )

    await expect(
      client.login({ username: 'takenote-alice', password: 'wrong-password', tenantId: TENANT_ID })
    ).rejects.toMatchObject({ code: '40000502', status: 401 })
  })

  it('register: sends hashed password and normalizes user_id to id when no tokens are returned', async () => {
    const { client, requests } = buildClient((req) => {
      if (req.url.includes('/public/auth-config/'))
        return mockResponse({ body: tenantAuthConfigBody })

      return mockResponse({ body: { code: 0, data: { user_id: 'u-9', email: 'new@example.com' } } })
    })

    const result = await client.register({
      email: 'new@example.com',
      password: PASSWORD,
      tenantId: TENANT_ID,
    } as any)

    const registerReq = requests.find((r) => r.url.includes('/auth/register'))
    const body = JSON.parse(String(registerReq?.init?.body))
    expect(body.password).toBe(sha256Hex(`${PASSWORD}|${TENANT_ID}`))
    expect(body.password_transmission).toBe('hash')
    // Characterization of a documented inconsistency (notes D12): register() spreads the
    // caller's object verbatim, so tenantId stays camelCase — login() maps it to tenant_id.
    expect(body.tenantId).toBe(TENANT_ID)
    expect(body.tenant_id).toBeUndefined()

    expect(result.accessToken).toBe('')
    expect(result.user).toMatchObject({ id: 'u-9', user_id: 'u-9' })
  })

  it('register: stores tokens when the tenant auto-logs-in on registration', async () => {
    const { client, tokenManager } = buildClient(defaultResponder)

    const result = await client.register({
      email: 'bob@example.com',
      password: PASSWORD,
      tenantId: TENANT_ID,
    } as any)

    expect(result.accessToken).toEqual(expect.any(String))
    expect(tokenManager.isAuthenticated()).toBe(true)
  })

  it('logout: clears stored tokens and calls the logout endpoint with the bearer token', async () => {
    const { client, tokenManager, requests } = buildClient(defaultResponder)
    const login = await client.login({
      username: 'takenote-alice',
      password: PASSWORD,
      tenantId: TENANT_ID,
    })
    expect(tokenManager.isAuthenticated()).toBe(true)

    await client.logout()

    expect(tokenManager.isAuthenticated()).toBe(false)
    expect(tokenManager.getAccessToken()).toBeNull()
    const logoutReq = requests.find((r) => r.url.includes('/auth/logout'))
    expect(logoutReq?.url).toBe(`${BASE_URL}/identity/api/v1/auth/logout`)
    expect((logoutReq?.init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${login.accessToken}`
    )
  })
})
