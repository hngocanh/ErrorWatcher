import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    normalizeAutoClearPeriodMinutes,
    AUTO_CLEAR_MAX_PERIOD_MINUTES,
    scheduleAutoClear,
} from '../background'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('normalizeAutoClearPeriodMinutes', () => {
    it('minutes: accepts positive integers', () => {
        expect(normalizeAutoClearPeriodMinutes(30, 'minutes')).toBe(30)
        expect(normalizeAutoClearPeriodMinutes('45', 'minutes')).toBe(45)
    })

    it('hours: multiplies by 60', () => {
        expect(normalizeAutoClearPeriodMinutes(2, 'hours')).toBe(120)
        expect(normalizeAutoClearPeriodMinutes('1', 'hours')).toBe(60)
    })

    it('rejects NaN, non-integer, zero, negative', () => {
        expect(normalizeAutoClearPeriodMinutes(NaN, 'minutes')).toBeNull()
        expect(normalizeAutoClearPeriodMinutes(Number.POSITIVE_INFINITY, 'minutes')).toBeNull()
        expect(normalizeAutoClearPeriodMinutes(1.5, 'minutes')).toBeNull()
        expect(normalizeAutoClearPeriodMinutes(0, 'minutes')).toBeNull()
        expect(normalizeAutoClearPeriodMinutes(-1, 'minutes')).toBeNull()
        expect(normalizeAutoClearPeriodMinutes('x', 'minutes')).toBeNull()
    })

    it('rejects when minutes exceed max', () => {
        expect(
            normalizeAutoClearPeriodMinutes(AUTO_CLEAR_MAX_PERIOD_MINUTES + 1, 'minutes'),
        ).toBeNull()
        expect(
            normalizeAutoClearPeriodMinutes(Math.floor(AUTO_CLEAR_MAX_PERIOD_MINUTES / 60) + 1, 'hours'),
        ).toBeNull()
    })

    it('accepts boundary at max', () => {
        expect(normalizeAutoClearPeriodMinutes(AUTO_CLEAR_MAX_PERIOD_MINUTES, 'minutes')).toBe(
            AUTO_CLEAR_MAX_PERIOD_MINUTES,
        )
    })
})

describe('scheduleAutoClear', () => {
    it('clears alarm and does not create when disabled', () => {
        scheduleAutoClear(false, 30, 'minutes')
        expect(chrome.alarms.clear).toHaveBeenCalledWith('autoClear', expect.any(Function))
        expect(chrome.alarms.create).not.toHaveBeenCalled()
    })

    it('creates alarm when enabled with valid interval', () => {
        scheduleAutoClear(true, 5, 'minutes')
        expect(chrome.alarms.clear).toHaveBeenCalledWith('autoClear', expect.any(Function))
        expect(chrome.alarms.create).toHaveBeenCalledWith('autoClear', { periodInMinutes: 5 })
    })

    it('does not create when interval is invalid', () => {
        scheduleAutoClear(true, NaN, 'minutes')
        expect(chrome.alarms.create).not.toHaveBeenCalled()
    })
})
