"""Apply UI-V4 in both test jobs and immutable finalization; no runtime patcher."""
import hashlib
import subprocess
from pathlib import Path

patch = 'tools/pablicus-release/media_presentation_v4.patch'
ready = subprocess.run(['git', 'apply', '--unidiff-zero', '--check', patch], capture_output=True)
if ready.returncode == 0:
    subprocess.run(['git', 'apply', '--unidiff-zero', patch], check=True)
else:
    subprocess.run(['git', 'apply', '--unidiff-zero', '--reverse', '--check', patch], check=True)

expected = {
    'app.js': '16b97c13c1131434fd58d5444cf36c3c1748893c2fe904b2078f161820e5c899',
    'rich-message.js': 'b9a46c79d5c4160c4cbb630baa104b741364777bb0fbe40997b8111b831c5fe9',
    'chat-actions.js': '321c90db590ef25ff866e75da970d1f15fec668ad535b373c8e8ff2cc1fcb320',
    'message-menu.js': '89a1b57c380162448ce9188841988c9efd308acfcbc6934e83ddde69e93b6670',
    'public-ui-foundation.css': 'f799c0d64bce490b40c56b5b8323406734a8719ece5f93b25fbe466869c46d5d',
}
root = Path('vision-talk/pablicus')
for name, digest in expected.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, 'Reviewed runtime mismatch: ' + name

builder = Path('tools/pablicus-release/build_release.py')
text = builder.read_text()
if 'UI-V3' in text:
    assert text.count('UI-V3') == 5, 'Unexpected release builder'
    builder.write_text(text.replace('UI-V3', 'UI-V4'))
assert builder.read_text().count('UI-V4') == 5 and 'UI-V3' not in builder.read_text()

# Keep the previous no-crop assertion, replacing its obsolete static-position
# implementation detail with stricter source-ratio and frame/pixel equality.
header = Path('tools/pablicus-release/test_chat_header.py')
text = header.read_text()
old = 's.position==="static"&&r.height<=421&&r.height<=p.height+1'
new = 'Math.abs(r.width/r.height-n.naturalWidth/n.naturalHeight)<.005&&Math.abs(r.width-p.width)<1&&Math.abs(r.height-p.height)<1&&r.height<=321'
if old in text:
    assert text.count(old) == 1
    header.write_text(text.replace(old, new))
assert new in header.read_text() and old not in header.read_text()
