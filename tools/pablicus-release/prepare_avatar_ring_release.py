"""Apply one paint-only shelf-scale line; preserve its movement and keyed images.
Used identically in both browser jobs and immutable release finalization.
"""
import hashlib
from pathlib import Path
root = Path('vision-talk/pablicus')
core = root / 'stories-v3-core.js'
s = core.read_text()
marker = "  panel.style.setProperty('--avatar-ring-scale',String(scale));\n"
if marker not in s:
    needle = '  panel.style.height=(G.expanded-G.range*p)'
    assert s.count(needle) == 1, 'Review changed shelf implementation'
    core.write_text(s.replace(needle, marker + needle))
for name, expected in {
    'avatar-ring-system.css': '164fb2df9b4b4f239ea7bcb2aa1709f2a7f3a2b5614fd73ea577abafcd6830f5',
    'stories-v3-core.js': '82168d66400231edd3e821b8a2a642380b0ab5beecb86572197bcef0f9690bcb',
}.items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == expected, 'Reviewed source mismatch: ' + name
builder = Path('tools/pablicus-release/build_release.py')
s = builder.read_text()
if 'UI-V5' in s:
    assert s.count('UI-V5') == 5, 'Review changed release builder'
    builder.write_text(s.replace('UI-V5', 'UI-AR1'))
assert builder.read_text().count('UI-AR1') == 5
