/* Bot conversations use the same composer and durable blob/outbox contracts. */
(function(global){'use strict';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button','r2Action',label);b.type='button';b.onclick=fn;return b;};
function create({host,bot,known,client,getUser,req,onError,onAction,isCurrent}){
 const user=getUser(),store=new global.PablicusRichStore(user.id,bot.id);store.name='pablicus-bot-r2:'+user.id+':'+bot.id;
 const lease=crypto.randomUUID(),life=new AbortController();let destroyed=false,ready=false,full=false,handing=false,draining=false,revision=0,chain=Promise.resolve(),timer=0,session=null,chrome,rich;
 const alive=()=>!destroyed&&isCurrent()&&getUser()?.id===user.id;
 const thread=el('div','botThread'),choices=el('div','botChoices'),queue=el('div','botOutbox'),form=el('form','botComposer'),body=el('div'),input=el('textarea','botInput'),send=el('button','r2Send'),attach=el('button'),expand=el('button'),picker=el('input');
 queue.setAttribute('role','status');queue.setAttribute('aria-live','polite');
 input.rows=1;input.maxLength=2000;input.placeholder='Сообщение…';input.autocomplete='off';input.setAttribute('aria-label','Сообщение боту');send.type='submit';picker.type='file';picker.multiple=true;picker.hidden=true;body.append(input);form.append(body);host.append(thread,choices,queue,form,picker);
 const fail=e=>{if(alive())onError(e);};
 const capture=()=>({...rich.capture(),composer:chrome?.capture(),expanded:full});
 function sync(){if(!rich||!chrome)return;const s=rich.capture();send.disabled=!ready||handing||rich.recording||rich.pending||rich.composing||(!s.text.trim()&&!s.files.length);chrome.sync({expanded:full,busy:handing});}
 function save(s=capture()){
  if(!ready)return chain;
  chain=chain.catch(()=>{}).then(async()=>{const v=await store.write(s,revision);revision=v.revision;});return chain;
 }
 function changed(){if(!alive())return;sync();clearTimeout(timer);if(ready)timer=setTimeout(()=>save().catch(fail),160);}
 rich=global.PablicusRichComposer.create({container:body,input,onChange:changed,onError:m=>fail(Error(m)),onGeometry:sync});
 chrome=global.PablicusComposerR2.create({root:form,body,input,attach,collapseFull:()=>setFull(false),voice:rich.voiceButton,send,expand,capture:()=>rich.capture(),recording:()=>rich.recording,getScope:()=>({user:user.id,bot:bot.id,session:session?.id}),getTarget:()=>null,onContext:changed,pick:accept=>{picker.accept=accept;picker.click();},sources:()=>global.PablicusAI.sources({botChatId:session?.id||null}),action:onAction});
 picker.onchange=()=>{rich.addFiles([...picker.files]).catch(fail);picker.value='';};
 input.onpaste=e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();rich.addFiles(files).catch(fail);}};
 const viewport=()=>{form.style.setProperty('--bot-editor-top',(global.visualViewport?.offsetTop||0)+'px');form.style.setProperty('--bot-editor-height',(global.visualViewport?.height||innerHeight)+'px');};
 for(const surface of [global,global.visualViewport].filter(Boolean))for(const event of ['resize','scroll'])surface.addEventListener(event,viewport,{signal:life.signal});
 function setFull(next){full=next;if(full){form.setAttribute('popover','manual');form.showPopover?.();}else{try{form.hidePopover?.();}catch{}form.removeAttribute('popover');}viewport();changed();}
 expand.onclick=()=>setFull(!full);form.addEventListener('keydown',e=>{if(e.key==='Escape'&&full&&!chrome.opened){e.preventDefault();setFull(false);}},{signal:life.signal});
 const sizing=new ResizeObserver(()=>{viewport();rich.resize();});sizing.observe(form);
 async function history(){
  const data=await req('/v1/chats/'+session.id);if(!alive())return;session=data.session;thread.replaceChildren();choices.replaceChildren();let latest;
  for(const event of data.events||[]){
   const bubble=el('div','botBubble me',event.input?.text||'');
   for(const file of event.input?.files||[]){const open=button(PablicusRichMessage.attachmentLabel(file),async()=>{open.disabled=true;try{const r=await req('/v1/chats/'+session.id+'/media',{method:'POST',data:{event:event.id,file:file.id}});if(!alive())return;const url=new URL(r.url);if(url.protocol!=='https:'||url.hostname!=='ctcoqgsztdtsazdiwcmd.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/pablicus-bot-media/'))throw Error('Неверная ссылка на файл.');let media;if(['audio','video','image'].includes(file.kind)){media=el(file.kind==='image'?'img':file.kind);media.src=url.href;if(file.kind==='image')media.alt='Фото';else{media.controls=true;media.preload='metadata';if(file.kind==='video')media.playsInline=true;}media.style.maxWidth='100%';open.replaceWith(media);}else{const a=el('a','',PablicusRichMessage.attachmentLabel(file));a.href=url.href;a.download=file.name;a.rel='noopener';a.target='_blank';open.replaceWith(a);a.click();}}catch(e){fail(e);open.disabled=false;}});bubble.append(open);}
   thread.append(bubble);for(const reply of event.response?.replies||[]){latest=reply;thread.append(el('div','botBubble bot',reply.text||''));}
  }
  for(const item of latest?.buttons||[])choices.append(button(item.label,()=>enqueue(item.value||item.id).catch(fail)));
  // A completed scenario still accepts /start and keeps the same visible composer.
  thread.scrollTop=thread.scrollHeight;
 }
 async function queueView(){
  const items=await store.readQueue(false);if(!alive())return;queue.replaceChildren();
  for(const item of items.filter(r=>r.state!=='cancelled')){
   const card=el('div','botQueueItem');card.dataset.clientMessageId=item.id;card.append(el('p','',item.error?.message||(item.state==='sending'?'Отправляем…':'Ожидает отправки')));
   if(item.state!=='sending'){card.append(button('Повторить',async()=>{try{await store.retry(item.id);await drain();}catch(e){fail(e);}}),button('Отменить отправку',async()=>{try{await store.cancel(item.id);await queueView();}catch(e){fail(e);}}));}queue.append(card);
  }
 }
 async function enqueue(choice){
  if(!ready||handing||rich.composing||rich.recording||rich.pending)return;
  const original=capture(),s=choice?{text:choice,blocks:[{id:crypto.randomUUID(),type:'text',text:choice}],files:[],composer:chrome.capture()}:original;
  if(!s.text.trim()&&!s.files.length)return;if(s.text.length>2000)throw Error('В сообщении боту — до 2000 символов.');
  handing=true;input.readOnly=true;sync();clearTimeout(timer);
  try{await chain;const saved=await store.write(s,revision);revision=saved.revision;const queued=await store.enqueue(saved.intent,revision);revision=queued.draftRevision??revision;
   if(alive()){if(choice){await save(original);}else rich.clear();}await queueView();
  }finally{handing=false;input.readOnly=false;sync();}
  await drain();
 }
 async function drain(){
  if(draining||!ready||!alive())return;draining=true;
  try{for(const initial of (await store.readQueue()).filter(r=>r.state==='queued'||(r.state==='sending'&&r.lease?.until<Date.now()))){
   if(!alive()||!navigator.onLine)break;let item=await store.claim(initial.id,lease);if(!item)continue;await queueView();
   try{
    if(item.botRevision==null){await history();item=await store.change(item.id,r=>{r.botRevision=session.revision;});}
    const files=[];
    for(const file of initial.files){
     const meta={id:file.id,name:file.name,size:file.size,mime:file.type,kind:file.kind};
     const signed=await req('/v1/chats/'+session.id+'/uploads',{method:'POST',data:{event:item.id,file:meta}});
     if(!alive())throw Error('Аккаунт или чат изменился.');
     if(!signed.ready){const bytes=await file.file.arrayBuffer();if(!alive())throw Error('Аккаунт или чат изменился.');if(bytes.byteLength!==file.size)throw Error('Не удалось прочитать полный файл');const upload=await client.storage.from('pablicus-bot-media').uploadToSignedUrl(signed.path,signed.token,bytes,{contentType:file.type,upsert:false});if(upload.error)throw Error('Не удалось загрузить вложение. Повторите отправку.');}
     files.push({...meta,path:signed.path});await store.progress(item.id,lease,'upload:'+file.id,{uploaded:true});
    }
    const response=await req('/v1/chats/'+session.id+'/messages',{method:'POST',data:{id:item.id,text:item.messages[0].text,revision:item.botRevision,...(files.length?{files}:{})}});
    await store.progress(item.id,lease,item.messages[0].id,{ack:{id:response.id||item.id}});await store.finish(item.id,lease);if(alive())await history();
   }catch(e){await store.failed(item.id,lease,e,!navigator.onLine);fail(e);break;}
  }}finally{draining=false;await queueView();}
 }
 form.onsubmit=e=>{e.preventDefault();enqueue().catch(fail);};global.addEventListener('online',()=>drain().catch(fail),{signal:life.signal});
 (async()=>{try{
  const saved=await store.read();if(!alive())return;revision=saved?.revision||0;
  let legacy=null;try{legacy=JSON.parse(localStorage.getItem('pablicus-bot-draft-r2:'+user.id+':'+bot.id)||'null');}catch{}
  rich.restore(saved||{text:legacy?.text||'',files:[]});chrome.restore(saved?.composer||legacy?.composer);
  session=known[0]||await req('/v1/bots/'+bot.id+'/chats',{method:'POST',data:{id:crypto.randomUUID()}});if(!alive())return;
  await history();ready=true;
  if(!saved&&legacy?.pending?.chat===session.id){
    // Keep the original attempt ID and revision when upgrading an uncertain send.
    const draft=capture(),pending=legacy.pending,snapshot={text:pending.text,blocks:[{id:crypto.randomUUID(),type:'text',text:pending.text}],files:[],composer:draft.composer};
    const written=await store.write(snapshot,revision);revision=written.revision;
    await store.transaction(['drafts'],'readwrite',(tx)=>{const ds=tx.objectStore('drafts'),q=ds.get('draft');q.onsuccess=()=>ds.put({...q.result,intent:pending.id});});
    const queued=await store.enqueue(pending.id,revision);revision=queued.draftRevision;await store.change(pending.id,r=>{r.botRevision=pending.revision;});
    if(draft.text===pending.text)rich.clear();else await save(draft);
  }
  sync();await queueView();await drain();if(!session.revision)await enqueue('/start');
 }catch(e){fail(e);sync();}})();
 return {back:()=>chrome.back(),async destroy(){if(destroyed)return;clearTimeout(timer);const final=ready?capture():null;destroyed=true;life.abort();sizing.disconnect();chrome.destroy();rich.destroy();for(const media of thread.querySelectorAll('audio,video'))media.pause();try{if(final)await save(final);else await chain;}finally{store.close();}}};
}
global.PablicusBotChatR2={create};
})(window);
