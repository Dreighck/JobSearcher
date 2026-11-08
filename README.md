# Fieldnote

A local TypeScript/React job-search workspace. Resume parsing, match scoring, cover-letter drafts, and application tracking run in your browser. **Find jobs** requests public listings from supported official employer feeds. The optional extension can extract listings only from a public site you explicitly approve and are authorized to access; it does not scan LinkedIn or Indeed.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Run tests with `npm test` and create a production build with `npm run build`. Typically http://127.0.0.1:5173/

## Find jobs and import alerts

Find jobs searches public job feeds and selected companies in `jobBoardDirectory.json` (10,610 searchable boards). The 263 entries for 250 companies reported as HTTP 404 have been moved to `failedJobBoards.json` and are not included in searches. Workday entries are kept separately in `workdayJobBoardDirectory.json` (1,371 boards) and are browse-only because Workday blocks direct browser requests.

Select employers from the searchable directory, then fetch up to 1,000 selected boards per manual batch, with four requests at a time and a two-second pause between batches. Results appear as board requests complete and are filtered locally by the search settings. Public multi-board feeds include Remote OK, Remotive, Arbeitnow, Jobicy, and We Work Remotely. The app does not send your resume or profile to job feeds; you review and submit applications yourself.

Searchable and Workday directories are supplied as JSON files in the project. The failed-board file is retained as a separate record of excluded entries; it is not loaded by the app.

### Optional form autofill

You can also import your profile JSON into the extension. When explicitly invoked on LinkedIn or Indeed, it fills supported blank name, email, phone, and location fields. It does not overwrite existing values, answer screening questions, upload files, click Submit, or automate login. Review and submit each application yourself.

The extension requests storage and optional per-origin site access, not persistent access to every website. Imported profile data and approved origins are stored in local extension storage. The profile JSON contains personal information, so keep it private and delete the imported profile when you no longer need it.

## Privacy and data

- DOCX resume text is extracted in the browser; the resume file is not saved or uploaded.
- The editable profile, saved applications, pasted alert/job descriptions, links, notes, statuses, drafts, and customized search defaults are stored in IndexedDB in this browser. They are not written into the project files, so another person using the project has their own local data in their browser.
- Job links are references only and are opened only when you choose to click them.
- Use the profile page to delete all app data. Individual opportunities can be removed from their detail view.
- CSV export contains job and application tracking fields.
- The app has no user accounts, telemetry, backend, cloud sync, or external AI calls. Searching does make direct requests to the selected public employer job feeds; it does not transmit your resume/profile.
- The extension reads approved public pages locally in your browser and exports selected job details as a JSON file for the app to import.
