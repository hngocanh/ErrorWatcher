import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setLocalStore } from './setup'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('chrome.storage.local', () => {
    it('returns default values when storage is empty', () => {
        chrome.storage.local.get({ errors: [], warnings: [] }, (data) => {
            expect(data.errors).toEqual([])
            expect(data.warnings).toEqual([])
        })
    })

    it('returns stored values over defaults', () => {
        setLocalStore({ errors: [{ message: 'test error' }] })
        chrome.storage.local.get({ errors: [] }, (data: { errors: Array<{ message: string }> }) => {
            expect(data.errors).toHaveLength(1)
            expect(data.errors[0].message).toBe('test error')
        })
    })

    it('saves and retrieves values correctly', () => {
        chrome.storage.local.set({ mode: 'specific' })
        chrome.storage.local.get({ mode: 'all' }, (data) => {
            expect(data.mode).toBe('specific')
        })
    })

    it('merges new values without overwriting existing ones', () => {
        setLocalStore({ errors: ['err1'], warnings: ['warn1'] })
        chrome.storage.local.set({ errors: ['err2'] })
        chrome.storage.local.get({ errors: [], warnings: [] }, (data) => {
            expect(data.errors).toEqual(['err2'])
            expect(data.warnings).toEqual(['warn1'])
        })
    })
})