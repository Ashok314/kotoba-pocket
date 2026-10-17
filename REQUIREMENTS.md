# Kotoba Pocket — First Release Requirements

## Goal
A simple, working Chrome extension for quickly saving unfamiliar words or phrases encountered while browsing and reviewing them later. The product is intended for a future public Chrome Web Store release.

## Capture
- Save selected words or phrases through a keyboard shortcut, right-click action, or a visible save button in the popup.
- Allow the user to configure the shortcut and show the actual assigned keys.
- Save the selected text, source page title, source URL, and date/time saved.
- Reject a word or phrase already saved, regardless of source URL. Compare trimmed text exactly (case-sensitive); keep the original record and show a localized already-saved message.
- Support Japanese text without changing its characters.
- Show a short visual confirmation only after successful storage. With no selection, save nothing and show a helpful message. Display actual save errors.
- Support ordinary web pages where Chrome permits extension access. Explain restricted-page limitations clearly.

## Interface and Branding
- Support Japanese and English, with browser-language defaults and a persistent language selector.
- Keep all interface messages, errors and CSV headings in separate locale JSON files.
- Keep colors in theme.json and generate UI tokens, logo and icon assets from that source.

## Local Vocabulary List
- Use chrome.storage.local, not a host page's localStorage.
- Keep vocabulary on the current device and retain it across browser restarts.
- Open the newest-first vocabulary list from the extension icon.
- Let the user reopen source pages and delete individual entries.
- Include clear empty-list guidance.
- Keep v1 usable without an account, backend, or cloud service.

## CSV Export
- Provide an Export all button that downloads the complete vocabulary list as CSV.
- Include saved text, page title, source URL, and saved date/time.
- Preserve Japanese text, quotation marks, commas and line breaks correctly.
- Handle spreadsheet formula-like text safely.
- Exporting does not modify or remove local entries.
- CSV export is in scope. JSON export and import are outside the first version.

## Release Preparation
- Use Manifest V3 with all executable code packaged locally.
- Request only permissions required by implemented features; do not request future Google integration permissions.
- Use the released Lazy Diff project at /Users/ashok314/dev/lazydiff as a read-only reference for extension conventions.
- Provide meaningful automated tests, package validation, unpacked installation instructions and a store-upload ZIP.
- Prepare truthful privacy-policy text, store listing notes and permission justifications. Do not claim store approval or publish without a separate submission step.
- Keep page text safe when displayed; do not interpret saved vocabulary as HTML or code.

## Documentation and Project
- Keep this extension in a new project, independent of election-np and Lazy Diff.
- Maintain requirements in English. Communicate with the user in Japanese.
- Google Drive / Sheets is a future backlog feature only. Do not connect to Google or create any Drive files now.
- Store publication is handled by the user. The project provides a locally loadable extension and an uploadable ZIP.

## Official References
- https://developer.chrome.com/docs/webstore/program-policies/permissions
- https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developer.chrome.com/docs/extensions/reference/api/commands
- https://developer.chrome.com/docs/extensions/reference/api/storage
