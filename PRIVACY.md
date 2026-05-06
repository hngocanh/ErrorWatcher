# Privacy Policy — Error Watcher

**Last updated:** May 2026

## Overview

Error Watcher is designed with privacy first. **All error data stays on your device** — we don't collect, store, analyze, or share any of your information. The extension operates entirely locally and sends no data to external servers.

- ✅ No analytics or tracking
- ✅ No third-party services
- ✅ No data collection or transmission
- ✅ No advertisements
- ✅ You have complete control over your error logs

---

## What Data We Collect

Error Watcher monitors and stores the following information **locally on your device**:

### JavaScript Errors
- Error messages and error types
- Full stack traces (including file paths and line numbers)
- Timestamp of when the error occurred
- URL of the tab where the error happened

### Console Warnings & Errors
- Messages from `console.error()` calls
- Messages from `console.warn()` calls
- Timestamp of each message
- Tab URL where the message originated

### Network Failures
- Failed request URLs (4xx, 5xx, CORS, ERR_ failures)
- HTTP status codes
- Failure type (e.g., CORS error, network error)
- Timestamp of the failure
- Tab URL where the request originated

### User Settings & Preferences
- Monitoring scope (all sites or specific sites/ports)
- Toggle states (enabled/disabled for each error category)
- Desktop notification preference
- Your personal monitoring configuration

---

## How Data Is Stored

All data is stored **exclusively on your device** using the browser's `chrome.storage.local` API:

- Data persists between browser sessions until you manually clear it
- Each browser profile maintains completely separate data
- No data is synchronized to the cloud
- No backups are created
- No data leaves your device under any circumstances

---

## Browser Permissions Explained

Error Watcher requires the following permissions. Here's why:

| Permission | Purpose | Data Usage |
|---|---|---|
| **debugger** | Access Chrome DevTools Protocol to capture JavaScript errors | Raw error information is processed locally; no data is stored externally |
| **notifications** | Send desktop alerts when errors are detected | Used only to display notifications; notification history is not stored |
| **tabs** | Identify which tab has an error so we can track and display it | Tab URLs are stored in your local error log; cleared when you delete errors |
| **storage** | Save your monitoring settings and error logs locally | All data stored in your browser's local storage only |

---

## Data Retention & Deletion

You have **complete control** over your error logs:

- **Retention:** Error logs are retained indefinitely until you manually clear them
- **Clear individual categories:** Delete just JavaScript errors, console errors, warnings, or network failures
- **Clear all:** Clear all errors at once with one click
- **No auto-delete:** Error Watcher does not automatically delete any data
- **On uninstall:** All stored data is permanently removed when you uninstall the extension

---

## Third-Party Services

**Error Watcher does not use any third-party services.** This means:

- ❌ No analytics platform (Google Analytics, Mixpanel, etc.)
- ❌ No crash reporting service (Sentry, Bugsnag, etc.)
- ❌ No external APIs or webhooks
- ❌ No CDNs for extension code
- ❌ No advertisement network

All processing happens entirely within your browser.

---

## User Control & Privacy Settings

You maintain full control over what Error Watcher monitors:

### Pause/Resume Monitoring
- Temporarily disable monitoring without uninstalling the extension
- Resume at any time

### Per-Category Controls
- Individually enable or disable:
  - JavaScript error detection
  - Console error capture
  - Console warning capture
  - Network failure tracking
  - Desktop notifications

### Monitoring Scope
- Monitor all websites and web applications
- Monitor only specific domains (e.g., `localhost:8009`)
- Monitor only specific ports
- Combine scope rules as needed

---

## Data Security

Error Watcher's security depends on **your browser's built-in security**:

- All data is stored in Chrome's secure local storage
- We do not apply additional encryption because data never leaves your device
- Your device security is your responsibility
- If someone gains access to your computer, they can access your error logs

---

## Children & COPPA Compliance

Error Watcher is not directed at children under 13 and does not knowingly collect information from children. If you believe a child under 13 is using this extension, please contact us immediately.

---

## Changes to This Privacy Policy

We may update this privacy policy as the extension evolves:

- Updates will be published with new extension versions
- You'll be notified through the browser's extension update mechanism
- Material changes will be clearly highlighted

---

## Contact & Support

**Have privacy questions or concerns?**

- 📧 Email: [hoangngocanh288@gmail.com](mailto:hoangngocanh288@gmail.com)
- 🐛 GitHub Issues: [Error Watcher Issues](https://github.com/hngocanh/ErrorWatcher/issues)

---

## Summary

**TL;DR:** Error Watcher stores all error data locally on your device. Nothing is sent to external servers, no data is collected for analytics, and you control what is monitored and when data is deleted. Privacy is built-in, not optional.
