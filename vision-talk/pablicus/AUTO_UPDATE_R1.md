# Automatic update contract R1

- New service workers call `skipWaiting()` only after every allowlisted public shell asset is fetched successfully.
- Activation deletes prior `pablicus-shell-*` caches and claims existing clients.
- Controlled navigations are network-first with `cache: no-store`; offline fallback uses the newest successfully installed R1 shell.
- The injected `auto-update.js` checks on launch, focus, visibility return and every five minutes while visible; a newly installed controller reloads the page automatically.
- IndexedDB/localStorage application data, auth session, drafts, outbox and message stores are not cleared by update code.
- Manual `#updateNotice` may remain in legacy HTML for compatibility but R1 does not require user activation for subsequent releases.