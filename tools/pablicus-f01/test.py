from pathlib import Path
root=Path('vision-talk/pablicus')
html=(root/'index.html').read_text()
app=(root/'app.js').read_text()
invite=(root/'share-invite.js').read_text()
auto=(root/'auto-update.js').read_text()
assert 'name="pablicus-canonical"' in html
for x in ['og:title','og:description','og:url','og:image','twitter:card']:
    assert x in html
assert 'assets/icon-glass-20260909-512.png' in html
assert 'window.PablicusInvite?.share' in app
assert "text='Присоединяйся ко мне в Pablicus'" in invite
assert "navigator.share" in invite and "navigator.clipboard.writeText" in invite
assert "registration.update()" in auto and "updateViaCache:'none'" in auto
assert '<span>Доступно обновление</span>' in html
assert 'banner.hidden=true' in auto
print('Pablicus functional F01 share/link/auto-update contract PASS')
