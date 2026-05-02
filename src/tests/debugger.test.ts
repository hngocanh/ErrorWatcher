import { describe, it, expect, beforeEach } from 'vitest'
import { resetChromeMocks, storageLocal } from './setup'
import { attachToTab, detachFromTab } from '../background'

beforeEach(() => {
    resetChromeMocks()
})

describe('attach/detach debugger flow', () => {
    it('attaches and records tab when allowed', () => {
        storageLocal.mode = 'all'
        const spyAttach = (globalThis.chrome.debugger.attach as any)
        attachToTab(42, 'https://example.com', { mode: 'all', allowlist: [] })
        expect(spyAttach).toHaveBeenCalled()
    })

    it('does not attach to extension pages', () => {
        storageLocal.mode = 'all'
        const spyAttach = (globalThis.chrome.debugger.attach as any)
        attachToTab(43, 'chrome-extension://abc/popup.html', { mode: 'all', allowlist: [] })
        expect(spyAttach).not.toHaveBeenCalled()
    })

    it('detaches only when attached', () => {
        const spyDetach = (globalThis.chrome.debugger.detach as any)
        // detach should be safe even when not attached
        detachFromTab(99)
        expect(spyDetach).not.toHaveBeenCalled()
    })
})
