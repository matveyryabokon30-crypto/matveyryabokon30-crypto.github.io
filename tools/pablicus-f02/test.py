"""Static client compatibility only: not a proof of device Push delivery."""
from pathlib import Path
import json
root=Path('vision-talk/pablicus')
sw=(root/'sw.js').read_text()
push=(root/'push-notifications.js').read_text()
for x in ['sender_name','sender_avatar_url','content_kind','preview']:
    assert x in sw
for x in ['task_reminder','task_followup','PABLICUS_PUSH_OPEN','notificationclick']:
    assert x in sw
assert 'PABLICUS_PUSH_BIND' in sw and 'recipientId' in push
manifest=json.loads((root/'release.json').read_text())
assert "const VERSION='"+manifest['worker_version']+"';" in sw
print('Pablicus F02 static client compatibility PASS; device delivery not tested')
