from pathlib import Path
import hashlib,json,re,sys
R=Path(sys.argv[1])
def patch(name,old,new,n=1):
 p=R/name;s=p.read_text();assert s.count(old)==n,(name,s.count(old),old[:120]);p.write_text(s.replace(old,new))
p=R/'index.html';s=p.read_text();s=s.replace('<script src="chat-list-view.js">','<script src="home-data.js"></script><script src="chat-list-view.js">')
s=s.replace('<script src=','<script defer src=');s=s.replace('content="P02"','content="P03"')
s=s.replace('<title>Pablicus</title>','<title>Pablicus</title><link rel="preconnect" href="https://ctcoqgsztdtsazdiwcmd.supabase.co" crossorigin>');p.write_text(s)
patch('app.js',"VERSION='P02'","VERSION='P03'")
patch('app.js',"let chatListGestures=null,chatListOwner=null,chatArchive=false,chatPrefsRevision=0,chatListRenderPending=false;","let chatListGestures=null,chatListOwner=null,chatArchive=false,chatPrefsRevision=0,chatListRenderPending=false;\n let dialogsRequest=null,dialogsLast=0,dialogsRealtimeTimer=0;")
# Reads are authorized by existing server rules. Approval is still mandatory
# before either cached or newly fetched home data is displayed.
patch('app.js',"user=session.user;sessionViewCleared=false;profile=null;const uid=user.id;", "user=session.user;sessionViewCleared=false;profile=null;const uid=user.id;\n  if(navigator.onLine)void fetchDialogSnapshot().catch(()=>{});")
patch('app.js',"safeSet('pablicus:'+uid+':profile',profile);window.PablicusShell.authentication(true);", "safeSet('pablicus:'+uid+':profile',profile);window.PablicusHomeData?.mark('approved');window.PablicusShell.authentication(true);")
p=R/'app.js';s=p.read_text();start=s.index(' async function loadDialogs(){');end=s.index(' function storageSize(',start)
s=s[:start]+''' function fetchDialogSnapshot(){
  const uid=user?.id,revision=chatPrefsRevision;if(!uid)return Promise.reject(Error('No session'));
  if(dialogsRequest?.uid===uid&&dialogsRequest.revision===revision&&!dialogsRequest.consumed&&Date.now()-dialogsRequest.at<10000)return dialogsRequest.promise;
  const conversation=(async()=>{let r=await sb.rpc('my_conversations_v3');if(r.error)r=await sb.rpc('my_conversations_v2');if(r.error)throw r.error;return r.data||[];})();
  const preference=Promise.resolve(sb.rpc('pablicus_chat_preferences',{p_action:'list',p_conversation_id:null,p_value:null})).then(r=>{if(r.error)throw r.error;return r.data||[];});
  const promise=Promise.all([conversation,preference]),entry={uid,revision,at:Date.now(),promise};dialogsRequest=entry;
  promise.catch(()=>{if(dialogsRequest===entry)dialogsRequest=null;});return promise;
 }
 async function loadDialogs(){
  if(!user||refreshing||!navigator.onLine)return;refreshing=true;const uid=user.id,revision=chatPrefsRevision;
  try{const request=fetchDialogSnapshot(),entry=dialogsRequest;const [conversations,prefs]=await request;entry.consumed=true;
   if(user?.id!==uid||revision!==chatPrefsRevision||!profile?.is_approved)return;
   chatPrefs.clear();for(const item of prefs)chatPrefs.set(item.conversation_id,item);
   const next=conversations.map(d=>withChatPreference(d)),changed=JSON.stringify(next)!==JSON.stringify(dialogs);dialogs=next;dialogsLast=Date.now();
   if(changed)safeSet(cacheKey(),dialogs);
   const route=window.PablicusController?.state();if(changed&&!current&&page==='chats'&&(!route||(route.screen==='home'&&route.section==='chats')))renderHome();
   window.PablicusHomeData?.mark('dialogs');
  }catch(e){if(!dialogs.length)toast('Не удалось обновить список разговоров')}finally{refreshing=false;}
 }
 function refreshDialogsSoon(){
  dialogsRequest=null;dialogsLast=0;if(dialogsRealtimeTimer)return;
  dialogsRealtimeTimer=setTimeout(()=>{dialogsRealtimeTimer=0;if(!document.hidden)void loadDialogs();},80);
 }
''' +s[end:];p.write_text(s)
patch('app.js',"payload=>deliverInbox(payload.new,uid,token)","payload=>{deliverInbox(payload.new,uid,token);if(user?.id===uid&&token===inboxEpoch)refreshDialogsSoon();}")
patch('app.js',"if(current)syncMessages();else loadDialogs();pump()", "if(current)syncMessages();else if(Date.now()-dialogsLast>=10000)loadDialogs();pump()")
patch('app.js',"window.addEventListener('online',()=>{connection();loadDialogs();", "window.addEventListener('online',()=>{connection();dialogsRequest=null;loadDialogs();")
patch('app.js',"if(!document.hidden){connection();loadDialogs();syncMessages();pump()}", "if(!document.hidden){connection();dialogsRequest=null;loadDialogs();syncMessages();pump()}")
patch('app.js',"function clearSessionView(){if(sessionViewCleared)return;", "function clearSessionView(){if(sessionViewCleared)return;dialogsRequest=null;dialogsLast=0;clearTimeout(dialogsRealtimeTimer);dialogsRealtimeTimer=0;window.PablicusHomeData?.reset();")
patch('app.js',"  chatListGestures.resetRows();$('chatArchiveToggle')", "  $('chatArchiveToggle')")
patch('app.js',"profilePage.destroy();c.replaceChildren();window.PablicusShell.project", "profilePage.destroy();if(page!=='chats')c.replaceChildren();window.PablicusShell.project")
patch('app.js',"   ensureChatList();\n   const focused=", "   ensureChatList();\n   const previousRows=new Map([...c.querySelectorAll('.chatCard')].map(n=>[n.dataset.conversationId,n])),output=document.createDocumentFragment();\n   const focused=")
patch('app.js',";c.append(back);}", ";output.append(back);}")
patch('app.js',"if(!ds.length){c.append(el('p','empty',chatArchive?", "if(!ds.length){c.replaceChildren(el('p','empty',chatArchive?")
patch('app.js',"'Разговоров пока нет. Найдите человека по имени или откройте его ссылку профиля.'));return}", "'Разговоров пока нет. Найдите человека по имени или откройте его ссылку профиля.'));chatListGestures.pruneRows?.();return}")
patch('app.js',"for(const d of ds){const row=el('section','chatCard');row.dataset.conversationId=d.id;", "for(const d of ds){const signature=JSON.stringify([d,focused.has(d.id)]),old=previousRows.get(d.id);if(old?.dataset.renderSignature===signature){output.append(old);continue;}const row=el('section','chatCard');row.dataset.conversationId=d.id;row.dataset.renderSignature=signature;")
patch('app.js',"decorateChatRow(row,d,button,focus);c.append(row)}\n   chatListGestures.restore(openActions);", "decorateChatRow(row,d,button,focus);output.append(row)}\n   c.replaceChildren(output);chatListGestures.pruneRows?.();chatListGestures.restore(openActions);window.PablicusHomeData?.prime(ds.map(d=>d.id));window.PablicusHomeData?.mark('home-rows');")
patch('chat-list-view.js',"const avatars=createAvatars({isActive});", "const avatars=root.PablicusHomeData?{mount(){},resetRows(){},destroy(){}}:createAvatars({isActive});")
patch('chat-list-view.js',"   resetRows(){end(true);closeRow();rows.clear();avatars.resetRows();},", "   pruneRows(){for(const [row]of rows)if(!row.isConnected){if(openRow===row)openRow=null;rows.delete(row);}},\n   resetRows(){end(true);closeRow();rows.clear();avatars.resetRows();},")
patch('avatar-stories.js',"  const k=key(snapshot)+':'+id,hit=cards.get(k);", "  if(global.PablicusHomeData){const data=await global.PablicusHomeData.card(id,snapshot).catch(()=>null);if(!live(snapshot))return null;if(data?.kind==='self'){const p=services()?.getProfile?.();return p?{profile:p,personal:{}}:null;}return data?.kind==='contact'?data:null;}\n  const k=key(snapshot)+':'+id,hit=cards.get(k);")
patch('avatar-stories.js',"  const url=await avatarUrl(d.profile,snapshot);if(!live(snapshot)||!row.isConnected)return;remember(d.profile,url,id,d.personal?.first_name||row.querySelector('.chatText strong')?.textContent);paint(n,d.profile,url);queueFeed();", "  const name=d.personal?.first_name||row.querySelector('.chatText strong')?.textContent;remember(d.profile,'',id,name);ring(n,d.profile.id);queueFeed();\n  const url=await avatarUrl(d.profile,snapshot);if(!live(snapshot)||!row.isConnected)return;remember(d.profile,url,id,name);paint(n,d.profile,url);")
patch('avatar-stories.js',"if(!force&&Date.now()-lastFeed<10000)return;", "if(!force&&Date.now()-lastFeed<10000&&[...owners].every(id=>feeds.has(id)))return;")
patch('avatar-stories.js',"r=await client.rpc('pablicus_story_feed',{p_owners:chunk});", "r=global.PablicusHomeData?{data:await global.PablicusHomeData.feed(chunk,force)}:await client.rpc('pablicus_story_feed',{p_owners:chunk});")
patch('avatar-stories.js',"feedTimer=setTimeout(()=>void feed(true),100)", "feedTimer=setTimeout(()=>void feed(false),24)")
patch('avatar-stories.js'," async function hydrateOwnNav(){", " let ownNavFlight=null;\n async function hydrateOwnNav(){")
patch('avatar-stories.js',"  ring(a,own.id);const snapshot=state(),url=await avatarUrl(own,snapshot);if(!live(snapshot)||!a.isConnected)return;remember(own,url);", "  ring(a,own.id);remember(own,'');const snapshot=state(),ticket=key(snapshot)+'|'+own.id+'|'+own.avatar_url;\n  if(a.dataset.sourceTicket===ticket&&(a.querySelector('img')||!own.avatar_url))return;if(ownNavFlight===ticket)return;ownNavFlight=ticket;queueFeed();\n  let url;try{url=await avatarUrl(own,snapshot);}finally{if(ownNavFlight===ticket)ownNavFlight=null;}if(!live(snapshot)||!a.isConnected)return;a.dataset.sourceTicket=ticket;remember(own,url);")
patch('avatar-stories.js',"const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.storyShelfV3,.storyViewerV3')))schedule();});", "const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.storyShelfV3,.storyViewerV3,[data-story-owner]')))schedule();});")
patch('avatar-stories.js',"document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();void feed(true);}", "global.addEventListener('pablicus:home-feed',e=>{const d=e.detail;if(!live(d)||!Array.isArray(d.owners)||!Array.isArray(d.feed?.stories))return;const now=Date.parse(d.feed.server_now);if(!Number.isFinite(now))return;serverOffset=now-Date.now();for(const id of d.owners){owners.add(id);feeds.set(id,d.feed.stories.filter(s=>s.owner_id===id&&UUID.test(s.id)&&Date.parse(s.expires_at)>now));}lastFeed=Date.now();refreshRings();emitStories();},{signal:life.signal});\n document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();void feed(true);}")
patch('stories-v3-core.js',"const r=await S().client.rpc('pablicus_story_feed',{p_owners:[owner]});", "const r=g.PablicusHomeData?{data:await g.PablicusHomeData.feed([owner])}:await S().client.rpc('pablicus_story_feed',{p_owners:[owner]});")
p=R/'sw.js';s=p.read_text();manifest=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));names=list(manifest)+['home-data.js'];manifest={f:hashlib.sha256((R/('index.html' if f=='./' else f)).read_bytes()).hexdigest() for f in names}
s=re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1);s=s.replace("const VERSION='pablicus-shell-p02-20260918';","const VERSION='pablicus-shell-p03-20260918';");p.write_text(s)
report={'release':'P03','base':'48254f491f6375c4bfc8a964e62f480e53ec7c46','assets':manifest,'push_sha256':hashlib.sha256(s[s.index('const PUSH_UUID='):].encode()).hexdigest()}
for name in ['release-p01r2.json','release-p03.json']:(R/name).write_text(json.dumps(report,indent=2))
print('P03 scoped candidate built; assets:',len(manifest))
