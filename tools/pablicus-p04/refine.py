from pathlib import Path
import sys,json,hashlib,re
R=Path(sys.argv[1])
def patch(f,a,b,n=1):
 p=R/f;s=p.read_text();assert s.count(a)==n,(f,s.count(a),a[:100]);p.write_text(s.replace(a,b))
# Prepare first-screen photos only; remaining media stays demand-driven.
patch('home-data.js', "ids.slice(0,24).map(id=>card(id).then(d=>{if(d?.profile)", "ids.slice(0,24).map((id,i)=>card(id).then(d=>{if(i<8&&d?.profile)")
# The own avatar must consume the same authorization response as peer avatars.
patch('avatar-stories.js', "  const cardsReady=Promise.all(ids.map(id=>card(id,snapshot).then(async d=>", "  const cardReads=ids.map(id=>card(id,snapshot));\n  const cardsReady=Promise.all(cardReads.map((p,index)=>p.then(async d=>")
patch('avatar-stories.js', "cardReads.map((p,index)=>p.then(async d=>{", "cardReads.map((p,index)=>p.then(async d=>{const id=ids[index];")
patch('avatar-stories.js', "  const ownReady=preload(profile).then(r=>", "  const ownReady=Promise.allSettled(cardReads).then(()=>preload(profile)).then(r=>")
patch('avatar-stories.js', "const snapshot=state(),ticket=key(snapshot)+'|'+own.id+'|'+own.avatar_url;", "if(document.getElementById('home')?.classList.contains('auth-booting'))return;const snapshot=state(),ticket=key(snapshot)+'|'+own.id+'|'+own.avatar_url;")
# Preserve real no-photo/group fallbacks without a transient letter for known photos.
patch('avatar-stories.js', "  const cached=global.PablicusHomeData?.peekCard(id),pre=", "  const cached=global.PablicusHomeData?.peekCard(id);if(cached?.kind==='group'){n.textContent=Array.from(row.querySelector('.chatText strong')?.textContent||'?')[0].toUpperCase();return;}const pre=")
patch('avatar-stories.js', "  const d=await card(id,snapshot);if(!live(snapshot)||!row.isConnected||!d)return;", "  const d=await card(id,snapshot);if(!live(snapshot)||!row.isConnected)return;if(!d){if(global.PablicusHomeData?.peekCard(id)?.kind==='group')n.textContent=Array.from(row.querySelector('.chatText strong')?.textContent||'?')[0].toUpperCase();return;}")
patch('avatar-stories.js', "const keep=retained&&n.dataset.avatarPerson===p.id;", "const keep=retained&&!!p.avatar_url&&n.dataset.avatarPerson===p.id;")
patch('avatar-stories.js', "url:url||old?.url||'',conversationId:", "url:!p.avatar_url&&url===''?'':(url||old?.url||''),conversationId:")
patch('avatar-stories.js', "   if(path&&!url)return null;prepared.set(p.id,record);", "   if(path&&!url){prepared.delete(p.id);return null;}prepared.set(p.id,record);")
p=R/'sw.js';s=p.read_text();old=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));manifest={f:hashlib.sha256((R/('index.html' if f=='./' else f)).read_bytes()).hexdigest() for f in old};s=re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1);p.write_text(s)
for f in ['release-p01r2.json','release-p04.json']:
 p=R/f;r=json.loads(p.read_text());r['assets']=manifest;p.write_text(json.dumps(r,indent=2))
