# Integration hand-off

## Frontend
- Project: workspace root (`./`)
- Dev: `npm run dev`
- Build: `npm run build`
- Data seam: `src/storage.ts` directly persists the live UI state to browser IndexedDB; no mock client or mock datasets are present.
- Persistence: IndexedDB database `fieldnote-local`, object store `workspace`, record key `primary`.
- Local processing: DOCX extraction (`src/App.tsx`), match scoring (`src/matching.ts`), letter drafting (`src/drafting.ts`), CSV (`src/export.ts`).
- Types: `src/types.ts`.

## Backend and API
- Backend: none by design (local-only browser app).
- Run/build/health endpoint: not applicable.
- API routes: none; job URLs are stored as references and are never fetched by the app.

## Database and migrations
- Database: browser IndexedDB only.
- Migration tool/directory: none; no server database or schema migration is required.
- Environment variables: none.
- Seed data: explicitly none.

## Services
- Essential: browser UI, browser IndexedDB, local DOCX parser.
- Enhancement: none.
- No external AI/API, cloud storage, telemetry, scraping, site automation, or application submission.
