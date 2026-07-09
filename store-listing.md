# Store Listing Copy

Ready-to-paste text for the Chrome Web Store and Edge Add-ons submissions.

## Name

SF Power User Tool

## Short description (≤132 chars)

Keyboard shortcuts, quick links, and a session keep-alive for SAP SuccessFactors. Faster navigation, fewer timeouts.

## Detailed description

SF Power User Tool makes SAP SuccessFactors faster to navigate for admins and power users.

Features:
- Keyboard shortcuts for common SF actions — proxy, become self, search, open menu, home, admin, and more.
- A searchable command dialog (Alt+Shift+P) so you never hunt through menus.
- A floating quick-links launcher for one-click access to the pages you use most.
- Session keep-alive that prevents idle timeouts and survives SuccessFactors' single-page navigation.
- Command groups with drag-and-drop ordering and bulk moves.
- Search-bar shortcuts: type "/o" or "/n" plus a target right in the SF search field.
- Dark mode toggle (Alt+Shift+D).
- Import/export your commands as CSV, and back up all settings as JSON.

Privacy first:
- All your data stays on your device. Nothing is collected, transmitted, or sold.
- No remote code. No tracking. Runs only on SuccessFactors domains.

This is an independent tool and is not affiliated with or endorsed by SAP. "SAP" and "SuccessFactors" are trademarks of SAP SE.

## Category

Productivity

## Single purpose (Chrome)

The extension has one purpose: to provide productivity enhancements (shortcuts, quick links, and a session keep-alive) for users of SAP SuccessFactors, injected only on SuccessFactors domains.

## Permission justifications

Paste these into the Chrome "Privacy practices" tab and the Edge equivalents.

- **storage** — Stores the user's custom commands, quick links, groups, and preferences locally on the device. No external transmission.
- **alarms** — Runs the optional session keep-alive on a timer in the background service worker so it survives page navigation and worker suspension.
- **downloads (optional)** — Requested only if the user exports their commands/settings to a CSV or JSON file. The user may decline it and still use every other feature.
- **Host access (SuccessFactors domains)** — The content script must run on SuccessFactors pages to inject the toolbar, dialog, and shortcuts. Access is limited to `*.successfactors.com`, `*.successfactors.eu`, `*.sapsf.com`, `*.sapsf.eu`, `*.sapsf.cn`, `*.hr.cloud.sap`, and `*.hr.sapcloud.cn` (the SAP SuccessFactors data-center domains per SAP note 2089448). No access to any other site.

## Data usage declarations (Chrome)

- Does this item collect user data? **No.**
- Sold to third parties? **No.**
- Used for purposes unrelated to core functionality? **No.**
- Used to determine creditworthiness / for lending? **No.**

## Privacy policy URL

Host the contents of `PRIVACY.md` at a public URL and paste it here.

## Screenshots to capture (1280×800)

1. The command dialog open over a SuccessFactors page.
2. The quick-links launcher expanded.
3. The options page showing the command summary and backup controls.
4. The toolbar popup with feature toggles.
