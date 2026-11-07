# Fieldnote

A local TypeScript/React job-search workspace. Resume parsing, match scoring, cover-letter drafts, and application tracking run in your browser. **Find jobs** requests public listings from supported official employer feeds. The optional extension can extract listings only from a public site you explicitly approve and are authorized to access; it does not scan LinkedIn or Indeed.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Run tests with `npm test` and create a production build with `npm run build`. Typically http://127.0.0.1:5173/

## Find jobs and import alerts

The **Find jobs** view retrieves current public listings from official Greenhouse feeds for Stripe, GitLab, Elastic, Datadog, Cloudflare, and MongoDB; Ashby feeds for Render, Linear, Ramp, OpenAI, and Notion; and public job-board APIs/feeds from Remote OK, Remotive, Arbeitnow, Jobicy, and We Work Remotely. These are direct feed requests from your browser; no login or API key is used. Your resume and profile are not sent. Filter loaded results locally by keywords, employer/source, location, work arrangement, engineering-role scope, and an adjustable USD annual salary range. Location defaults to remote (excluding known international locations) or Louisiana; the salary minimum defaults to $140,000. Salary ranges must overlap your selected range, and undisclosed salary listings can be included or hidden. Listings without salary details are shown separately when included.

The employer directory is split by provider: `jobBoardDirectory.json` contains 10,873 searchable Greenhouse, Ashby, Lever, Personio, Recruitee, Rippling, and Workable boards; `workdayJobBoardDirectory.json` contains 1,371 Workday boards. In **Find jobs**, switch between the searchable-board and Workday tabs. Search Workday companies and open their job-posting boards directly; Workday blocks direct browser requests, so it is not part of fetchable searches. The 15 highest-listed-role boards from searchable providers are preselected by default (one board per employer); use the searchable, scrollable employer dropdown to swap selections or select all matching directory entries. Selecting entries makes no network requests. Start **Fetch next batch** to query at most 100 selected boards at a time (four concurrent requests); each batch is an explicit user action, with a 10-second pause before the next batch. It does not automatically continue through the directory. Listed role counts are estimates and can be stale. Other selected boards are requested directly from their public endpoints and may still fail if a provider or individual board changes its access policy. Listings without descriptions can be saved as references, but you may need to add the description yourself before drafting a cover letter.

Feed references: [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html) and [Ashby Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api).

Remote OK, Remotive, and Jobicy require attribution and a link back to the original listing/source; the app displays a source link and preserves the listing's application URL. Remotive listings may be delayed. Confirm current provider terms before using feed results outside your own local job-search workflow.

Atlassian, CrowdStrike, Confluent, Automattic, Red Hat, HubSpot, NVIDIA, and BOK Financial are currently provided as official careers-site links only. Their pages are not included in the built-in company-feed search. If you own or are authorized to extract from one of those public sites, you can separately approve its exact origin in the browser extension.

Other sources in the supplied list are not one-size-fits-all feeds: Himalayas and Working Nomads do not currently expose CORS headers for direct app requests; The Muse returned HTTP 403 during verification; USAJOBS requires registered API credentials; Hacker News' `whoishiring` URL is a user-submission page rather than a structured job feed. Greenhouse and Ashby are already integrated above. Lever, Workable, SmartRecruiters, Recruitee, Personio, Breezy, Teamtailor, and Workday URLs require a specific employer/tenant identifier (and some require credentials or approved API access); the `{company}`/`{tenant}` placeholders must be replaced before a board can be connected.

Choose **Import alert text** and paste one listing from an alert email or message. The app suggests a title, company, and URL from the text; review or edit the fields before saving. The alert text and link are processed locally. The app does not sign in to email or job boards, fetch links, or discover listings automatically.

## Optional Chrome/Edge extension

The Manifest V3 extension in `extension/` has two user-invoked features.

### Extract listings from a site you own or are authorized to access

1. In Chrome or Edge, open the extensions page (`chrome://extensions` or `edge://extensions`), enable **Developer mode**, and choose **Load unpacked**.
2. Select this project's `extension` folder.
3. In the extension popup, enter the public HTTPS page and confirm that you own or are authorized to extract its public job listings. The browser asks to grant permission for that site origin only.
4. Choose **Scan same-site job pages**. The extractor reads Schema.org `JobPosting` data where available and basic title/main-page text as a fallback. It captures title, company, location, salary, description, posting date/type, and the listing/application URL.
5. Review the found jobs, select the ones you want, then export the selected JSON.
6. In Fieldnote, open **Applications** and choose **Import selected jobs JSON**. Review the job details and use the official link when you are ready to apply.

The extractor only fetches public HTTPS pages on the approved origin, follows job-related links on that same origin, checks and respects `robots.txt`, scans at most 30 pages to depth 2 with a delay between requests, and stops on access-denied or CAPTCHA-like challenges. It does not log in, bypass controls, or scan LinkedIn or Indeed. You can remove a site's permission in the extension.

### Optional form autofill

You can also import your profile JSON into the extension. When explicitly invoked on LinkedIn or Indeed, it fills supported blank name, email, phone, and location fields. It does not overwrite existing values, answer screening questions, upload files, click Submit, or automate login. Review and submit each application yourself.

The extension requests storage and optional per-origin site access, not persistent access to every website. Imported profile data and approved origins are stored in local extension storage. The profile JSON contains personal information, so keep it private and delete the imported profile when you no longer need it.

## Privacy and data

- DOCX resume text is extracted in the browser; the resume file is not saved or uploaded.
- The editable profile, pasted alert/job descriptions, links, notes, statuses, and drafts are stored in IndexedDB in this browser.
- Job links are references only and are opened only when you choose to click them.
- Use the profile page to delete all app data. Individual opportunities can be removed from their detail view.
- CSV export contains job and application tracking fields.
- The app has no user accounts, telemetry, backend, cloud sync, or external AI calls. Searching does make direct requests to the selected public employer job feeds; it does not transmit your resume/profile.
- The extension reads approved public pages locally in your browser and exports selected job details as a JSON file for the app to import.
