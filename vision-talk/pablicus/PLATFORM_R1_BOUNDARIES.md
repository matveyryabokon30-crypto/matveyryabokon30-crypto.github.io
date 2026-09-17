# Platform R1 remaining boundaries

Already shipped as web foundations: automatic PWA updates, canonical system sharing, social-preview injection, Pablicus directory contacts surface, enriched push rendering, WebRTC media-session primitives.

Not represented as completed:
1. `pablicus.com/.app/.ru`: purchase and DNS require registrar access.
2. Phone address-book sync: native Contacts permission/import or another explicit user-authorized import source is required for full device-book synchronization.
3. “Contact joined Pablicus”: requires a consented verified-phone/contact-discovery backend schema and event fanout; not created by client-only code.
4. Rich push sender/avatar/preview: worker renders these fields now, but the server push producer must populate them for real notifications.
5. End-to-end calling: WebRTC capture/peer primitives exist; production signalling, TURN credentials, call-state persistence and abuse controls remain required. Background iPhone incoming-call UX is native PushKit/CallKit work.
6. Spoken announcements through vehicle/Bluetooth are native/system integration work, not claimed by the PWA.