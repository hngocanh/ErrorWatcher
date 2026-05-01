import { ErrorEntry } from './types'

const attachedTabs = new Set<number>()

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

// Helper to get hostname safely
function getHostname(url: string): string {
    try { return new URL(url).hostname } catch { return '' }
}

// Check if a URL is allowed based on current config
function isAllowed(url: string, config: { [key: string]: any }): boolean {
    if (config.mode === 'all') return true
    const allowlist = config.allowlist as string[]
    if (allowlist.length === 0) return false

    let hostname = ''
    let host = ''
    try {
        const parsed = new URL(url)
        hostname = parsed.hostname  // e.g. "localhost"
        host = parsed.host          // e.g. "localhost:8009"
    } catch {
        return false
    }

    if (!hostname) return false

    return allowlist.some(domain => {
        // Match against both host (with port) and hostname (without port)
        // This way "localhost" matches all localhost ports
        // and "localhost:8009" matches only that specific port
        return host.includes(domain) || hostname.includes(domain)
    })
}

// Attach debugger to a single tab
function attachToTab(tabId: number, url: string, config: { [key: string]: any }) {
    if (attachedTabs.has(tabId)) return
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
function detachFromTab(tabId: number) {
    if (!attachedTabs.has(tabId)) return
    chrome.debugger.detach({ tabId }, () => {
        if (chrome.runtime.lastError) return
        attachedTabs.delete(tabId)
    })
}

// Re-evaluate all open tabs against current config
function syncAllTabs() {
    chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (!tab.id || !tab.url) return
                const url = tab.url
                if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return

                const shouldMonitor = isAllowed(url, config)

                if (shouldMonitor && !attachedTabs.has(tab.id)) {
                    attachToTab(tab.id, url, config)
                } else if (!shouldMonitor && attachedTabs.has(tab.id)) {
                    detachFromTab(tab.id)
                }
            })
        })
    })
}

// Two-stage navigation detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    // Stage 1 — fires the moment URL changes, before page loads
    if (changeInfo.url) {
        const url = changeInfo.url
        if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
            detachFromTab(tabId)
            return
        }

        chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
            if (config.mode === 'specific' && !isAllowed(url, config)) {
                detachFromTab(tabId)
            } else if (config.mode === 'specific' && isAllowed(url, config) && !attachedTabs.has(tabId)) {
                // In specific mode, attach early once we know the URL is allowed
                attachToTab(tabId, url, config)
            }
        })
    }

    // Stage 2 — fires when page fully loads
    if (changeInfo.status === 'complete') {
        const url = tab.url
        if (!url) return
        if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) return

        chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
            const allowed = isAllowed(url, config)

            if (allowed && !attachedTabs.has(tabId)) {
                // Not yet attached — attach now
                attachToTab(tabId, url, config)
            } else if (allowed && attachedTabs.has(tabId)) {
                // Already attached from onCreated or previous load — re-attach cleanly for reload
                chrome.debugger.detach({ tabId }, () => {
                    attachedTabs.delete(tabId)
                    attachToTab(tabId, url, config)
                })
            } else if (!allowed) {
                detachFromTab(tabId)
            }
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

    chrome.storage.local.get({ mode: 'all', allowlist: [] }, (config) => {
        // In all-sites mode, attach immediately even before URL is known
        if (config.mode === 'all') {
            chrome.debugger.attach({ tabId: tab.id! }, '1.3', () => {
                if (chrome.runtime.lastError) return
                chrome.debugger.sendCommand({ tabId: tab.id! }, 'Runtime.enable')
                chrome.debugger.sendCommand({ tabId: tab.id! }, 'Log.enable')
                chrome.debugger.sendCommand({ tabId: tab.id! }, 'Network.enable')
                attachedTabs.add(tab.id!)
            })
        }
        // In specific-sites mode we wait for the URL to be known in onUpdated
    })
})

// Listen for all CDP events
chrome.debugger.onEvent.addListener((source, method, params: any) => {
    if (source.tabId === undefined) return
    const tabId = source.tabId

    chrome.storage.session.get({ paused: false }, (sessionData) => {
        if (sessionData.paused) return

        chrome.storage.local.get(
            { mode: 'all', allowlist: [], captureJs: true, captureConsole: true, captureWarnings: false, captureNetwork: true, notifications: true },
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
function saveToStorage(key: 'errors' | 'warnings' | 'network', entry: ErrorEntry) {
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
function updateBadge(count: number) {
    if (count === 0) {
        chrome.action.setBadgeText({ text: '' })
    } else {
        chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) })
        chrome.action.setBadgeBackgroundColor({ color: '#E24B4A' })
    }
}

// Fire a desktop notification
function sendNotification(title: string, message: string, tabUrl: string) {
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
        chrome.storage.session.set({ paused: message.value })
        sendResponse({ ok: true })
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

    return true
})