import { ErrorEntry } from './types'

// --- Tab switching ---
function showTab(name: string) {
    const panes = ['errors', 'warnings', 'network', 'settings']
    panes.forEach(t => {
        const el = document.getElementById('pane-' + t)
        if (el) el.style.display = 'none'
    })
    const active = document.getElementById('pane-' + name)
    if (active) active.style.display = 'block'

    document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', ['errors', 'warnings', 'network'][i] === name)
    })
}

document.getElementById('tab-errors')!.addEventListener('click', () => showTab('errors'))
document.getElementById('tab-warnings')!.addEventListener('click', () => showTab('warnings'))
document.getElementById('tab-network')!.addEventListener('click', () => showTab('network'))
document.getElementById('tab-settings-btn')!.addEventListener('click', () => showTab('settings'))

// --- Helpers ---
function getHostname(url: string): string {
    try { return new URL(url).hostname } catch { return url }
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString()
}

function openDetail(entry: ErrorEntry, category: 'error' | 'warning' | 'network') {
    console.log('openDetail called:', { entry, category }) // debug line

    const params = new URLSearchParams({
        category,
        message: entry.message,
        source: entry.source ?? '',
        line: String(entry.line ?? ''),
        tabUrl: entry.tabUrl,
        timestamp: String(entry.timestamp),
    })

    const url = chrome.runtime.getURL(`src/detail.html?${params.toString()}`)
    console.log('opening URL:', url) // debug line
    chrome.tabs.create({ url })
}

// --- Render errors ---
function renderErrors(errors: ErrorEntry[]) {
    const list = document.getElementById('error-list')!
    const badge = document.getElementById('error-badge')!
    const mErr = document.getElementById('m-err')!
    const dot = document.getElementById('status-dot')!

    mErr.textContent = String(errors.length)

    if (errors.length === 0) {
        list.innerHTML = '<div class="empty-state">No errors recorded yet.</div>'
        badge.textContent = '0 errors'
        badge.className = 'badge badge-gray'
        dot.className = 'dot ok'
        return
    }

    badge.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''}`
    badge.className = 'badge badge-red'
    dot.className = 'dot'

    list.innerHTML = errors.map((e, i) => `
  <div class="error-item" data-index="${i}">
    <div class="error-row">
      <svg class="error-icon" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" fill="#FCEBEB" stroke="#F09595" stroke-width="0.8"/>
        <text x="7" y="10.5" text-anchor="middle" font-size="9" fill="#A32D2D" font-weight="700">!</text>
      </svg>
      <div style="flex:1;min-width:0">
        <div class="error-msg">${e.message.substring(0, 120)}</div>
        <div class="error-meta">
          ${e.source ? `<span>${e.source}${e.line !== undefined ? ':' + e.line : ''}</span>` : ''}
          <span>${getHostname(e.tabUrl)}</span>
          <span>${formatTime(e.timestamp)}</span>
        </div>
      </div>
      <svg class="nav-icon" data-index="${i}" viewBox="0 0 14 14" fill="none" title="View detail">
        <path d="M3 7h8M7 3l4 4-4 4" stroke="#aaa" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="error-detail">${e.message}</div>
  </div>
`).join('')

    // Expand on row click, open detail on icon click
    list.querySelectorAll('.error-item').forEach((item, i) => {
        item.addEventListener('click', () => item.classList.toggle('expanded'))
    })

    list.querySelectorAll('.nav-icon').forEach((icon) => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation() // prevent expanding the row
            const index = parseInt((icon as HTMLElement).dataset.index ?? '0')
            openDetail(errors[index], 'error')
        })
    })
}

// --- Render warnings ---
function renderWarnings(warnings: ErrorEntry[]) {
    const list = document.getElementById('warn-list')!
    const count = document.getElementById('warn-count')!
    const mWarn = document.getElementById('m-warn')!

    mWarn.textContent = String(warnings.length)
    count.textContent = `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`

    if (warnings.length === 0) {
        list.innerHTML = '<div class="empty-state">No warnings recorded yet.</div>'
        return
    }

    list.innerHTML = warnings.map((e, i) => `
    <div class="warn-item" data-index="${i}">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div class="warn-msg">${e.message.substring(0, 120)}</div>
          <div class="error-meta" style="margin-top:2px;font-size:11px;color:#aaa;display:flex;gap:8px;flex-wrap:wrap;">
            ${e.source ? `<span>${e.source}</span>` : ''}
            <span>${getHostname(e.tabUrl)}</span>
            <span>${formatTime(e.timestamp)}</span>
          </div>
        </div>
        <svg class="nav-icon" data-index="${i}" viewBox="0 0 14 14" fill="none" title="View detail">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="#aaa" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  `).join('')

    // Navigate icon click — open detail page
    list.querySelectorAll('.nav-icon').forEach((icon) => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation()
            const index = parseInt((icon as HTMLElement).dataset.index ?? '0')
            openDetail(warnings[index], 'warning')  // ← 'warning' passed here
        })
    })
}

// --- Render network ---
function renderNetwork(entries: ErrorEntry[]) {
    const list = document.getElementById('net-list')!
    const count = document.getElementById('net-count')!
    const mNet = document.getElementById('m-net')!

    mNet.textContent = String(entries.length)
    count.textContent = `${entries.length} failure${entries.length !== 1 ? 's' : ''}`

    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-state">No network failures recorded yet.</div>'
        return
    }

    list.innerHTML = entries.map((e, i) => {
        const isHttp = e.message.startsWith('HTTP')
        const pillText = isHttp ? e.message.split(' ')[1] : 'ERR'
        const status = parseInt(pillText)
        const pillClass = isHttp
            ? (status >= 500 ? 's-500' : 's-400')
            : 's-cors'
        const displayMsg = e.source ?? e.message

        return `
      <div class="net-item" data-index="${i}">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="status-pill ${pillClass}">${pillText}</span>
          <div class="net-msg" style="flex:1;min-width:0;">${displayMsg.substring(0, 60)}</div>
          <svg class="nav-icon" data-index="${i}" viewBox="0 0 14 14" fill="none" title="View detail">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="#aaa" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="net-meta">${getHostname(e.tabUrl)} · ${formatTime(e.timestamp)}</div>
      </div>
    `
    }).join('')

    // Navigate icon click — open detail page
    list.querySelectorAll('.nav-icon').forEach((icon) => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation()
            const index = parseInt((icon as HTMLElement).dataset.index ?? '0')
            openDetail(entries[index], 'network')  // ← 'network' passed here
        })
    })
}

// --- Render allowlist tags ---
function renderAllowlist(allowlist: string[]) {
    const container = document.getElementById('allowlist-tags')!
    const empty = document.getElementById('allowlist-empty')!

    if (allowlist.length === 0) {
        container.innerHTML = ''
        container.appendChild(empty)
        empty.style.display = 'inline'
        return
    }

    empty.style.display = 'none'
    container.innerHTML = allowlist.map(domain => `
    <div class="allowlist-tag">
      <span>${domain}</span>
      <span class="allowlist-tag-remove" data-domain="${domain}">×</span>
    </div>
  `).join('')

    container.querySelectorAll('.allowlist-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const domain = (btn as HTMLElement).dataset.domain!
            chrome.storage.local.get({ allowlist: [] }, (data) => {
                const updated = (data.allowlist as string[]).filter(d => d !== domain)
                chrome.storage.local.set({ allowlist: updated }, () => {
                    renderAllowlist(updated)
                    chrome.runtime.sendMessage({ type: 'SYNC_TABS' })
                })
            })
        })
    })
}

// --- Auto-clear UI helpers ---
function parsePositiveIntegerInterval(raw: string): number | null {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const num = Number(trimmed)
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) return null
    return num
}

function normalizeStoredAutoClearValue(raw: unknown): number {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1) return n
    return 30
}

function updateAutoClearUI(enabled: boolean) {
    const valueInput = document.getElementById('autoclear-value') as HTMLInputElement
    const unitSelect = document.getElementById('autoclear-unit') as HTMLSelectElement
    valueInput.disabled = !enabled
    unitSelect.disabled = !enabled
    if (!enabled) {
        document.getElementById('autoclear-hint')!.style.display = 'none'
        document.getElementById('autoclear-next')!.style.display = 'none'
    }
}

function showAutoClearNext(value: number, unit: string) {
    const nextEl = document.getElementById('autoclear-next')!
    const label = unit === 'hours'
        ? `${value} hour${value !== 1 ? 's' : ''}`
        : `${value} minute${value !== 1 ? 's' : ''}`
    nextEl.textContent = `Errors, warnings, and network failures will be cleared every ${label}`
    nextEl.style.display = 'block'
}

function showAutoClearError(msg: string) {
    const hint = document.getElementById('autoclear-hint')!
    hint.textContent = msg
    hint.className = 'autoclear-hint error'
    hint.style.display = 'block'
}

function clearAutoClearError() {
    const hint = document.getElementById('autoclear-hint')!
    hint.style.display = 'none'
    hint.className = 'autoclear-hint'
}

// --- Load settings ---
function loadSettings() {
    chrome.storage.local.get(
        { mode: 'all', allowlist: [], captureJs: true, captureConsole: true, captureWarnings: false, captureNetwork: true, notifications: false, autoClearEnabled: false, autoClearValue: 30, autoClearUnit: 'minutes' },
        (data) => {
            const mode = data.mode as string

            // Mode buttons
            document.getElementById('mode-all')!.classList.toggle('active', mode === 'all')
            document.getElementById('mode-specific')!.classList.toggle('active', mode === 'specific')

            // Show/hide allowlist
            const wrap = document.getElementById('allowlist-wrap')!
            wrap.classList.toggle('visible', mode === 'specific')

            // Allowlist tags
            renderAllowlist(data.allowlist as string[])

                // Capture toggles
                ; (document.getElementById('s-js') as HTMLInputElement).checked = data.captureJs as boolean
                ; (document.getElementById('s-console') as HTMLInputElement).checked = data.captureConsole as boolean
                ; (document.getElementById('s-warn') as HTMLInputElement).checked = data.captureWarnings as boolean
                ; (document.getElementById('s-network') as HTMLInputElement).checked = data.captureNetwork as boolean
                ; (document.getElementById('s-notif') as HTMLInputElement).checked = data.notifications as boolean

            // Auto-clear
            const enabled = data.autoClearEnabled as boolean
            const value = normalizeStoredAutoClearValue(data.autoClearValue)
            const unit = data.autoClearUnit as string

                ; (document.getElementById('s-autoclear') as HTMLInputElement).checked = enabled
                ; (document.getElementById('autoclear-value') as HTMLInputElement).value = String(value)
                ; (document.getElementById('autoclear-unit') as HTMLSelectElement).value = unit
            updateAutoClearUI(enabled)
            if (enabled) showAutoClearNext(value, unit)
        }
    )
}

// --- Load all data ---
function loadAll() {
    chrome.storage.local.get({ errors: [], warnings: [], network: [] }, (data) => {
        renderErrors(data.errors as ErrorEntry[])
        renderWarnings(data.warnings as ErrorEntry[])
        renderNetwork(data.network as ErrorEntry[])
    })

    // Restore monitor toggle state
    chrome.storage.session.get({ paused: false }, (data) => {
        const toggle = document.getElementById('monitor-toggle') as HTMLInputElement
        const label = document.getElementById('monitor-label')!
        const isPaused = data.paused as boolean
        toggle.checked = !isPaused
        label.textContent = isPaused ? 'Monitoring paused' : 'Monitoring on'
    })

    loadSettings()
}

loadAll()

// --- Clear buttons ---
// Clear errors only
document.getElementById('clear-btn')!.addEventListener('click', () => {
    chrome.storage.local.get({ warnings: [], network: [] }, (data) => {
        chrome.storage.local.set({ errors: [] }, () => {
            renderErrors([])
            const total = (data.warnings as ErrorEntry[]).length + (data.network as ErrorEntry[]).length
            chrome.action.setBadgeText({ text: total === 0 ? '' : total > 99 ? '99+' : String(total) })
        })
    })
})

// Clear warnings only
document.getElementById('clear-warn-btn')!.addEventListener('click', () => {
    chrome.storage.local.get({ errors: [], network: [] }, (data) => {
        chrome.storage.local.set({ warnings: [] }, () => {
            renderWarnings([])
            const total = (data.errors as ErrorEntry[]).length + (data.network as ErrorEntry[]).length
            chrome.action.setBadgeText({ text: total === 0 ? '' : total > 99 ? '99+' : String(total) })
        })
    })
})

// Clear network only
document.getElementById('clear-net-btn')!.addEventListener('click', () => {
    chrome.storage.local.get({ errors: [], warnings: [] }, (data) => {
        chrome.storage.local.set({ network: [] }, () => {
            renderNetwork([])
            const total = (data.errors as ErrorEntry[]).length + (data.warnings as ErrorEntry[]).length
            chrome.action.setBadgeText({ text: total === 0 ? '' : total > 99 ? '99+' : String(total) })
        })
    })
})

// Clear all
document.getElementById('clear-all-btn')!.addEventListener('click', () => {
    chrome.storage.local.set({ errors: [], warnings: [], network: [] }, () => {
        renderErrors([])
        renderWarnings([])
        renderNetwork([])
        chrome.action.setBadgeText({ text: '' })
    })
})

// --- Monitor toggle ---
document.getElementById('monitor-toggle')!.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked
    document.getElementById('monitor-label')!.textContent = on ? 'Monitoring on' : 'Monitoring paused'
    chrome.runtime.sendMessage({ type: 'PAUSE_MONITORING', value: !on })
})

// --- Mode buttons ---
document.getElementById('mode-all')!.addEventListener('click', () => {
    chrome.storage.local.set({ mode: 'all' }, () => loadSettings())
    chrome.runtime.sendMessage({ type: 'SET_MODE', value: 'all' })
})

document.getElementById('mode-specific')!.addEventListener('click', () => {
    chrome.storage.local.set({ mode: 'specific' }, () => loadSettings())
    chrome.runtime.sendMessage({ type: 'SET_MODE', value: 'specific' })
})

// --- Allowlist add ---
document.getElementById('allowlist-add-btn')!.addEventListener('click', () => {
    const input = document.getElementById('allowlist-input') as HTMLInputElement
    const value = input.value.trim().toLowerCase()
    if (!value) return

    let domain: string

    // Port-only entry e.g. ":8009" or "8009"
    if (/^:?\d+$/.test(value)) {
        domain = value.startsWith(':') ? value : `:${value}`
    } else {
        // Strip protocol and path, keep host:port
        domain = value.replace(/^https?:\/\//, '').split('/')[0]
    }

    chrome.storage.local.get({ allowlist: [] }, (data) => {
        const list = data.allowlist as string[]
        if (list.includes(domain)) {
            input.value = ''
            return
        }
        const updated = [...list, domain]
        chrome.storage.local.set({ allowlist: updated }, () => {
            renderAllowlist(updated)
            input.value = ''
            chrome.runtime.sendMessage({ type: 'SYNC_TABS' })
        })
    })
})

// Allow pressing Enter to add
document.getElementById('allowlist-input')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
        document.getElementById('allowlist-add-btn')!.click()
    }
})

// --- Capture setting toggles ---
const captureToggles: Record<string, string> = {
    's-js': 'captureJs',
    's-console': 'captureConsole',
    's-warn': 'captureWarnings',
    's-network': 'captureNetwork',
    's-notif': 'notifications',
}

Object.entries(captureToggles).forEach(([id, storageKey]) => {
    document.getElementById(id)!.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked
        chrome.storage.local.set({ [storageKey]: checked })
    })
})

// --- Auto-clear toggle ---
document.getElementById('s-autoclear')!.addEventListener('change', e => {
    const enabled = (e.target as HTMLInputElement).checked
    const value = parsePositiveIntegerInterval((document.getElementById('autoclear-value') as HTMLInputElement).value)
    const unit = (document.getElementById('autoclear-unit') as HTMLSelectElement).value

    updateAutoClearUI(enabled)

    if (enabled) {
        if (value === null) {
            showAutoClearError('Please enter a whole number of 1 or more.')
                ; (e.target as HTMLInputElement).checked = false
            updateAutoClearUI(false)
            return
        }
        clearAutoClearError()
        showAutoClearNext(value, unit)
        chrome.storage.local.set(
            { autoClearEnabled: true, autoClearValue: value, autoClearUnit: unit },
            () => {
                chrome.runtime.sendMessage({ type: 'SET_AUTO_CLEAR', enabled: true, value, unit })
            },
        )
        return
    }

    chrome.storage.local.set({ autoClearEnabled: false }, () => {
        chrome.runtime.sendMessage({ type: 'SET_AUTO_CLEAR', enabled: false })
    })
})

// --- Auto-clear value/unit change ---
function onAutoClearChange() {
    const enabled = (document.getElementById('s-autoclear') as HTMLInputElement).checked
    if (!enabled) return

    const value = parsePositiveIntegerInterval((document.getElementById('autoclear-value') as HTMLInputElement).value)
    const unit = (document.getElementById('autoclear-unit') as HTMLSelectElement).value

    if (value === null) {
        showAutoClearError('Please enter a whole number of 1 or more.')
        return
    }

    clearAutoClearError()
    showAutoClearNext(value, unit)
    chrome.storage.local.set({ autoClearValue: value, autoClearUnit: unit }, () => {
        chrome.runtime.sendMessage({ type: 'SET_AUTO_CLEAR', enabled: true, value, unit })
    })
}

document.getElementById('autoclear-value')!.addEventListener('change', onAutoClearChange)
document.getElementById('autoclear-unit')!.addEventListener('change', onAutoClearChange)

// --- Auto-refresh when storage changes ---
chrome.storage.onChanged.addListener((changes) => {
    if (changes.errors) renderErrors(changes.errors.newValue as ErrorEntry[])
    if (changes.warnings) renderWarnings(changes.warnings.newValue as ErrorEntry[])
    if (changes.network) renderNetwork(changes.network.newValue as ErrorEntry[])
})