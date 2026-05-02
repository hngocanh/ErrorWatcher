import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowed, isInternalUrl } from '../background'

describe('isInternalUrl', () => {
    it('returns true for chrome:// URLs', () => {
        expect(isInternalUrl('chrome://extensions')).toBe(true)
    })

    it('returns true for edge:// URLs', () => {
        expect(isInternalUrl('edge://extensions')).toBe(true)
    })

    it('returns true for chrome-extension:// URLs', () => {
        expect(isInternalUrl('chrome-extension://abc123/popup.html')).toBe(true)
    })

    it('returns true for about: URLs', () => {
        expect(isInternalUrl('about:blank')).toBe(true)
    })

    it('returns false for regular http URLs', () => {
        expect(isInternalUrl('https://myapp.com')).toBe(false)
    })

    it('returns false for localhost URLs', () => {
        expect(isInternalUrl('http://localhost:3000')).toBe(false)
    })
})

describe('isAllowed — all sites mode', () => {
    const config = { mode: 'all', allowlist: [] }

    it('allows any URL in all sites mode', () => {
        expect(isAllowed('https://google.com', config)).toBe(true)
        expect(isAllowed('https://myapp.com', config)).toBe(true)
        expect(isAllowed('http://localhost:3000', config)).toBe(true)
    })

    it('blocks extension URLs even in all sites mode', () => {
        expect(isAllowed('chrome-extension://abc/detail.html', config)).toBe(false)
    })
})

describe('isAllowed — specific sites mode', () => {
    it('blocks everything when allowlist is empty', () => {
        const config = { mode: 'specific', allowlist: [] }
        expect(isAllowed('https://myapp.com', config)).toBe(false)
    })

    it('allows a domain that is in the allowlist', () => {
        const config = { mode: 'specific', allowlist: ['myapp.com'] }
        expect(isAllowed('https://myapp.com', config)).toBe(true)
    })

    it('allows subdomains of an allowlisted domain', () => {
        const config = { mode: 'specific', allowlist: ['myapp.com'] }
        expect(isAllowed('https://staging.myapp.com', config)).toBe(true)
    })

    it('blocks a domain not in the allowlist', () => {
        const config = { mode: 'specific', allowlist: ['myapp.com'] }
        expect(isAllowed('https://google.com', config)).toBe(false)
    })

    it('allows localhost without port', () => {
        const config = { mode: 'specific', allowlist: ['localhost'] }
        expect(isAllowed('http://localhost:3000', config)).toBe(true)
        expect(isAllowed('http://localhost:8009', config)).toBe(true)
    })

    it('allows specific localhost port', () => {
        const config = { mode: 'specific', allowlist: ['localhost:8009'] }
        expect(isAllowed('http://localhost:8009', config)).toBe(true)
        expect(isAllowed('http://localhost:3000', config)).toBe(false)
    })

    it('blocks invalid URLs', () => {
        const config = { mode: 'specific', allowlist: ['myapp.com'] }
        expect(isAllowed('not-a-url', config)).toBe(false)
        expect(isAllowed('', config)).toBe(false)
    })
})