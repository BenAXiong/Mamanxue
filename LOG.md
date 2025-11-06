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

2025-11-06
P4.0 - Promoted a dedicated Stats header link and page, moving the "Today at a glance" and forecast modules out of Decks.
P4.1 - Reworked the deck list header with inline continue CTA and aggregated review/fail/new counters aligned to parent decks.
P4.2 - Streamlined deck rows with centered card totals, touch long-press / desktop hover actions, and menu icon replacement.
P4.3 - Applied desktop polish by constraining the main content width and centering the layout without affecting mobile.
P5.1 - Added installable manifest with themed icons and linked theme-color metadata for platform support.
P5.2 - Integrated Workbox build pipeline with post-build precaching script and generated service worker.
P5.3 - Implemented runtime MP3 caching with range request support and 30-day cache policy.
P5.4 - Added stale-while-revalidate caching for deck JSON and ensured build metadata fetch bypasses cache.
P5.5 - Built update banner, manual SW update controls, and surfaced build info across header/settings/footer.
P5.6 - Delivered offline data reset workflow clearing caches, Dexie, and storage with user confirmation.
P5.7 - Surfaced offline status badge and disabled network-bound import flows with contextual messaging.
P5.8 - Enhanced mobile ergonomics with 48px buttons, grade bar polish, haptics, and system-aware theme toggle.
P5.9 - Strengthened accessibility with grade labels, aria improvements, and theme-aware contrast adjustments.
P5.10 - Introduced global toast system plus grade submission guardrails to prevent double submissions.
P5.11 - Aligned build tooling for Vercel (Node 20, dist/sw output) and automated build metadata updates.
P5.12 - Verified production build, precache manifest generation, and updated project log for Phase 5 completion.
