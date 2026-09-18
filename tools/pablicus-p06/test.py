from pathlib import Path
root=Path('vision-talk/pablicus')
app=(root/'app.js').read_text()
profile=(root/'profile-page.js').read_text()
stories=(root/'stories-v3-core.js').read_text()
viewer=(root/'stories-v3-viewer.js').read_text()
media=(root/'media-cache.js').read_text()
assert "VERSION='P06'" in app
assert "messageCacheKey=id=>" in app
assert "const cachedRows=safeGet(messageCacheKey(d.id))||[]" in app
assert "safeSet(messageCacheKey(d.id),remote)" in app
assert "hydrateAuthorized(BUCKET,messageImagePaths(older)" in app
assert "profile-surface" in profile and "cached&&cached.owner===uid" in profile
assert "PablicusMediaCache?.peek('profile-media',media.path,{width:960})" in profile
assert "cachedFeed(owner)" in stories and "sessionStorage.setItem(feedKey(owner)" in stories
assert "PablicusMediaCache?.peek('pablicus-story-media',s.media.path,{width:1600})" in viewer
assert "setInterval(()=>{if(!document.hidden){pollInbox();messageTools.sync()}},5000)" in app
assert "},2500);connection();" in app
assert 'hydrateAuthorized' in media
print('P06 final performance contract PASS')
