from pathlib import Path
sw=Path('vision-talk/pablicus/sw.js').read_text()
push=Path('vision-talk/pablicus/push-notifications.js').read_text()
for x in ['sender_name','sender_avatar_url','content_kind','preview']:
    assert x in sw
for x in ['task_reminder','task_followup','PABLICUS_PUSH_OPEN','notificationclick']:
    assert x in sw
assert 'PABLICUS_PUSH_BIND' in sw and 'recipientId' in push
assert 'pablicus-shell-f01-20260918' in sw
print('Pablicus F02 rich push client contract PASS')
