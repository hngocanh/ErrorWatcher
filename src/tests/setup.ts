import { vi, beforeEach } from 'vitest'

// In-memory stores for mocks
const localStore: Record<string, any> = {}
const sessionStore: Record<string, any> = {}

// Build a chrome mock matching callback overloads used in code
const chromeMock = {
    storage: {
        local: {
            get: vi.fn((keys?: any, callback?: (items: any) => void) => {
                const defaults = typeof keys === 'object' && keys !== null && !Array.isArray(keys) ? keys : {}
                const result: Record<string, any> = {}
                for (const key of Object.keys(defaults)) {
                    result[key] = key in localStore ? localStore[key] : defaults[key]
                }
                if (callback) callback(result)
                return Promise.resolve(result)
            }),
            set: vi.fn((items: Record<string, any>, callback?: () => void) => {
                Object.assign(localStore, items)
                if (callback) callback()
                return Promise.resolve()
            }),
        },
        session: {
            get: vi.fn((keys?: any, callback?: (items: any) => void) => {
                const defaults = typeof keys === 'object' && keys !== null && !Array.isArray(keys) ? keys : {}
                const result: Record<string, any> = {}
                for (const key of Object.keys(defaults)) {
                    result[key] = key in sessionStore ? sessionStore[key] : defaults[key]
                }
                if (callback) callback(result)
                return Promise.resolve(result)
            }),
            set: vi.fn((items: Record<string, any>, callback?: () => void) => {
                Object.assign(sessionStore, items)
                if (callback) callback()
                return Promise.resolve()
            }),
        },
        onChanged: { addListener: vi.fn() },
    },
    debugger: {
        attach: vi.fn((target: any, version: string, callback?: () => void) => {
            if (callback) callback()
            return Promise.resolve()
        }),
        detach: vi.fn((target: any, callback?: () => void) => {
            if (callback) callback()
            return Promise.resolve()
        }),
        sendCommand: vi.fn(),
        onEvent: { addListener: vi.fn() },
        onDetach: { addListener: vi.fn() },
    },
    tabs: {
        query: vi.fn((queryInfo: any, callback?: (tabs: any[]) => void) => {
            const res: any[] = []
            if (callback) callback(res)
            return Promise.resolve(res)
        }),
        get: vi.fn((id: number, callback?: (tab: any) => void) => {
            const tab = { id, url: 'https://example.com' }
            if (callback) callback(tab)
            return Promise.resolve(tab)
        }),
        onUpdated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
        onCreated: { addListener: vi.fn() },
    },
    action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
    },
    notifications: {
        create: vi.fn((options: any, cb?: () => void) => {
            if (cb) cb()
            return 1
        }),
    },
    runtime: {
        lastError: undefined,
        onMessage: { addListener: vi.fn() },
        getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    },
}

// Expose as global
globalThis.chrome = chromeMock as any

// Reset before each test
beforeEach(() => {
    Object.keys(localStore).forEach(k => delete localStore[k])
    Object.keys(sessionStore).forEach(k => delete sessionStore[k])
    vi.clearAllMocks()
})

// Helpers for tests to seed storage
export function setLocalStore(values: Record<string, any>) {
    Object.assign(localStore, values)
}

export function setSessionStore(values: Record<string, any>) {
    Object.assign(sessionStore, values)
}

export { chromeMock as chrome, localStore as storageLocal, sessionStore as storageSession }

// Backwards-compatible reset helper used by some tests
export function resetChromeMocks() {
    Object.keys(localStore).forEach(k => delete localStore[k])
    Object.keys(sessionStore).forEach(k => delete sessionStore[k])
    vi.clearAllMocks()
}