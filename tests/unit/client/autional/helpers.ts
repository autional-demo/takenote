import { createHash } from 'crypto'

/** Build an unsigned JWT whose payload carries an `exp` claim. */
export const makeJwt = (
  expSecondsFromNow: number,
  claims: Record<string, unknown> = {}
): string => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    ...claims,
  }
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')

  return `${b64(header)}.${b64(payload)}.test-signature`
}

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex')

/**
 * Hand-rolled Response stand-in. jsdom 16 (jest 26) has no Response class,
 * and the SDK only touches `ok`, `status`, `json()` and `headers.get()`.
 */
export const mockResponse = (init: { status?: number; body?: unknown } = {}): Response => {
  const { status = 200, body } = init

  return ({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-length' && body === undefined ? '0' : null,
    },
    json: async () => body,
  } as unknown) as Response
}
