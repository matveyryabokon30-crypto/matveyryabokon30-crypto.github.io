# Pablicus F02 — Push 2.0

Status: production backend migration applied 2026-09-19.

Rich message push producer now emits sender_name, sender_avatar_url, content_kind and preview from server-authorized message/profile data. Existing task_reminder/task_followup payloads and notification routing remain unchanged. Client service worker already renders these fields with backward-compatible fallbacks.

Database migration: pablicus_push_f02_rich_payload.
