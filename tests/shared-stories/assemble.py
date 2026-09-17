"""Assemble the shared-element repair over the pinned public browser runtime."""
from pathlib import Path
import re, shutil, hashlib, json
ROOT=Path(__file__).resolve().parent
LIVE=ROOT.parents[1]/'vision-talk/pablicus'
OUT=ROOT/'candidate'
shutil.copytree(LIVE,OUT,dirs_exist_ok=True)
a=(LIVE/'avatar-stories.js').read_text()
meta='''
 const people=new Map();let emitted=false;
 function emitStories(){if(emitted||stopped)return;emitted=true;queueMicrotask(()=>{emitted=false;if(!stopped)global.dispatchEvent(new Event('pablicus:stories-changed'));});}
 function remember(p,url,conversationId=null,name=null){if(!UUID.test(p?.id||''))return;const old=people.get(p.id);const next={id:p.id,name:name||old?.name||p.display_name||p.username||'Собеседник',url:url||old?.url||'',conversationId:conversationId||old?.conversationId||null};if(!old||JSON.stringify(old)!==JSON.stringify(next)){people.set(p.id,next);emitStories();}}
 function snapshot(){return {userId:state().sessionUserId,now:storyNow(),people:[...people.values()].map(p=>({...p})),stories:[...feeds.values()].flat().filter(s=>Date.parse(s.expires_at)>storyNow()).map(s=>({...s,media:s.media?{...s.media}:null}))};}
'''
a=a.replace(' const storyNow=()=>Date.now()+serverOffset;',' const storyNow=()=>Date.now()+serverOffset;'+meta)
a=a.replace("n.dataset.storyOwner=id;owners.add(id);n.dataset.pablicusStoryRing=activeStories(id).length?'active':'none';","if(n.dataset.storyOwner!==id)n.dataset.storyOwner=id;owners.add(id);const value=activeStories(id).length?'active':'none';if(n.dataset.pablicusStoryRing!==value)n.dataset.pablicusStoryRing=value;")
a=a.replace('  }refreshRings();','  }refreshRings();emitStories();',1)
a=a.replace('paint(n,d.profile,url);queueFeed();',"remember(d.profile,url,id,d.personal?.first_name||row.querySelector('.chatText strong')?.textContent);paint(n,d.profile,url);queueFeed();",1)
a=a.replace('topPending=null;topData=d;topUrl=url;paint(n,d.profile,url);','topPending=null;topData=d;topUrl=url;remember(d.profile,url,id,d.personal?.first_name);paint(n,d.profile,url);')
a=a.replace(' async function view(owner,conversationId=null){'," async function view(owner,conversationId=null){\n  if(global.PablicusStoriesViewer){if(!closeModal())return;return global.PablicusStoriesViewer.open(owner,conversationId,document.activeElement);}")
a=a.replace('if(!live(snapshot)||!a.isConnected)return;\n  const stamp','if(!live(snapshot)||!a.isConnected)return;remember(own,url);\n  const stamp')
a=a.replace('a.dataset.avatarStamp=stamp;a.replaceChildren();','a.dataset.avatarStamp=stamp;')
start="if(!document.getElementById('storyOwnView')&&document.querySelector('.youHeroActions')){"
i=a.index(start);j=a.index("document.querySelector('.youHeroActions').after(v);}",i)+len("document.querySelector('.youHeroActions').after(v);}");a=a[:i]+a[j:]
a=a.replace('account=key(next);closeModal(true);cards.clear();','account=key(next);closeModal(true);people.clear();emitStories();cards.clear();')
a=a.replace('Object.freeze({refresh:schedule,compose,view,','Object.freeze({snapshot,refresh:schedule,compose,view,')
a=a.replace('const observer=new MutationObserver(schedule);',"const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.storyShelfV3,.storyViewerV3')))schedule();});")
(OUT/'avatar-stories.js').write_text(a)
p=(LIVE/'profile-appearance.js').read_text().split('/* Stories V2 is a presentation layer:')[0];(OUT/'profile-appearance.js').write_text(p)
c=(LIVE/'chat.js').read_text();old='function applyLayout(){if(simulating)return;const v=window.visualViewport,w=v?.width||innerWidth';assert old in c;c=c.replace(old,'function applyLayout(){if(simulating)return;const v=window.visualViewport;if(v&&Math.abs(v.scale-1)>.02)return;const w=v?.width||innerWidth');(OUT/'chat.js').write_text(c)
c=(LIVE/'chat-list-view.js').read_text();old="t.atTop&&(t.dy>0||t.initialPanel)?'panel':'native'";assert old in c;c=c.replace(old,"!workspace.dataset.storyShelf&&t.atTop&&(t.dy>0||t.initialPanel)?'panel':'native'");(OUT/'chat-list-view.js').write_text(c)
css=(LIVE/'avatar-rings.css').read_text()
keys=['.pablicusStoryAvatar','.profileNavAvatar','.pablicusStoryProfile','#conversationAvatar']
props={'padding','border','border-width','border-color','background','box-shadow','backdrop-filter','-webkit-backdrop-filter'}
def clean(m):
 s,b=m.group(1),m.group(2)
 if not any(k in s for k in keys):return m.group(0)
 if '::before' in s or '::after' in s or '[data-pablicus-story-ring' in s:return ''
 if '>img' in s.replace(' ',''):return m.group(0)
 return s+'{'+ ';'.join(d for d in b.split(';') if ':' in d and d.split(':',1)[0].strip() not in props)+'}'
css=re.sub(r'([^{}]+)\{([^{}]*)\}',clean,css);(OUT/'avatar-rings.css').write_text(css)
s=(LIVE/'index.html').read_text()
s=re.sub(r'<(?:script[^>]+src="stories-[^"]+"[^>]*></script|link[^>]+href="(?:stories-[^"]+|avatar-ring-system.css)"[^>]*>)','',s)
s=s.replace('</head>','<link rel="stylesheet" href="stories-v2.css"><link rel="stylesheet" href="avatar-ring-system.css"></head>')
s=s.replace('</body>','<script src="stories-v3-core.js"></script><script src="stories-v3-viewer.js"></script></body>')
(OUT/'index.html').write_text(s)
s=(LIVE/'sw.js').read_text();s=re.sub("const VERSION='[^']+';","const VERSION='pablicus-shell-shared-stories-20260917-final1';",s,1);s=s.replace('const FILES=[',"const FILES=['avatar-ring-system.css',",1);(OUT/'sw.js').write_text(s)
for name in ['stories-v3-core.js','stories-v3-viewer.js','stories-v2.css','avatar-ring-system.css']:shutil.copy2(ROOT/'runtime'/name,OUT/name)
assert s.split('const PUSH_UUID')[1]==(LIVE/'sw.js').read_text().split('const PUSH_UUID')[1]
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file() and (not(LIVE/p.name).exists() or p.read_bytes()!=(LIVE/p.name).read_bytes())}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('MANIFEST '+json.dumps(manifest),flush=True)
