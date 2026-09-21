"""Apply reviewed paint-only composer changes identically in verification and finalization."""
from pathlib import Path
import hashlib
r=Path('vision-talk/pablicus')
css='''
/* UI-AU2: no white input panel; keep geometry, controls and history boundary. */
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen){background:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::before,
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::after{content:none!important;background:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox.r2Composer :is(.r2Toolbar,.r2ComposerBody,.r2ComposerHeader){background:transparent!important;box-shadow:none!important}
/* A draft attachment still has its own edge, not a shared white field. Inset
   outline does not change the existing 48px card or the image dimensions. */
:root body #app:not(.composer-fullscreen) #composer #editor.r2ComposerBody .richMedia{background:transparent!important;outline:1px solid var(--ui-glass-line);outline-offset:-1px}
'''
p=r/'glass-ui.css';s=p.read_text()
if css not in s:
 assert hashlib.sha256(p.read_bytes()).hexdigest()=='728ab4efe18416fe3600cc0269e7f04f24a2567a6d62db96572476c038519498'
 p.write_text(s+css)
p=r/'writing-surface.css';s=p.read_text();old=':is(#app #composer #composeBox#composeBox.r2Composer,.workspaceEditor.r2Composer,.botComposer.r2Composer):has('
if old in s:
 assert s.count(old)==4
 s=s.replace(old,':is(#app.composer-fullscreen #composer #composeBox#composeBox.r2Composer,.workspaceEditor.r2Composer,.botComposer.r2Composer):has(')
 s=s.replace('Focus surface 1.0 — active writing is opaque white; idle retains glass.','Focus surface — workspace/fullscreen writing stays white; normal chat is transparent.')
 p.write_text(s)
for n,d in {'auto-update.js':'96836ddbeffa00bc1bb57e272b811076dc8c58259ac56d94f655ab608be55125','glass-ui.css':'8f1ef2f07bf75ac3dc0831142dd43635c0c06b01df06fca55fb63ed7ff7ec581','writing-surface.css':'17b41a8e545ffa85a9e9fd2c0d202e23328ebd44786b4ba02c6c0e6c0cd89994'}.items():
 assert hashlib.sha256((r/n).read_bytes()).hexdigest()==d,n
p=r/'index.html';s=p.read_text();old='<div id="updateNotice" hidden><span>Доступно обновление</span><button data-ui-control="button" id="applyUpdate">Сохранить и обновить</button></div>'
if old in s:
 assert s.count(old)==1
 p.write_text(s.replace(old,''))
assert 'id="applyUpdate"' not in p.read_text()
p=Path('tools/pablicus-release/build_release.py');s=p.read_text()
if 'UI-AR1' in s:
 assert s.count('UI-AR1')==5
 p.write_text(s.replace('UI-AR1','UI-AU2'))
assert p.read_text().count('UI-AU2')==5
# Update only the superseded chat surface assertion; retain other editors' glass tests.
p=Path('tools/pablicus-release/test_chat_header.py');s=p.read_text();old='return s.content!=="none"&&s.backdropFilter.includes("blur(16px)")&&s.pointerEvents==="none"&&getComputedStyle(n).filter==="none"'
new='return (n.id==="composeBox"?s.content==="none"&&getComputedStyle(n).backgroundColor==="rgba(0, 0, 0, 0)":s.content!=="none"&&s.backdropFilter.includes("blur(16px)")&&s.pointerEvents==="none")&&getComputedStyle(n).filter==="none"'
if old in s:
 assert s.count(old)==1
 p.write_text(s.replace(old,new))
assert new in p.read_text()
