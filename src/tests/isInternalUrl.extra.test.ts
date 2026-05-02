import { describe, it, expect } from 'vitest'
import { isInternalUrl } from '../background'

describe('isInternalUrl - extra cases', () => {
    it('recognizes moz-extension and view-source', () => {
        expect(isInternalUrl('moz-extension://abc123/page.html')).toBe(true)
        expect(isInternalUrl('view-source:https://example.com')).toBe(false)
    })

    it('returns false for empty string', () => {
        expect(isInternalUrl('')).toBe(false)
    })
})
