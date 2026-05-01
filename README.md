# Error Watcher

A Chrome/Edge browser extension that monitors web pages for JavaScript errors, console warnings, and network failures — and notifies you instantly via desktop alerts and a badge on the extension icon.

Built for software testers and developers who want to catch errors without keeping DevTools open.

---

## Features

- **JS error detection** — catches uncaught exceptions and runtime errors via the Chrome DevTools Protocol
- **Console error & warning capture** — listens to `console.error()` and `console.warn()` calls
- **Network failure tracking** — detects 4xx, 5xx, CORS blocks, and ERR_ failures with the actual request URL
- **Badge counter** — shows a red badge on the extension icon with the total error count
- **Monitoring scope** — monitor all sites or specific sites/ports only (e.g. `localhost:8009`)
- **Pause/resume monitoring** — toggle monitoring on and off without uninstalling
- **Per-category capture settings** — individually enable or disable JS exceptions, console errors, warnings, network failures, and desktop notifications
- **Error log with stack traces** — click any error in the popup to expand the full stack trace
- **Auto-refresh popup** — the popup updates in real time while it is open
- **Clear controls** — clear errors, warnings, and network failures individually or all at once

---

## Tech stack

| Layer | Choice |
|---|---|
| Manifest | V3 |
| Language | TypeScript |
| Build tool | Vite + CRXJS |
| Error capture | `chrome.debugger` (Chrome DevTools Protocol) |
| Notifications | `chrome.notifications` |
| UI | Plain HTML + CSS |
| Package manager | npm |

---

## Project structure

```
error-watcher/
├── manifest.json           # MV3 extension manifest
├── vite.config.ts          # Vite + CRXJS config
├── tsconfig.json           # TypeScript config
├── package.json
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── background.ts       # Service worker — core logic, CDP event handling
    ├── popup.html          # Popup UI markup
    ├── popup.ts            # Popup UI logic
    └── types.ts            # Shared TypeScript types
```

---

## Getting started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Chrome, Edge, or Brave browser

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/error-watcher.git
cd error-watcher
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build
```

4. Load into your browser:
   - Go to `chrome://extensions` (or `edge://extensions`)
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `dist/` folder

### Development

Run in watch mode — rebuilds automatically on file changes:

```bash
npm run dev
```

After each rebuild, click the reload icon next to the extension in `chrome://extensions` to apply changes.

---

## Usage

### Monitoring all sites (default)

By default, Error Watcher monitors every tab you open. Errors, warnings, and network failures from any page are captured and shown in the popup.

### Monitoring specific sites only

1. Click the extension icon to open the popup
2. Click **Settings**
3. Switch to **Specific sites only**
4. Type a domain or host in the input field and click **Add** (or press Enter)

Examples of valid entries:

| Entry | What it monitors |
|---|---|
| `myapp.com` | myapp.com and all subdomains |
| `localhost` | All localhost ports |
| `localhost:8009` | localhost:8009 only |
| `staging.myapp.com` | That subdomain only |

In this mode, the debugger only attaches to matching tabs — so the "Error Watcher started debugging this browser" banner only appears on pages you are actually monitoring.

### Pausing monitoring

Toggle the **Monitoring on/off** switch at the bottom of the Errors tab. The state persists across popup open/close until you toggle it again.

### Reading errors

- Click any entry in the Errors tab to expand the full stack trace
- The **Warnings** tab shows non-fatal console warnings
- The **Network** tab shows failed HTTP requests with status codes and URLs

### Clearing errors

- **Clear** — clears only the current tab's entries
- **Clear All** — clears errors, warnings, and network failures at once

---

## Settings reference

| Setting | Default | Description |
|---|---|---|
| Monitoring scope | All sites | Whether to monitor all tabs or specific domains only |
| JS exceptions | On | Catches uncaught runtime errors |
| Console errors | On | Catches `console.error()` calls |
| Console warnings | Off | Catches `console.warn()` calls |
| Network failures | On | Catches 4xx, 5xx, CORS, and ERR_ failures |
| Desktop notifications | On | Fires OS-level notifications on each error |

---

## Testing the extension

For testing network errors without snippets, navigate directly to:
- `https://httpstat.us/500`
- `https://httpstat.us/404`
- `https://httpstat.us/403`

---

## Known limitations

- **Console-typed errors are not caught** — errors thrown directly in the DevTools console (e.g. typing `null.toString()`) are intentionally excluded by Chrome from the DevTools Protocol. Wrap them in `setTimeout(() => ..., 100)` to trigger from page context instead.
- **SPA navigation** — single page apps that use `history.pushState` without a real page reload may not trigger re-attachment in specific sites mode.
- **DevTools conflict** — if you open Chrome DevTools on a tab, Chrome forces the extension to detach its debugger from that tab (only one debugger can attach at a time). Monitoring resumes when DevTools is closed and the page is reloaded.
- **The debugging banner** — when the extension attaches to a tab, Chrome/Edge shows a "Error Watcher started debugging this browser" banner. This is a Chrome security requirement and cannot be removed.

---

## Browser compatibility

| Browser | Supported |
|---|---|
| Chrome | Yes |
| Edge | Yes |
| Brave | Yes (requires CSP-compliant code — no inline event handlers) |
| Firefox | No (uses Chrome-specific `chrome.debugger` API) |
| Safari | No |

---

## Privacy

Error Watcher stores all captured data **locally in your browser** using `chrome.storage.local`. No data is ever sent to any external server. Captured errors are kept in local storage until you clear them manually, with a maximum of 50 entries per category.

---