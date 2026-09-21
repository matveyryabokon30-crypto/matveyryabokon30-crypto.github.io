"""Apply the reviewed UI-V3 diff identically in verification and finalization.
The finalized commit retains the actual patched runtime, not a runtime patcher.
"""
import subprocess
from pathlib import Path

patch = 'tools/pablicus-release/media_geometry_v3.patch'
ready = subprocess.run(['git', 'apply', '--check', patch], capture_output=True)
if ready.returncode == 0:
    subprocess.run(['git', 'apply', patch], check=True)
else:
    # Idempotent only when the exact change is already present; otherwise fail.
    subprocess.run(['git', 'apply', '--reverse', '--check', patch], check=True)

builder = Path('tools/pablicus-release/build_release.py')
text = builder.read_text()
if 'UI-V2' in text:
    assert text.count('UI-V2') == 5, 'Unexpected release builder; review before changing'
    text = text.replace('UI-V2', 'UI-V3')
    builder.write_text(text)
assert text.count('UI-V3') == 5 and 'UI-V2' not in text
