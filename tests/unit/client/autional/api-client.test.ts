import { ApiClient, TokenManager, memoryPlatform } from '@autional/core'

import { makeJwt, mockResponse } from './helpers'

const BASE_URL = 'https://api.autional.com/bff'

interface RecordedRequest {
  url: string
  init?: RequestInit
}

const buildClient = (
  responder: (req: RecordedRequest, callIndex: number) => Response,
  refreshTokenFn: () => Promise<void> = jest.fn(async () => {})
) => {
  const platform = memoryPlatform()
  const tokenManager = new TokenManager(platform.storage)
  const requests: RecordedRequest[] = []
  const http = {
    request: jest.fn(async (url: string, init?: RequestInit) => {
      const req = { url, init }
      requests.push(req)

      return responder(req, requests.length - 1)
    }),
  }
  const onForceLogout = jest.fn()
  const client = new ApiClient({
    baseUrl: BASE_URL,
    tokenManager,
    http,
    refreshTokenFn,
    onForceLogout,
  })

  return { client, tokenManager, requests, refreshTokenFn, onForceLogout }
}

describe('ApiClient (skill Phase 6: GET/POST + 401 refresh -> retry)', () => {
  it('GET sends the bearer token and unwraps {code:0, data} with snake->camel keys', async () => {
    const { client, tokenManager, requests } = buildClient(() =>
      mockResponse({
        body: { code: 0, data: { display_name: 'Panel', nested_list: [{ item_id: 1 }] } },
      })
    )
    const jwt = makeJwt(900)
    tokenManager.setTokens(jwt, 'r-1', 900)

    const result = await client.get<Record<string, unknown>>('/svc/api/v1/things')

    expect(result).toEqual({ displayName: 'Panel', nestedList: [{ itemId: 1 }] })
    expect(requests[0].url).toBe(`${BASE_URL}/svc/api/v1/things`)
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${jwt}`
    )
  })

  it('GET serializes params as snake_case query values', async () => {
    const { client, requests } = buildClient(() => mockResponse({ body: { code: 0, data: [] } }))

    await client.get('/svc/api/v1/things', { pageSize: 10, categoryId: 'c-1' })

    expect(requests[0].url).toBe(`${BASE_URL}/svc/api/v1/things?page_size=10&category_id=c-1`)
  })

  it('POST camel->snake converts the request body', async () => {
    const { client, requests } = buildClient(() =>
      mockResponse({ body: { code: 0, data: { ok: true } } })
    )

    await client.post('/svc/api/v1/things', { displayName: 'Note', nested: { itemId: 3 } })

    const body = JSON.parse(String(requests[0].init?.body))
    expect(body).toEqual({ display_name: 'Note', nested: { item_id: 3 } })
  })

  it('API error: {code != 0} on HTTP 200 throws AutionalApiError', async () => {
    const { client } = buildClient(() =>
      mockResponse({ body: { code: 42001, message: 'quota exceeded' } })
    )

    await expect(client.get('/svc/api/v1/things')).rejects.toMatchObject({
      name: 'AutionalApiError',
      code: '42001',
      status: 200,
    })
  })

  it('401 -> refreshTokenFn runs -> original request retried with the new token', async () => {
    const newJwt = makeJwt(900, { sub: 'u-refreshed' })
    let refreshed = false
    const refreshTokenFn = jest.fn(async () => {
      refreshed = true
      tokenManager.setTokens(newJwt, 'r-2', 900)
    })
    const { client, tokenManager, requests } = buildClient((_req, callIndex) => {
      if (callIndex === 0)
        return mockResponse({ status: 401, body: { code: 401, message: 'expired' } })

      return mockResponse({ body: { code: 0, data: { ok: true } } })
    }, refreshTokenFn)
    tokenManager.setTokens(makeJwt(900, { sub: 'u-old' }), 'r-1', 900)

    const result = await client.get<{ ok: boolean }>('/svc/api/v1/things')

    expect(result).toEqual({ ok: true })
    expect(refreshTokenFn).toHaveBeenCalledTimes(1)
    expect(refreshed).toBe(true)
    expect(requests).toHaveLength(2)
    expect((requests[1].init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${newJwt}`
    )
  })

  it('401 -> refresh failure forces logout, clears tokens, and rethrows', async () => {
    const refreshTokenFn = jest.fn(async () => {
      throw new Error('refresh rejected')
    })
    const { client, tokenManager, onForceLogout } = buildClient(
      () => mockResponse({ status: 401, body: { code: 401, message: 'expired' } }),
      refreshTokenFn
    )
    tokenManager.setTokens(makeJwt(900), 'r-1', 900)

    await expect(client.get('/svc/api/v1/things')).rejects.toMatchObject({
      name: 'AutionalAuthError',
      code: 'SESSION_EXPIRED',
    })
    expect(onForceLogout).toHaveBeenCalledTimes(1)
    expect(tokenManager.getAccessToken()).toBeNull()
  })
})
