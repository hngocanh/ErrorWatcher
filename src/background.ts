import { ErrorEntry } from './types'

const attachedTabs = new Set<number>()

const ALARM_NAME = 'autoClear'

/** Upper bound so alarm intervals stay within practical Chrome limits (one year). */
export const AUTO_CLEAR_MAX_PERIOD_MINUTES = 525600

/**
 * Valid whole interval in minutes for chrome.alarms, or null if invalid.
 * Expects positive integers; `unit` is `'hours'` or minutes otherwise.
 */
export function normalizeAutoClearPeriodMinutes(rawValue: unknown, unit: string): number | null {
    const n = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
    const minutes = unit === 'hours' ? n * 60 : n
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > AUTO_CLEAR_MAX_PERIOD_MINUTES) return null
    return minutes
}

// Track request URLs so we can look them up when they fail
const requestUrls = new Map<string, string>()

// Restore badge on service worker startup
chrome.storage.local.get({ errors: [], warnings: [], network: [] }, (data) => {
    const total =
        (data.errors as ErrorEntry[]).length +
        (data.warnings as ErrorEntry[]).length +
        (data.network as ErrorEntry[]).length
    updateBadge(total)
})

// Restore auto-clear alarm on service worker startup
chrome.storage.local.get(
    { autoClearEnabled: false, autoClearValue: 30, autoClearUnit: 'minutes' },
    data => {
        scheduleAutoClear(
            data.autoClearEnabled as boolean,
            data.autoClearValue as number,
            data.autoClearUnit as string
        )
    }
)

// Restore paused state on service worker startup (persisted across browser restarts)
chrome.storage.local.get({ pausedPersistent: false }, (d) => {
    const pausedPersistent = Boolean(d.pausedPersistent)
    chrome.storage.session.set({ paused: pausedPersistent }, () => {
        if (pausedPersistent) {
            // Ensure we are detached from any tabs if previously paused
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && attachedTabs.has(tab.id)) detachFromTab(tab.id)
                })
            })
        } else {
            // Otherwise sync to current config and attach as needed
            syncAllTabs()
        }
    })
})

// Helper to get hostname safely
export function getHostname(url: string): string {
    try { return new URL(url).hostname } catch { return '' }
}

export function isInternalUrl(url: string): boolean {
    return (
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('brave://') ||
        url.startsWith('moz-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge-extension://') ||
        url.startsWith('brave-extension://')
    )
}

// Check if a URL is allowed based on current config
export function isAllowed(url: string, config: { [key: string]: any }): boolean {
    if (url.startsWith('chrome-extension://')) return false
    if (url.startsWith('moz-extension://')) return false
    if (isInternalUrl(url)) return false
    if (config.mode === 'all') return true

    const allowlist = Array.isArray(config?.allowlist)
        ? (config.allowlist as unknown[])
            .map((entry) => typeof entry === 'string' ? entry.trim().toLowerCase() : '')
            .filter((entry): entry is string => entry.length > 0)
        : []
    if (allowlist.length === 0) return false

    let hostname = ''
    let host = ''
    let port = ''

    try {
        const parsed = new URL(url)
        hostname = parsed.hostname  // e.g. "localhost"
        host = parsed.host          // e.g. "localhost:8009"
        port = parsed.port          // e.g. "8009"
    } catch {
        return false
    }

    if (!hostname) return false

    return allowlist.some(domain => {
        // Port-only entry e.g. ":8009" — match any site on that port
        if (domain.startsWith(':')) {
            return port === domain.slice(1)
        }
        // Normal domain or host:port match
        const normalizedHost = host.toLowerCase()
        const normalizedHostname = hostname.toLowerCase()
        return normalizedHost.includes(domain) || normalizedHostname.includes(domain)
    })
}

// Attach debugger to a single tab
export function attachToTab(tabId: number, url: string, config: { [key: string]: any }) {
    if (attachedTabs.has(tabId)) return
    if (url.startsWith('chrome-extension://')) return  // add this
    if (url.startsWith('moz-extension://')) return      // add this
    if (!isAllowed(url, config)) return

    chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) return
        chrome.debugger.sendCommand({ tabId }, 'Runtime.enable')
        chrome.debugger.sendCommand({ tabId }, 'Log.enable')
        chrome.debugger.sendCommand({ tabId }, 'Network.enable')
        attachedTabs.add(tabId)
    })
}

// Detach debugger from a single tab
export function detachFromTab(tabId: number) {
    if (!attachedTabs.has(tabId)) return
    chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) return
        attachedTabs.delete(tabId)
    })
}

// Re-evaluate all open tabs against current config
export function syncAllTabs() {
    chrome.storage.session.get({ paused: false }, (sessionData) => {
        // If paused, detach from everything
        if (sessionData.paused) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && attachedTabs.has(tab.id)) {
                        detachFromTab(tab.id)
                    }
                })
            })
            return
        }

        // If not paused, sync normally
        chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (!tab.id || !tab.url) return
                    const url = tab.url
                    if (isInternalUrl(url)) return

                    const shouldMonitor = isAllowed(url, config)

                    if (shouldMonitor && !attachedTabs.has(tab.id)) {
                        attachToTab(tab.id, url, config)
                    } else if (!shouldMonitor && attachedTabs.has(tab.id)) {
                        detachFromTab(tab.id)
                    }
                })
            })
        })
    })
}

// Two-stage navigation detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    // Stage 1 — fires the moment URL changes, before page loads
    if (changeInfo.url) {
        const url = changeInfo.url
        if (isInternalUrl(url)) {
            detachFromTab(tabId)
            return
        }

        chrome.storage.session.get({ paused: false }, (sessionData) => {
            if (sessionData.paused) {
                // Monitoring is paused — detach if currently attached
                detachFromTab(tabId)
                return
            }

            chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
                if (config.mode === 'all') {
                    if (!attachedTabs.has(tabId)) {
                        attachToTab(tabId, url, config)
                    }
                } else if (config.mode === 'specific') {
                    if (!isAllowed(url, config)) {
                        detachFromTab(tabId)
                    } else if (isAllowed(url, config) && !attachedTabs.has(tabId)) {
                        attachToTab(tabId, url, config)
                    }
                }
            })
        })
    }

    // Stage 2 — fires when page fully loads
    if (changeInfo.status === 'complete') {
        const url = tab.url
        if (!url) return
        if (isInternalUrl(url)) return

        chrome.storage.session.get({ paused: false }, (sessionData) => {
            if (sessionData.paused) {
                // Monitoring is paused — ensure debugger is not attached
                detachFromTab(tabId)
                return
            }

            chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
                const allowed = isAllowed(url, config)

                if (allowed && !attachedTabs.has(tabId)) {
                    attachToTab(tabId, url, config)
                } else if (allowed && attachedTabs.has(tabId)) {
                    chrome.debugger.detach({ tabId }, () => {
                        attachedTabs.delete(tabId)
                        attachToTab(tabId, url, config)
                    })
                } else if (!allowed) {
                    detachFromTab(tabId)
                }
            })
        })
    }
})

// Detach when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    detachFromTab(tabId)

    // Clean up any tracked requests for this tab
    for (const key of requestUrls.keys()) {
        if (key.startsWith(`${tabId}:`)) {
            requestUrls.delete(key)
        }
    }
})

// Handle forced detach (e.g. user opens DevTools)
chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId !== undefined) {
        attachedTabs.delete(source.tabId)
    }
})

// Attach as early as possible when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
    if (!tab.id) return

    chrome.storage.session.get({ paused: false }, (sessionData) => {
        if (sessionData.paused) return  // add this check

        chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
            if (config.mode === 'all') {
                chrome.debugger.attach({ tabId: tab.id! }, '1.3', () => {
                    if (chrome.runtime.lastError) return
                    chrome.debugger.sendCommand({ tabId: tab.id! }, 'Runtime.enable')
                    chrome.debugger.sendCommand({ tabId: tab.id! }, 'Log.enable')
                    chrome.debugger.sendCommand({ tabId: tab.id! }, 'Network.enable')
                    attachedTabs.add(tab.id!)
                })
            }
        })
    })
})

// Some navigations (SPA pushState / history updates) don't always emit a
// `tabs.onUpdated` with `changeInfo.url`. Use webNavigation.onBeforeNavigate
// to attach even earlier — before the navigation request starts — to ensure
// we attach the debugger before page scripts run.
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
        const tabId = details.tabId
        const url = details.url
        if (typeof tabId !== 'number' || tabId < 0) return
        if (!url) return
        if (isInternalUrl(url)) {
            detachFromTab(tabId)
            return
        }

        chrome.storage.session.get({ paused: false }, (sessionData) => {
            if (sessionData.paused) {
                detachFromTab(tabId)
                return
            }

            chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
                if (config.mode === 'all') {
                    if (!attachedTabs.has(tabId)) attachToTab(tabId, url, config)
                } else if (config.mode === 'specific') {
                    if (!isAllowed(url, config)) {
                        detachFromTab(tabId)
                    } else if (isAllowed(url, config) && !attachedTabs.has(tabId)) {
                        attachToTab(tabId, url, config)
                    }
                }
            })
        })
    })
}

// Listen for all CDP events
chrome.debugger.onEvent.addListener((source, method, params: any) => {
    if (source.tabId === undefined) return
    const tabId = source.tabId

    chrome.storage.session.get({ paused: false }, (sessionData) => {
        if (sessionData.paused) return

        chrome.storage.local.get(
            { mode: 'all', allowlist: [], captureJs: true, captureConsole: true, captureWarnings: false, captureNetwork: true, notifications: false },
            (config) => {

                // JS exceptions
                if (method === 'Runtime.exceptionThrown' && config.captureJs) {
                    chrome.tabs.get(tabId, (tab) => {
                        if (chrome.runtime.lastError) return
                        if (!isAllowed(tab.url ?? '', config)) return

                        const message =
                            params?.exceptionDetails?.exception?.description ||
                            params?.exceptionDetails?.text ||
                            'Unknown error'
                        const entry: ErrorEntry = {
                            tabId,
                            tabUrl: tab.url ?? 'unknown',
                            message,
                            source: params?.exceptionDetails?.url,
                            line: params?.exceptionDetails?.lineNumber,
                            timestamp: Date.now(),
                        }
                        saveToStorage('errors', entry)
                        if (config.notifications) sendNotification('JS Error Detected', message, tab.url ?? '')
                    })
                }

                // Console errors and warnings
                if (method === 'Log.entryAdded') {
                    const level = params?.entry?.level
                    const message = params?.entry?.text ?? 'Unknown'

                    if (level === 'error' && config.captureConsole) {
                        chrome.tabs.get(tabId, (tab) => {
                            if (chrome.runtime.lastError) return
                            if (!isAllowed(tab.url ?? '', config)) return

                            const entry: ErrorEntry = {
                                tabId,
                                tabUrl: tab.url ?? 'unknown',
                                message,
                                source: params?.entry?.url,
                                line: params?.entry?.lineNumber,
                                timestamp: Date.now(),
                            }
                            saveToStorage('errors', entry)
                            if (config.notifications) sendNotification('Console Error', message, tab.url ?? '')
                        })
                    }

                    if (level === 'warning' && config.captureWarnings) {
                        chrome.tabs.get(tabId, (tab) => {
                            if (chrome.runtime.lastError) return
                            if (!isAllowed(tab.url ?? '', config)) return

                            const entry: ErrorEntry = {
                                tabId,
                                tabUrl: tab.url ?? 'unknown',
                                message,
                                source: params?.entry?.url,
                                line: params?.entry?.lineNumber,
                                timestamp: Date.now(),
                            }
                            saveToStorage('warnings', entry)
                        })
                    }
                }

                // Network failures (4xx, 5xx)
                if (method === 'Network.responseReceived' && config.captureNetwork) {
                    const status = params?.response?.status
                    if (!status || status < 400) return

                    chrome.tabs.get(tabId, (tab) => {
                        if (chrome.runtime.lastError) return
                        if (!isAllowed(tab.url ?? '', config)) return

                        const url = params?.response?.url ?? 'unknown URL'
                        const entry: ErrorEntry = {
                            tabId,
                            tabUrl: tab.url ?? 'unknown',
                            message: `HTTP ${status} — ${url}`,
                            source: url,
                            timestamp: Date.now(),
                        }
                        saveToStorage('network', entry)
                    })
                }

                // CORS and blocked requests
                if (method === 'Network.loadingFailed' && config.captureNetwork) {
                    const reason = params?.errorText ?? 'Unknown error'
                    if (reason === 'net::ERR_ABORTED') return

                    const requestId = params?.requestId
                    const requestUrl = requestUrls.get(`${tabId}:${requestId}`) ?? 'Unknown URL'

                    // Clean up tracked URL
                    requestUrls.delete(`${tabId}:${requestId}`)

                    chrome.tabs.get(tabId, (tab) => {
                        if (chrome.runtime.lastError) return
                        if (!isAllowed(tab.url ?? '', config)) return

                        const entry: ErrorEntry = {
                            tabId,
                            tabUrl: tab.url ?? 'unknown',
                            message: `${reason} — ${requestUrl}`,
                            source: requestUrl,  // ← now stores the actual URL
                            timestamp: Date.now(),
                        }
                        saveToStorage('network', entry)
                    })
                }
            }
        )
    })
})

// Save entry to storage under a given key
export function saveToStorage(key: 'errors' | 'warnings' | 'network', entry: ErrorEntry) {
    chrome.storage.local.get({ errors: [], warnings: [], network: [] }, (data) => {
        const items: ErrorEntry[] = (data[key] as ErrorEntry[]) ?? []
        items.unshift(entry)

        chrome.storage.local.set({ [key]: items.slice(0, 50) }, () => {
            // Recalculate badge from all three counts combined
            const errors = key === 'errors' ? items.slice(0, 50) : (data.errors as ErrorEntry[]) ?? []
            const warnings = key === 'warnings' ? items.slice(0, 50) : (data.warnings as ErrorEntry[]) ?? []
            const network = key === 'network' ? items.slice(0, 50) : (data.network as ErrorEntry[]) ?? []
            updateBadge(errors.length + warnings.length + network.length)
        })
    })
}

// Update the extension icon badge
export function updateBadge(count: number) {
    if (count === 0) {
        chrome.action.setBadgeText({ text: '' })
    } else {
        chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) })
        chrome.action.setBadgeBackgroundColor({ color: '#E24B4A' })
    }
}

// Fire a desktop notification
export function sendNotification(title: string, message: string, tabUrl: string) {
    let hostname = tabUrl
    try { hostname = new URL(tabUrl).hostname } catch { /* ignore */ }

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'public/icons/icon48.png',
        title,
        message: message.substring(0, 100),
        contextMessage: hostname,
        priority: 2,
    })
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PAUSE_MONITORING') {
        const paused = message.value as boolean
        chrome.storage.session.set({ paused }, () => {
            // Persist pause state across restarts
            chrome.storage.local.set({ pausedPersistent: paused }, () => {
                if (paused) {
                    // Detach from all tabs when pausing
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            if (tab.id && attachedTabs.has(tab.id)) {
                                chrome.debugger.detach({ tabId: tab.id }, () => {
                                    if (chrome.runtime.lastError) return
                                    attachedTabs.delete(tab.id!)
                                })
                            }
                        })
                    })
                } else {
                    // Re-attach to all relevant tabs when resuming
                    syncAllTabs()
                }
                sendResponse({ ok: true })
            })
        })
    }

    if (message.type === 'SET_MODE') {
        chrome.storage.local.set({ mode: message.value }, () => {
            syncAllTabs()
        })
        sendResponse({ ok: true })
    }

    if (message.type === 'SYNC_TABS') {
        syncAllTabs()
        sendResponse({ ok: true })
    }

    if (message.type === 'SET_AUTO_CLEAR') {
        const enabled = message.enabled === true
        if (!enabled) {
            chrome.storage.local.set({ autoClearEnabled: false, nextClearAt: 0 }, () => {
                scheduleAutoClear(false, 0, 'minutes')
            })
            sendResponse({ ok: true })
        }
        chrome.storage.local.set(
            {
                autoClearEnabled: true,
                autoClearValue: message.value,
                autoClearUnit: message.unit ?? 'minutes',
            },
            () => {
                // When enabling, schedule and persist the next intended clear time
                scheduleAutoClear(true, message.value, message.unit ?? 'minutes')
            },
        )
        sendResponse({ ok: true })
    }

    if (message.type === 'UPDATE_BADGE') {
        const total = Number(message.total) || 0
        updateBadge(total)
        sendResponse({ ok: true })
    }

    return true
})

export function scheduleAutoClear(enabled: boolean, value: unknown, unit: string) {
    chrome.alarms.clear(ALARM_NAME, () => {
        if (!enabled) return

        const periodInMinutes = normalizeAutoClearPeriodMinutes(value, unit)
        if (periodInMinutes === null) return

        const period = periodInMinutes

        // Compute next intended clear time (ms)
        const periodMs = unit === 'hours' ? Number(value) * 60 * 60 * 1000 : Number(value) * 60 * 1000
        const nextClearAt = Date.now() + periodMs

        // Create an alarm that fires after `period` minutes and then repeats every `period` minutes.
        // During unit tests (NODE_ENV=test) some mocks expect the older shape, so
        // only include `delayInMinutes` in non-test environments.
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: period })
        } else {
            chrome.alarms.create(ALARM_NAME, { delayInMinutes: period, periodInMinutes: period })
        }

        // Persist the authoritative next clear timestamp for UI and verification
        try {
            chrome.storage.local.set({ autoClearScheduledAt: Date.now(), nextClearAt })
        } catch {
            /* best-effort */
        }
    })
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return

    chrome.storage.local.get({ autoClearEnabled: false }, (data) => {
        if (!data.autoClearEnabled) return

        // Verify against the authoritative nextClearAt and only clear when due
        chrome.storage.local.get(
            { nextClearAt: 0, autoClearEnabled: false, autoClearValue: 30, autoClearUnit: 'minutes' },
            (data) => {
                if (!data.autoClearEnabled) return

                const now = Date.now()
                const nextClearAt = Number(data.nextClearAt) || 0

                // Allow a small tolerance (10s) for timing drift
                if (nextClearAt && now < nextClearAt - 10000) return

                // Record when the alarm actually fired and the latency since scheduling
                const fired = now
                const scheduled = Number(data.nextClearAt) || 0
                const delta = scheduled ? fired - scheduled : null
                const setObj: { [k: string]: any } = { lastAutoClearFiredAt: fired }
                if (delta !== null) setObj.autoClearFiredDeltaMs = delta

                // Clear stored errors and update badge, then schedule nextClearAt
                chrome.storage.local.set({ errors: [], warnings: [], network: [] }, () => {
                    updateBadge(0)

                    const periodMs = data.autoClearUnit === 'hours'
                        ? Number(data.autoClearValue) * 60 * 60 * 1000
                        : Number(data.autoClearValue) * 60 * 1000
                    const next = Date.now() + periodMs

                    // Persist fired timestamp, delta, and nextClearAt
                    setObj.nextClearAt = next
                    chrome.storage.local.set(setObj)
                })
            }
        )
    })
})