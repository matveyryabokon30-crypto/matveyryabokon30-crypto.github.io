# Chat timestamps and automatic updates
Release: 2026.09.22-chat-time.1

Message time is rendered in the device timezone. History uses server message timestamps; immediate confirmations use device receipt time until history synchronization. This is not a separate server delivery receipt timestamp. Pending/failed messages are labeled explicitly. Chronological position remains independent of display time.

Complete shell installation precedes service worker activation. Open clients check every 15 seconds and reload after a 3-second interaction pause when no text request, voice session, recording, unsent audio, modal, auth restore or history load is active. Before automatic reload, the current draft and rendered identified messages are retained in tab-local session storage, account-bound and expiring after 15 minutes; restoration never sends a message. Storage failure postpones reload. API responses are not cached.

Limitations: iOS may suspend a closed app; no guaranteed closed-app update latency. Legacy open pages do not contain the controllerchange handler and require their next normal load to adopt this updater. No forced navigation of legacy clients. No owner device smoke performed yet.

Verification: node syntax checks; executable timestamp/status and update-guard tests; complete/failed service-worker installation tests. No provider calls and no backend/auth/budget changes.

Owner's proposed architecture: one agent, User/Admin modes in the same app, owner-only switch, initial elevated identity verification with retained session; server-enforced rights and separate administrative context. This release does not implement the role switch or activate the previously disabled agent integration.
