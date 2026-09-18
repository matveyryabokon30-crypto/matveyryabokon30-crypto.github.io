# Pablicus P03 — homepage startup optimization

Date: 2026-09-18.
Status: PUBLISHED / PRODUCTION SHELL VERIFIED / OWNER HOME SMOKE PENDING.

## Release and evidence

Runtime commit: `400519b4ab66e98dfaf8fa5623e8d205c52d5dfb`.
Base: `48254f491f6375c4bfc8a964e62f480e53ec7c46` (owner-confirmed P02 plus isolated Sekkes changes).
Active application version: `P03`.
Service worker: `pablicus-shell-p03-20260918`.

Regression workflow `35325157635`: all steps succeeded. Eight JSON suites total 90 passed checks and zero failures, across Chromium and WebKit. The suite includes the real complete application and SDK with synthetic users, media and controlled API latency, plus existing media persistence/isolation and safe-update tests.

GitHub Pages build/deployment `35325817178`: completed successfully for the runtime commit.
Production verification `35325817385`: completed successfully. Ten checks passed, zero failed. All 119 shell asset hashes match the tested runtime. Both browser engines start the actual public P03 application, install the P03 service worker, retain native fetch, hide the old manual-update prompt and report no uncaught JavaScript exception on unauthenticated boot.

Production verification artifact: `10538384941`, SHA-256 `f3387692cc4733409d4a083262d387fc306f1361c6c9a7761e3ccb9e421d65e1`.

## Changes

1. Startup profile approval and authorized conversation/preferences fetching no longer form a fully sequential network chain. The existing approval requirement still gates displaying home data.
2. Home contact metadata and story-feed requests share one bounded, session-scoped source. An additive SECURITY INVOKER RPC composes existing contact-card and story-feed functions, without changing their privacy policies. Failed optimization uses the original authorized RPCs.
3. Only one loader owns homepage avatars. The competing legacy avatar downloader no longer bypasses the existing P02 persistent image cache.
4. Story metadata is made available before avatar-image fetching completes, instead of waiting for every avatar request.
5. Unchanged conversation rows retain their DOM nodes and images. Changed rows are updated individually; gesture registrations for removed rows are pruned.
6. Homepage fallback refresh is no longer requested every 1.3 seconds. Realtime message inserts schedule a prompt home refresh; explicit return-online/foreground refreshes remain. Open-conversation synchronization and outbox polling are unchanged.
7. External scripts use deferred execution in the original dependency order; the Supabase origin is preconnected.

P02 `media-cache.js` and `media-preview-client.js` are byte-identical to the baseline. No user messages, photos, originals or authentication data were deleted. Shared-element story geometry was not replaced. No changes were made under `sekkes-v2/`.

## Before/after controlled measurements

Fixture: four conversations, five profile/story avatars, 180 ms delay per backend response, synthetic account in the actual app. These are CI measurements, NOT timings from the owner's physical iPhone or a production-user session.

| Measurement | P02 WebKit | P03 WebKit |
|---|---:|---:|
| Chat rows visible | 1030 ms | 553 ms |
| Story header metadata available | 3455 ms | 1121 ms |
| Home chat and story avatars ready | 3460 ms | 1400 ms |
| Home avatars ready after document reload | 1321 ms | 773 ms |
| Startup backend requests | 32 | 13 |
| Cold avatar image downloads | 9 | 5 |
| Avatar image downloads after reload | 4 | 0 |

Chromium also improved: chat rows 758 -> 397 ms, home avatars 1969 -> 1199 ms, warm home 1297 -> 767 ms, startup requests 31 -> 13, warm avatar image downloads 4 -> 0.

The regression confirms unchanged row/avatar identity, update of one row without rebuilding its neighbours, the same story DOM elements throughout morphing, and persistent avatar reuse after reopening.

## Database boundary

Applied migration: `pablicus_p03_home_cards_read_batch`; source is saved alongside this report.
Catalog verification: new home batch, original contact card and story feed all have SECURITY INVOKER, STABLE, empty search_path, anonymous EXECUTE denied and authenticated EXECUTE allowed.
A direct unauthenticated invocation was tested and rejected with `HOME_NOT_ALLOWED`.
Positive authenticated data tests used isolated fixtures. No real user's session was impersonated.

## Remaining limits / owner verification

This release targets the home screen and startup request chain, not removal of authorization checks or all possible latency from media. Cached private media still requires the appropriate valid authorization. Real-network latency and iOS cold-start work can still be visible; no zero-delay guarantee is made.

Open the existing installed app and check that settings show `Pablicus P03`. Compare the initial chat list and story-header appearance, then close and reopen normally without signing out or clearing data. Existing photographs are sufficient; no re-upload is required. Owner acceptance remains pending this feedback.
