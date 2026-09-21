"""UI-V5 reviewed runtime, identical in verification and artifact finalization."""
import subprocess,hashlib
from pathlib import Path
patch='tools/pablicus-release/send_media_v5.patch'
ready=subprocess.run(['git','apply','--check',patch],capture_output=True)
if ready.returncode==0:subprocess.run(['git','apply',patch],check=True)
else:subprocess.run(['git','apply','--reverse','--check',patch],check=True)
root=Path('vision-talk/pablicus')
expected={'app.js':'2a364c389c5ab212f01693bc98e408299d3ceab20ce7c77ce10412a714113b5e','chat.js':'b0a0adefada7c2a750244c85bb57cfba54f43cec4a43f2cb2dfe1ca08182de01','transport-store.js':'cfdbdad595a588f00f9b910938131aa0dabf3c647874ce2fabc143da4fdbb461','rich-message.js':'3c54aa6f08bc2cca0a2928ac82e9ef8bd2883765e03d39f5ffde612dc101d254','public-ui-foundation.css':'a35191281d8cc6ab596461df43bdfeacca638dd0b168eb24bee486ad905a3679'}
for name,digest in expected.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,'Reviewed source differs: '+name
p=Path('tools/pablicus-release/build_release.py');s=p.read_text()
if 'UI-V4' in s:
 assert s.count('UI-V4')==5
 p.write_text(s.replace('UI-V4','UI-V5'))
assert p.read_text().count('UI-V5')==5
# Owner rejected the 320px cap. Retain all ratio, clipping and gesture assertions;
# only update the explicitly changed size contract to 420px.
for name,old,new in [('test_chat_header.py','r.height<=321','r.height<=421'),('test_media_presentation.py',"result['h']<=321","result['h']<=421")]:
 p=Path('tools/pablicus-release')/name;s=p.read_text()
 if old in s:
  assert s.count(old)==1
  p.write_text(s.replace(old,new))
 assert new in p.read_text()
