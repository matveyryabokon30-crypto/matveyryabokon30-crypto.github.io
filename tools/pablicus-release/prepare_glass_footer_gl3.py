"""UI-GL3: glass belongs to the input capsule, not a clipped full-width footer.
The unchanged list model keeps bottom scroll padding, so its last row can always
finish above the composer even though history paints behind the floating input.
"""
from pathlib import Path
import hashlib
r=Path('vision-talk/pablicus')
p=r/'public-ui-foundation.css';s=p.read_text()
old='''/* The scroll model reserves this live composer inset; clip the same area so
   offscreen messages cannot paint or receive taps behind the writing surface. */
#app:not(.canvas-active):not(.composer-fullscreen) #vp{clip-path:inset(0 0 var(--chat-bottom-inset,0px) 0)}'''
new='''/* UI-GL3: bottom inset is scroll padding, not a full-width paint cutoff.
   History continues behind the floating glass capsule; the last row still ends
   above it via the unchanged NaturalList bottom inset and live measurements. */
#app:not(.canvas-active):not(.composer-fullscreen) #vp{clip-path:none}'''
if old in s:
 assert hashlib.sha256(p.read_bytes()).hexdigest()=='a35191281d8cc6ab596461df43bdfeacca638dd0b168eb24bee486ad905a3679'
 p.write_text(s.replace(old,new))
assert new in p.read_text()
p=r/'glass-ui.css';s=p.read_text();marker='/* UI-AU2: no white input panel; keep geometry, controls and history boundary. */'
new='''/* UI-GL3: transparent full-width footer, one local glass input capsule.
   Keep the existing border width and all layout positions. The background-only
   pseudo element leaves text sharp and the outside actions rail independent. */
:root body #app:not(.canvas-active):not(.composer-fullscreen) #composer{pointer-events:none!important}
:root body #app:not(.canvas-active):not(.composer-fullscreen) #composer>:is(#composeBox,#replyDraft,#vaultLine){pointer-events:auto!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen){background:transparent!important;background-image:none!important;border-color:var(--ui-glass-line)!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::before{content:''!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;border-radius:inherit!important;background:color-mix(in srgb,var(--surface) 28%,transparent)!important;box-shadow:inset 0 1px 0 #ffffffa6,0 2px 8px #00000012!important;backdrop-filter:blur(16px) saturate(1.25)!important;-webkit-backdrop-filter:blur(16px) saturate(1.25)!important;pointer-events:none!important;z-index:0!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::after{content:none!important}
:root body #app:not(.composer-fullscreen) #composer #composeBox.r2Composer :is(.r2Toolbar,.r2ComposerBody,.r2ComposerHeader){background:transparent!important;box-shadow:none!important}
/* Draft attachments keep their own outline without changing card dimensions. */
:root body #app:not(.composer-fullscreen) #composer #editor.r2ComposerBody .richMedia{background:transparent!important;outline:1px solid var(--ui-glass-line);outline-offset:-1px}
@media(prefers-reduced-transparency:reduce){:root body #app:not(.composer-fullscreen) #composer #composeBox#composeBox.r2Composer:not(.r2Fullscreen)::before{background:var(--surface)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
'''
if marker in s:
 assert hashlib.sha256(p.read_bytes()).hexdigest()=='8f1ef2f07bf75ac3dc0831142dd43635c0c06b01df06fca55fb63ed7ff7ec581'
 p.write_text(s[:s.index(marker)]+new)
assert new in p.read_text()
# Only update expectations superseded by the owner's clarification. Preserve all
# geometry/send/draft/gesture checks, the measured bottom padding and AU2 updater.
p=Path('tools/pablicus-release/build_release.py')
if p.exists():
 s=p.read_text()
 if 'UI-AU2' in s:
  assert s.count('UI-AU2')==5;p.write_text(s.replace('UI-AU2','UI-GL3'))
 assert p.read_text().count('UI-GL3')==5
p=Path('tools/pablicus-release/test_media_geometry.py')
if p.exists():
 s=p.read_text()
 old="check('viewport clips the live composer inset',clip!='none' and str(int(page.evaluate('Fixture.list.insets.bottom'))) in clip,clip)"
 new="check('history has no full-width footer clip',clip=='none',clip)"
 old2='''check('clipped messages are not hit-tested behind composer',page.evaluate("!document.elementsFromPoint(2,$('composer').getBoundingClientRect().top+15).some(n=>n.closest('#vp'))"))'''
 new2='''check('transparent footer gutters reach history',page.evaluate("!!document.elementFromPoint(2,$('composer').getBoundingClientRect().top+15)?.closest('#vp')"))'''
 for before,after in [(old,new),(old2,new2)]:
  if before in s:assert s.count(before)==1;s=s.replace(before,after)
  assert after in s
 p.write_text(s)
p=Path('tools/pablicus-release/test_chat_header.py')
if p.exists():
 s=p.read_text()
 old='return (n.id==="composeBox"?s.content==="none"&&getComputedStyle(n).backgroundColor==="rgba(0, 0, 0, 0)":s.content!=="none"&&s.backdropFilter.includes("blur(16px)")&&s.pointerEvents==="none")&&getComputedStyle(n).filter==="none"'
 new='return s.content!=="none"&&s.backdropFilter.includes("blur(16px)")&&s.pointerEvents==="none"&&getComputedStyle(n).filter==="none"'
 if old in s:assert s.count(old)==1;s=s.replace(old,new)
 assert new in s;p.write_text(s)
assert hashlib.sha256((r/'auto-update.js').read_bytes()).hexdigest()=='96836ddbeffa00bc1bb57e272b811076dc8c58259ac56d94f655ab608be55125'
assert hashlib.sha256((r/'writing-surface.css').read_bytes()).hexdigest()=='17b41a8e545ffa85a9e9fd2c0d202e23328ebd44786b4ba02c6c0e6c0cd89994'
