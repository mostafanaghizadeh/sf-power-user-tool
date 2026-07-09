# Privacy Policy — SF Power User Tool

_Last updated: July 9, 2026_

## Summary

SF Power User Tool is a productivity extension for SAP SuccessFactors. **It does not collect, transmit, or sell any personal data.** All of your settings and commands stay on your own device.

## What the extension stores

The extension stores the following **locally on your device** using the browser's extension storage (`chrome.storage.local`):

- Your custom commands, quick links, and command groups.
- Feature on/off states (keep-alive, dark mode, quick launcher).
- Your preferences from the options page.

This data never leaves your browser. It is not sent to us or to any third party. We operate no servers and have no ability to see it.

## What the extension does NOT do

- It does **not** collect analytics or telemetry.
- It does **not** read, store, or transmit your SuccessFactors HR data, credentials, or session tokens.
- It does **not** use remote/hosted code. All code is packaged in the extension.
- It does **not** track your browsing outside SuccessFactors pages.

## Permissions and why they are needed

| Permission | Why |
| --- | --- |
| `storage` | Save your commands and settings locally. |
| `alarms` | Run the session keep-alive timer in the background so it survives page navigation. |
| `downloads` (optional) | Only requested if you use CSV/JSON export. You can decline it. |
| Host access (SuccessFactors domains only) | The content script runs solely on SuccessFactors sites to inject the toolbar and shortcuts. See the scoped host list in the manifest. |

The extension runs **only** on SuccessFactors domains (`*.successfactors.com`, `*.successfactors.eu`, `*.sapsf.com`, `*.sapsf.eu`, `*.sapsf.cn`, `*.hr.cloud.sap`, and `*.hr.sapcloud.cn`). It has no access to any other site.

## The keep-alive feature

The keep-alive feature periodically pings your active SuccessFactors tab to prevent idle session timeout. This is a same-origin interaction performed inside your already-authenticated tab. It sends no data anywhere external and stores nothing about your session.

## Data retention and deletion

Because all data is local, you are in full control. To delete everything, remove the extension or use the "Reset" option on the options page. Uninstalling the extension removes all stored data.

## Children's privacy

This is a workplace productivity tool and is not directed at children.

## Changes to this policy

If this policy changes, the updated version will ship with a new extension release and the "Last updated" date above will change.

## Contact

For questions about this policy, open an issue in the project repository.
