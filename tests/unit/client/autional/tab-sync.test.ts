import { Autional, memoryPlatform } from '@autional/core'

import { makeJwt } from './helpers'

// Skill verification checklist: "Multi-tab — logout in tab A -> tab B notices".
// TabSync no-ops when BroadcastChannel is undefined (jsdom), so we install a fake
// and drive its onmessage handler directly.
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  name: string
  onmessage: ((event: { data: unknown }) => void) | null = null
  closed = false

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }
  postMessage(): void {}
  close(): void {
    this.closed = true
  }
}

describe('TabSync cross-tab logout (skill verification checklist)', () => {
  const originalBroadcastChannel = (global as any).BroadcastChannel

  beforeEach(() => {
    FakeBroadcastChannel.instances = []
    ;(global as any).BroadcastChannel = FakeBroadcastChannel
  })

  afterEach(() => {
    ;(global as any).BroadcastChannel = originalBroadcastChannel
  })

  it('a LOGOUT broadcast from another tab clears the token store and emits LOGGED_OUT', () => {
    const autional = new Autional({
      appId: 'test-app',
      issuer: 'https://api.autional.com',
      apiUrl: 'https://api.autional.com/bff',
      platform: memoryPlatform(),
    })
    const tokenManager = (autional as any).tokenManager
    tokenManager.setTokens(makeJwt(900), 'refresh-token-1', 900)
    expect(tokenManager.isAuthenticated()).toBe(true)

    const loggedOut = jest.fn()
    autional.on('LOGGED_OUT', loggedOut)

    const channel = FakeBroadcastChannel.instances.find((c) => c.name === 'autional:sync')
    expect(channel).toBeDefined()
    channel!.onmessage!({ data: { type: 'LOGOUT', timestamp: Date.now() } })

    expect(tokenManager.getAccessToken()).toBeNull()
    expect(tokenManager.isAuthenticated()).toBe(false)
    expect(loggedOut).toHaveBeenCalledTimes(1)

    autional.dispose()
    expect(channel!.closed).toBe(true)
  })
})
