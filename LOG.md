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
P2.1 - Introduced Zustand session store with queue loading, reveal state, and hard revisit tracking.
P2.2 - Implemented SM-2-lite scheduler helpers with Vitest coverage for interval progression and ease clamps.
P2.3 - Added review persistence utilities for get/put and due-by-deck queries on Dexie.
P2.4 - Daily queue builder filters suspended cards, prioritizes due reviews, and enqueues new cards within a configurable cap.
P2.5 - Wired the review UI to the session store, handling mode toggles, reveal flow, grading persistence, and manual controls.
P2.6 - Built a landing page with due counts, continue CTA, and last deck recall backed by localStorage/session store.
P2.7 - Added Dexie logging table and helpers to record graded sessions with duration metadata for future stats.
P2.8 - Organized audio assets into deck-specific folders with tooling to rewrite references.
P2.9 - Tailwind v4 migration adjustments and refreshed header navigation with options dropdown.
P2.10 - Added codexStatus script and header tinting for Codex progress signals.


P3.0 - Deck aggregation helpers and manager interface groundwork.
P3.1 - Landing deck manager shows metrics, quick actions, and browse entry.
P3.2 - Deck manager wiring for Open/Browse and live counts.
P3.3 - Added deck rename/delete with cascaded card, review, and log updates.
P3.4 - Card browser view with filters, audio controls, and suspend/hard actions.
P3.5 - Added minimal stats snapshot with streaks and 7-day due forecast.
