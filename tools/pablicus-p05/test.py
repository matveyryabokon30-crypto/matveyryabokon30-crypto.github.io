from pathlib import Path
root=Path('vision-talk/pablicus')
media=(root/'media-cache.js').read_text()
app=(root/'app.js').read_text()
profile=(root/'profile-page.js').read_text()
stories=(root/'stories-v3-viewer.js').read_text()
assert "VERSION='P05'" in app
assert 'hydrateAuthorized' in media and 'hydrateAuthorized,peek' in media
assert "PablicusMediaCache.hydrateAuthorized(BUCKET,messageImagePaths(rows)" in app
assert "PablicusMediaCache.peek(BUCKET,r.attachment_path,{width:960})" in app
assert "PablicusMediaCache?.peek('profile-media',path,{width:192})" in profile
assert "hydrateAuthorized('pablicus-story-media',cachedImages" in stories
print('P05 static contract PASS')
