# Pablicus P04 — first-frame release

Date: 2026-09-18.
Status: PUBLISHED / PUBLIC RELEASE VERIFIED / OWNER IPHONE CHECK PENDING.

Runtime commit: `48a2bc424bbc1fa0e5d630e970d2cb5611c877e3`.
Baseline: `400519b4ab66e98dfaf8fa5623e8d205c52d5dfb` (P03).
Production main was advanced without force to the exact tested runtime commit.
Active release: `P04`. Active worker: `pablicus-shell-p04-20260918`.

## Implemented

First-screen avatar loading starts alongside the existing approved-session bootstrap. The first eight contact images are prepared and decoded before revealing the assembled home view; original DOM story elements are retained during collapse/expand. Known photo avatars are not first rendered as title initials. Real no-photo/group fallbacks remain.

Repeated startup reuses version-matching 192px local avatar bytes using fresh source metadata from the same home request. The metadata query executes with SECURITY INVOKER under existing Storage RLS and derives paths only from authorized cards/the current owner profile. The response proof lasts at most 30 seconds from request start and is never persisted across sessions. Missing, mismatched or expired proof falls back to normal media authorization. Source policies, original photos, push handlers and private media ownership were not weakened.

Home preparation is bounded rather than waiting indefinitely for an unavailable network. A first launch with no saved media still needs network transfer. The first screen is assembled offscreen; a cold text-only partial screen can appear later than P03, while the complete screen and especially repeated startup are measured separately.

## Verification

Regression workflow run `35330385544` passed: 100 browser checks across Chromium and WebKit, zero failures. Actual application modules and SDK are exercised with four synthetic conversations and 180ms per API/image response. No real account credentials or private user photos are injected into tests.

First-visible-frame tests passed in both engines: four of four chat avatar photos and five of five story avatar photos are already present, with zero transient initials, on cold and warm home opening. Reopened home downloads zero avatar images. The same-node story collapse/expand and existing chat media/cache/update regression also passed.

Warm complete-home measurements in this equal-latency fixture:

- Chromium: P03 806ms; P04 414ms.
- WebKit: P03 803ms; P04 440ms.
- Warm photo network downloads: zero in both versions; the improvement removes redundant image-authorization waits and intermediate painting.

Local Node VM tests additionally passed 9/9 for the actual home-data/media-cache modules, using isolated IndexedDB/Auth adapters: matching proof, missing proof, version mismatch, unknown version, wrong account, proof expiry, wrong bucket/variant, and expired disk content. This is a unit test, not an iPhone benchmark.

Public verification run `35331056556` passed 10/10 checks, zero failures. It verified all 119 published asset hashes, the canonical unversioned HTML/SW, and actual public boot in Chromium and WebKit as P04 with no manual update notice or uncaught JavaScript exceptions.

Public evidence artifact: `10540958382`, SHA-256 `ced6342fc936080b54cf95a0104a59120d8b4894a979324891ae71a3dd33639d`.
The public workflow commit `7890dc3bf797748d51f9cb838caeae5bfe193f34` identifies the verification workflow, not a different app runtime.

## Owner check

Open the existing installed Pablicus, verify Settings shows Pablicus P04, then close/reopen from the same icon and check the first home screen. Do not clear data, log out, reinstall, or reupload photos. Timings above are fixture comparisons, not measured timings on the owner's physical iPhone. Device acceptance remains pending.
