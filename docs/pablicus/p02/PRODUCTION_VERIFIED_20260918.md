# Pablicus P02 — production verification

Date: 2026-09-18.
Status: PUBLISHED / PRODUCTION SHELL VERIFIED / OWNER MEDIA SMOKE PENDING.

## Version mapping

- Tested P02 runtime commit: `8645e98417fa28c5be65bf2d2e414ef3f8201f97`.
- Observed production repository main: `48254f491f6375c4bfc8a964e62f480e53ec7c46`.
- Main is one commit ahead of the runtime commit, with changes exclusively under `sekkes-v2/`. Pablicus runtime bytes were not changed by that commit.
- Production verification workflow commit: `37ef7e03dc25a51a25519d2ef37d2b69f988076e`.
- The public verification script records GITHUB_SHA of the verification workflow. This identifies the verification run, not a different runtime release.
- Active browser release: `P02`; active service worker: `pablicus-shell-p02-20260918`.
- Preview Edge Function: `pablicus-media-preview`, deployed version 3, JWT verification enabled. No maintenance entry route.

## Completed checks

Regression run: https://github.com/matveyryabokon30-crypto/matveyryabokon30-crypto.github.io/actions/runs/35281615119

The nine JSON check suites total 114 passed checks and zero failed checks. The separate WASM raster test also passed. Browser coverage includes Chromium and WebKit. Media/ACL integration uses isolated fixtures, not real user credentials or real user photos.

Production verification run: https://github.com/matveyryabokon30-crypto/matveyryabokon30-crypto.github.io/actions/runs/35315530263

Ten public deployment checks passed, zero failed:

- All 118 release assets served by Pages match the tested hashes.
- Canonical non-versioned HTML and service worker serve the current release.
- Chromium and WebKit start the actual public application as P02 and install the P02 service worker.
- Native fetch remains unpatched and the explicit image cache is loaded.
- No manual update prompt is shown on public boot.
- No uncaught JavaScript exceptions occur during public boot.

Hosted Edge checks also passed: CORS preflight HTTP 204 with the expected production origin and headers; unauthenticated POST HTTP 401.

Production evidence artifact ID: `10535810160`, name `p02-public-verification`, SHA-256 `40b67c8c86115f10d52e02f71d38716b11eedc5657c47ceb817ad1c5e56e9dae`.

## Implemented scope

Protected smaller image derivatives for chats, profiles and stories; grouped authorization requests; local image reads in parallel with authorization; priority and a reserved download slot for an opened story. Original files are not overwritten. Existing persistent image caching remains enabled.

New upload paths attempt derivative preparation after the original upload. Existing eligible images without prepared derivatives are prepared on first authorized demand, not by a completed bulk backfill. Unsupported or oversized sources and optimization-service failures fall back to the original authorized Storage path.

## Limits and owner check

The deployed application's public shell and file integrity have been verified. These checks do not establish authenticated media latency on the owner's iPhone. Synthetic source-size reduction is not a measured real-device speedup. Bulk preparation of all historical private media was not performed.

Check in the existing installed app: first opening of a photo chat, scrolling back through already seen images, first opening of a photo story, and reopening the app without clearing its data. The logged-in settings version line is generated as `Pablicus P02`.

Do not delete the app, clear stored data, or upload existing photos again for this check. Owner acceptance remains pending actual feedback.
