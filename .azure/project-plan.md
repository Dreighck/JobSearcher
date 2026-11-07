# Local Job Application Assistant

**Status:** Approved - revised scope
**Created:** 2026-11-06
**Deployment model:** Local-only browser app

## Project summary

Build a local browser application that helps Drake Menard find selected employers' public job listings and prepare application materials. The user can search supported official feeds, paste one job-alert listing at a time, review matching results and editable cover-letter drafts, and use an explicitly invoked local browser extension to fill supported profile fields on LinkedIn or Indeed application pages. The user reviews and submits applications themselves.

The extension may extract job listings only from a public HTTPS site origin the user explicitly confirms they own or are authorized to access. It must check and respect robots.txt, stay on the approved origin, use strict crawl limits and delays, and stop on access challenges. It must not access LinkedIn or Indeed for extraction, automate login, answer screening questions, upload files, submit applications, or bypass CAPTCHA, anti-bot controls, or platform restrictions.

## Requirements

- **Application:** One local web frontend; no backend, account, telemetry, cloud sync, or external AI service. It may make direct requests to listed public job feeds when the user chooses to search.
- **Resume:** Import the existing `Drake-Menard.docx` locally. Let the user review and correct extracted profile information.
- **Job discovery:** On user action, request listings from public employer feeds that permit unauthenticated access, including Greenhouse, Ashby, Lever, Personio, Recruitee, Rippling, and Workable APIs/feeds. Include the local company board directory as a searchable, scrollable dropdown; preselect the top 15 fetchable boards by listed open roles (one per employer), and let users replace selections. Fetch no more than 15 selected boards per search. Keep Workday directory entries as official-board links because direct browser requests are blocked by CORS. Also provide public remote-board feeds from Remote OK, Remotive, Arbeitnow, Jobicy, and We Work Remotely. The optional authorized-site extension may separately extract from explicitly approved domains.
- **Job input:** Paste job-alert email/text one listing at a time. Store manually entered URLs as references; do not fetch or scrape them.
- **Matching:** Default to software engineering, backend, full-stack, platform, and infrastructure roles; prefer remote or Lafayette, Louisiana. Let the user adjust keyword, employer, location, work arrangement, role-scope, salary minimum/maximum, and whether to include undisclosed salaries. Filter loaded listings locally, keep salary-unverified roles separate, and compare disclosed USD ranges to the selected annual salary range.
- **Drafting:** Create editable cover-letter drafts locally from the resume profile and pasted job description, using templates/rules rather than external AI calls.
- **Tracking:** Let the user record application status, notes, and follow-up dates. The user reviews and submits applications manually.
- **Privacy:** Keep resume-derived profile data, job records, and drafts on the user's device in browser storage. Searches contact only supported public job feeds; extension scans contact only a user-approved origin. Never send resume/profile data to either. Provide per-record deletion and clear-all controls.
- **Data portability:** Support exporting application/job data to CSV.
- **Application assistance:** Provide a Chrome/Edge (Chromium) extension with no broad host permissions. It runs only after the user invokes it on an active LinkedIn or Indeed tab, fills supported blank name, email, phone, and location fields, and never overwrites populated fields. The user reviews and submits.
- **Authorized-site extraction:** The extension requests permission for an exact HTTPS origin only after the user explicitly confirms ownership/authorization. Scan same-origin job-related links, respect robots.txt, use a 30-page/depth-2 limit and delay, stop on access challenges, extract structured JobPosting fields with a page-text fallback, and let the user select jobs for JSON export.
- **Import:** The local app accepts selected extracted-job JSON, validates URLs and required fields, deduplicates entries, and stores them locally.
- **Profile transfer:** Allow the local app to export a profile JSON for the user to import into the extension. Keep extension profile data in local extension storage.

## User flow

1. Open the app locally and import the resume.
2. Review and correct the extracted profile.
3. Search supported official employer feeds, scan a user-authorized public company careers site, or paste one listing from a job-alert email/text.
4. Review the match score and its explanation.
5. Generate and edit a cover-letter draft.
6. Open the job link. If applying on LinkedIn or Indeed, explicitly invoke the extension to fill supported blank profile fields.
7. Review all values and complete any remaining questions or uploads yourself.
8. Submit the application yourself and record its status, notes, and follow-up date in the tracker.

## Architecture

- **Frontend:** TypeScript and React, running as a local browser application.
- **Persistence:** IndexedDB for the resume-derived profile, manually entered job records, drafts, and tracking status.
- **Processing:** Client-side resume parsing, matching, and draft generation. No server requests are made for personal or job data.
- **Job feeds:** Direct browser requests to the public Greenhouse, Ashby, JSON, and RSS job feeds listed above; no application credentials for integrated sources. Filter responses locally, and request a Greenhouse job description only when the user asks to load a selected listing's details.
- **Extension:** Manifest V3 extension with `storage` and optional exact-origin HTTPS permissions requested on user action; no persistent broad host permission. Site extraction is separate from application autofill.
- **UI:** Responsive dashboard for resume/profile, job entry, match details, editable draft, and application tracking. Make manual review and submission clear in the job detail flow.
- **Data model:** Job title, company (if provided), URL, pasted description, match factors, draft, status, timestamps, notes, and follow-up date.

## MVP acceptance criteria

- Import and locally parse the supplied DOCX resume, with editable extracted profile details.
- Search supported employer and remote-job-board feeds; extract from explicitly approved public company sites; import selected extraction JSON or one job-alert listing at a time; add, edit, and remove job records.
- Allow users to filter loaded jobs by keywords, company/source, location, work arrangement, role category, and adjustable annual salary range; include or hide undisclosed salaries.
- Create and edit a cover-letter draft from the local profile and pasted job description.
- Track user-selected application statuses, notes, and follow-up dates.
- Export application/job records to CSV.
- Persist data across reloads and provide deletion controls.
- Verify local profile/job features without a network connection after the app is available locally; explain that public feed searches require network access.
- Keep site extraction limited to explicitly approved public sites, and application review and submission under the user's control.

## Out of scope

- Extracting LinkedIn or Indeed pages, sites without user authorization, or pages disallowed by robots.txt.
- Automated login, screening-question answers, file uploads, or application submission.
- CAPTCHA handling or circumvention of anti-bot controls.
- Cloud storage, external AI services, accounts, or sync.

## Validation

Test resume import and correction, pasted alert import and field suggestions, authorized-site permission requests, origin restrictions, robots.txt enforcement, crawl limits, challenge stop behavior, structured and fallback job extraction, JSON selection/export/import, deduplication, job creation/editing/removal, matching against the stated preferences, draft generation/editing, tracking and CSV export, local persistence, deletion, extension profile import, blank supported-field filling on LinkedIn/Indeed, and confirmation that populated fields, screening questions, uploads, and submit actions remain untouched.
