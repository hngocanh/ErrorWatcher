import { describe, it, expect } from 'vitest'
import { isAllowed } from '../background'

describe('isAllowed - extra cases', () => {
    it('handles mixed-case domains and whitespace in allowlist', () => {
        const config = { mode: 'specific', allowlist: ['  MyApp.com  '] }
        expect(isAllowed('https://myapp.com', config)).toBe(true)
        expect(isAllowed('https://sub.myapp.com', config)).toBe(true)
    })

    it('handles IP addresses and ports correctly', () => {
        const cfg1 = { mode: 'specific', allowlist: ['127.0.0.1'] }
        expect(isAllowed('http://127.0.0.1:3000', cfg1)).toBe(true)

        const cfg2 = { mode: 'specific', allowlist: ['localhost:8009'] }
        expect(isAllowed('http://localhost:8009', cfg2)).toBe(true)
        expect(isAllowed('http://localhost:3000', cfg2)).toBe(false)
    })

    it('returns false when config is missing fields', () => {
        // @ts-ignore - simulate missing keys
        expect(isAllowed('https://example.com', {})).toBe(false)
    })
})
