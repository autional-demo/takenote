import { processPasswordForTransmission } from '@autional/core'

import { sha256Hex } from './helpers'

describe('processPasswordForTransmission (skill Phase 6: hash mode)', () => {
  const policy = {
    mode: 'hash',
    tenantId: 'tenant-abc',
    requireUpper: false,
    minLength: 0,
    publicKey: '',
  }

  it('hash mode produces sha256(password + "|" + tenantId) lowercase hex', async () => {
    const result = await processPasswordForTransmission('Correct-Horse-9', policy)

    expect(result.password).toBe(sha256Hex('Correct-Horse-9|tenant-abc'))
    expect(result.password).toMatch(/^[0-9a-f]{64}$/)
    expect(result.passwordTransmission).toBe('hash')
  })

  it('hash output differs per tenant (tenantId is part of the digest input)', async () => {
    const a = await processPasswordForTransmission('Same-Password-1', policy)
    const b = await processPasswordForTransmission('Same-Password-1', {
      ...policy,
      tenantId: 'tenant-xyz',
    })

    expect(a.password).not.toBe(b.password)
  })

  it('plain mode passes the raw password through untouched', async () => {
    const result = await processPasswordForTransmission('Raw-Password-2', {
      ...policy,
      mode: 'plain',
    })

    expect(result.password).toBe('Raw-Password-2')
    expect(result.passwordTransmission).toBe('plain')
  })

  it('missing mode defaults to plain', async () => {
    const result = await processPasswordForTransmission('Raw-Password-3', {
      ...policy,
      mode: '' as any,
    })

    expect(result.password).toBe('Raw-Password-3')
    expect(result.passwordTransmission).toBe('plain')
  })

  it('symmetric mode without a key exchange function rejects', async () => {
    await expect(
      processPasswordForTransmission('Raw-Password-4', { ...policy, mode: 'symmetric' })
    ).rejects.toThrow('keyExchangeFn is required for symmetric mode')
  })
})
