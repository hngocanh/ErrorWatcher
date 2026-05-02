import { describe, it, expect } from 'vitest'
import { getHostname } from '../background'

describe('getHostname', () => {
    it('returns hostname for valid URL', () => {
        expect(getHostname('https://example.com/path')).toBe('example.com')
    })

    it('returns empty string for invalid URL', () => {
        expect(getHostname('not-a-url')).toBe('')
        expect(getHostname('')).toBe('')
    })

    it('handles IP addresses', () => {
        expect(getHostname('http://127.0.0.1:3000')).toBe('127.0.0.1')
    })
})
