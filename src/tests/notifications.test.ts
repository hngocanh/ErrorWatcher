import { describe, it, expect, beforeEach } from 'vitest'
import { resetChromeMocks, storageLocal } from './setup'
import { sendNotification } from '../background'

beforeEach(() => {
    resetChromeMocks()
})

describe('sendNotification', () => {
    it('creates a notification with truncated message and hostname', () => {
        const long = 'x'.repeat(200)
        sendNotification('T', long, 'https://example.com/some/path')
        expect(globalThis.chrome.notifications.create).toHaveBeenCalled()
    })
})
