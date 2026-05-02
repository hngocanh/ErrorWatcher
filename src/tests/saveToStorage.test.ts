import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetChromeMocks, storageLocal } from './setup'
import { saveToStorage } from '../background'

beforeEach(() => {
    resetChromeMocks()
})

describe('saveToStorage behavior', () => {
    it('inserts entries and caps at 50', () => {
        // seed with 50 items
        storageLocal.errors = Array.from({ length: 50 }, (_, i) => ({ id: i }))
        const entry = { id: 999 }
        saveToStorage('errors', entry)
        expect(storageLocal.errors).toHaveLength(50)
        expect(storageLocal.errors[0]).toEqual(entry)
        // last item should be previous 49th
    })
})
