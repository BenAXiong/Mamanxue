2025-11-05
P1.1 - Added deck asset JSON and audio folder scaffold.
P1.2 - Created Dexie database shell with cards and review tables.
P1.3 - Deck importer seeds public decks into Dexie.
P1.4 - Minimal review screen loads first card and displays text/audio with checks.
P1.5.1 - Added optional slow audio support across cards, import seeding, review UI, and file checks.
P1.5.2 - Introduced CSV import screen with drag/drop, file picker, parsing, and column mapping preview.
P1.5.3 - Validated mapped rows, upserted cards via Dexie transaction, and surfaced import reports with missing audio checks.
P1.5.4 - Enabled Google Sheets "publish to the web" CSV fetch with user guidance for CORS requirements.
P1.5.5 - Converted Google Drive share links to direct downloads with fallback instructions when blocked.
P1.5.6 - Added manual single-card form for quick upserts with auto-ID helper and optional fields.
P1.5.7 - Implemented deck and progress JSON export using Blob downloads filtered by deck ID.
P1.5.8 - Persisted column mapping presets in localStorage to auto-apply for matching CSV headers.
P1.6 - Locked phone-first app shell with reusable buttons, sticky grade bar, and scroll-aware footer.
P1.7 - Added deck bootstrap, Excel conversion script, deck manifest, and in-app deck management with reset control.
