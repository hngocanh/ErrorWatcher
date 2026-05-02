import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateBadge } from '../background'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('updateBadge', () => {
    it('clears the badge when count is 0', () => {
        updateBadge(0)
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
    })

    it('shows count when there are errors', () => {
        updateBadge(5)
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '5' })
    })

    it('shows 99+ when count exceeds 99', () => {
        updateBadge(150)
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '99+' })
    })

    it('shows exactly 99 when count is 99', () => {
        updateBadge(99)
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '99' })
    })

    it('sets red badge color when count is above 0', () => {
        updateBadge(3)
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#E24B4A' })
    })

    it('does not set badge color when count is 0', () => {
        updateBadge(0)
        expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled()
    })
})