// Read the error data passed via URL query params
const params = new URLSearchParams(window.location.search)
const category = params.get('category') ?? 'error'
const message = params.get('message') ?? ''
const source = params.get('source') ?? ''
const line = params.get('line') ?? ''
const tabUrl = params.get('tabUrl') ?? ''
const timestamp = parseInt(params.get('timestamp') ?? '0')

// Error type pill
const typeEl = document.getElementById('error-type')!
if (category === 'warning') {
    typeEl.textContent = 'Console Warning'
    typeEl.className = 'error-type type-warning'
} else if (category === 'network') {
    typeEl.textContent = 'Network Failure'
    typeEl.className = 'error-type type-network'
} else {
    typeEl.textContent = 'JS Exception'
    typeEl.className = 'error-type type-error'
}

// Error message
document.getElementById('error-message')!.textContent = message

// Details
document.getElementById('detail-source')!.textContent = source || '—'
document.getElementById('detail-line')!.textContent = line || '—'
document.getElementById('detail-url')!.textContent = tabUrl || '—'
document.getElementById('detail-time')!.textContent = timestamp
    ? new Date(timestamp).toLocaleString()
    : '—'

// Stack trace — split message into lines and highlight first line
const stack = document.getElementById('detail-stack')!
const lines = message.split('\n')
if (lines.length > 1) {
    stack.innerHTML = lines.map((line, i) =>
        `<span class="stack-line ${i === 0 ? 'highlight' : ''}">${line}</span>`
    ).join('')
} else {
    stack.textContent = message
}

// Copy button
document.getElementById('copy-btn')!.addEventListener('click', () => {
    navigator.clipboard.writeText(message).then(() => {
        const btn = document.getElementById('copy-btn')!
        btn.textContent = 'Copied!'
        btn.classList.add('copied')
        setTimeout(() => {
            btn.textContent = 'Copy'
            btn.classList.remove('copied')
        }, 2000)
    })
})

// Close button
document.querySelector('.back')!.addEventListener('click', () => {
    chrome.tabs.getCurrent((tab) => {
        if (tab?.id !== undefined) {
            chrome.tabs.remove(tab.id)
        }
    })
})