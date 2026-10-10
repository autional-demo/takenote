// Jest 26 ships jsdom 16, which lacks TextEncoder/TextDecoder.
// @autional/core instantiates `new TextEncoder()` at module load
// (crypto/password-transmission.ts), so any suite importing the SDK
// needs these globals before the module is evaluated.
import { TextEncoder, TextDecoder } from 'util'

if (typeof (global as any).TextEncoder === 'undefined') {
  ;(global as any).TextEncoder = TextEncoder
}
if (typeof (global as any).TextDecoder === 'undefined') {
  ;(global as any).TextDecoder = TextDecoder
}
