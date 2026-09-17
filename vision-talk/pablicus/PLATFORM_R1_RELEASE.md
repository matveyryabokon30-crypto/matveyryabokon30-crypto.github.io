# Pablicus Platform R1 — 2026-09-17

Production head at release preparation: `93c3cb2bf149889c727b9e2ccc07a78a88383641`.

Implemented now:
- automatic service-worker activation and network-first navigation; no manual update button is required for subsequent releases once R1 controls the installed PWA;
- canonical share/invite module using the system share sheet, ready for custom-domain cutover;
- social-preview metadata injection for controlled PWA navigations;
- web contacts foundation over the existing Pablicus people directory, with explicit invite action;
- enriched Web Push rendering for sender name, sender avatar URL when supplied, text preview and media-kind labels; task notifications preserved;
- WebRTC audio/video media-session foundation; signalling/TURN and background native calling are not falsely marked complete;
- enriched PWA manifest/share target.

Deferred by platform boundary or external setup:
- custom pablicus.com/.app/.ru domains: registrar purchase/DNS planned in Work;
- native iOS address-book sync and background CallKit/PushKit: native app phase;
- contact-joined automatic discovery requires backend phone/contact identity schema and consent flow;
- rich push fields require the server push producer to send sender_name/sender_avatar_url/content_kind/preview; worker has backward-compatible fallback.

Safety: no auth, vault/outbox, story runtime, backend permissions or message persistence code changed in this release.