# Future Features

## Google Drive / Google Sheets
- Later: allow vocabulary to be exported or synchronized to a spreadsheet chosen by each user.
- Decide the manual export or synchronization workflow and duplicate handling before implementation.
- Add Google account connection and permissions only when this feature is implemented.
- Keep local saving and CSV export working independently.
- No Google sign-in, connector call, Drive document creation or cloud integration is required for the first release.

## Sentence context and multiple sources per word
- Save the sentence containing the selected word alongside the word.
- Keep one vocabulary record per word and attach source-site entries when the word is saved from another site.
- Keep source URL, page title, sentence context and save time per source; avoid repeated identical source entries.

## Storage usage and backups
- Monitor local storage usage and warn before storage becomes full.
- Show current usage and offer CSV export with a reminder to download a backup.
- Never automatically delete vocabulary or initiate exports without a user action.

## Sensitive fields and form pages
- Preserve the existing exclusion of password fields.
- Review all saving paths, including context-menu saving, to prevent saving password selections and other sensitive form values.
- Define exclusions for sensitive input types and autocomplete fields (passwords, payment details, one-time codes), including editable elements and embedded frames.
- Warn or request confirmation before saving from other form fields; explain that private information may be included.
- Add tests for each entry point and avoid saving entire form contents or logging sensitive values.
