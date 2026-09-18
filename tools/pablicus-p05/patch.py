from pathlib import Path
import hashlib,json,re,sys
R=Path(sys.argv[1])
def patch(f,a,b,n=1):
 p=R/f;s=p.read_text();assert s.count(a)==n,(f,s.count(a),a[:120]);p.write_text(s.replace(a,b))
patch('index.html','<script src="home-data.js"></script>','<script src="home-data.js"></script><script src="screen-data.js"></script>')
patch('index.html','content="P04"','content="P05"')
patch('app.js',"VERSION='P04'","VERSION='P05'")
patch('media-cache.js','homeProofHits:0};','homeProofHits:0,screenProofHits:0};')
patch('media-cache.js','    let lease=await imageLease(s,bucket,path,width,ttl,priority);assert(s);', '''    const screenProof=g.PablicusScreenData?.proof(bucket,path,width);
    if(screenProof){const local=await diskRead;assert(s);const current=g.PablicusScreenData?.proof(bucket,path,width);
     if(local&&current&&current.object_id===screenProof.object_id&&current.version===screenProof.version&&local.sourceVersion===screenProof.version){stats.diskHits++;stats.screenProofHits++;return remember(key,local.blob,Math.min(screenProof.until,expiry),s);}
    }
    let lease=await imageLease(s,bucket,path,width,ttl,priority);assert(s);''')
# Acquire message records and their existing Storage-RLS metadata in one read.
old="const r=navigator.onLine?await sb.from('messages').select('*').eq('conversation_id',d.id).order('server_seq',{ascending:false}).limit(150):{data:[],error:null};"
new="""const r=navigator.onLine?await (async()=>{try{const boot=await PablicusScreenData.history(d.id);return{data:boot.messages,error:null};}catch{if(!isCurrent()||user?.id!==uid)return{data:[],error:null};return await sb.from('messages').select('*').eq('conversation_id',d.id).order('server_seq',{ascending:false}).limit(150);}})():{data:[],error:null};"""
patch('app.js',old,new)
patch('app.js','await PablicusChat.open(uid,d.id,rows.map(mapped));','await PablicusChat.open(uid,d.id,rows.map(mapped));await window.PablicusScreenData.prepareConversation(()=>isCurrent()&&ep===epoch&&user?.id===uid);')
# Legacy image messages also share the bounded first-frame completion promise.
patch('app.js',"const im=el('img','messageImage');im.alt='Фото';im.loading='lazy';", "const im=el('img','messageImage');im.alt='Фото';im.loading='eager';im.decoding='sync';")
patch('app.js',"signedUrl(r.attachment_path,{type:'image',width:960}).then(u=>{if(im.isConnected){im.src=u;fallback.remove()}}).catch(()=>{fallback.textContent='Фото · нажмите, чтобы повторить'})", "im._pablicusReady=signedUrl(r.attachment_path,{type:'image',width:960}).then(async u=>{if(im.isConnected){im.src=u;await im.decode();if(im.isConnected)fallback.remove();}}).catch(()=>{fallback.textContent='Фото · нажмите, чтобы повторить'})")
# Rich photos resolve the real image.decode() promise, not merely the URL.
p=R/'rich-message.js';s=p.read_text();a=s.index('    async function loadImage(item) {');b=s.index('\n    async function loadVideo(item)',a)
s=s[:a]+'''    function loadImage(item) {
      if(disposed||!isLiveRow()||item.status==='ready')return Promise.resolve();
      if(item.loadingPromise)return item.loadingPromise;
      item.loadingPromise=(async()=>{
       item.status='loading';item.button.classList.remove('richMediaError');item.statusNode.textContent='Загрузка фото…';observer?.unobserve(item.button);
       try{
        if(typeof options.resolveUrl!=='function')throw Error('Media resolver is unavailable');
        const warm=options.peekUrl?.(item.block.path||item.block.assetId||item.block.id,item.block),box=item.button.getBoundingClientRect();
        const resolved=warm||await options.resolveUrl(item.block.path||item.block.assetId||item.block.id,item.block,{priority:box.bottom>0&&box.top<innerHeight?0:2});
        if(disposed||!isLiveRow())return;const url=safeResolvedUrl(resolved);if(!url)throw Error('Invalid media URL');
        item.image.src=url;await item.image.decode();if(disposed||!isLiveRow())return;
        item.status='ready';item.button.classList.add('richImageReady');item.statusNode.textContent='';releaseObserverWhenFinished();notifyResize();
       }catch{imageFailed(item);}
      })();item.loadingPromise.finally(()=>{item.loadingPromise=null;}).catch(()=>{});return item.loadingPromise;
    }
''' + s[b:]
s=s.replace('    root.activate = activate;','''    root.prepareVisible = rect => {
      if(disposed||!isLiveRow())return Promise.resolve();
      return Promise.allSettled(images.filter(item=>{const r=item.button.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>rect.top&&r.top<rect.bottom;}).slice(0,12).map(loadImage));
    };
    root.activate = activate;''');p.write_text(s)
# Profile: keep data access parallel, reuse own avatar from home, prepare only
# the first six photos. Larger collections keep the existing pagination path.
p=R/'profile-page.js';s=p.read_text();a=s.index('  function avatar(path,cls=');b=s.index('\n  async function fetchAll(',a)
s=s[:a]+'''  function avatar(path,cls='youAvatar'){
   const p=o.getProfile(),face=el('div',cls,path?'':(p.display_name||p.username||'?').slice(0,1).toUpperCase());
   const ready=path&&scope.PablicusScreenData.avatarReady(p);if(ready){ready.alt='Фотография профиля';face.append(ready);return face;}
   if(path){const t=serial;scope.PablicusScreenData.avatar(p).then(img=>{if(img&&active(t)&&face.isConnected){img.alt='Фотография профиля';face.replaceChildren(img);}}).catch(()=>{});}return face;
  }
  async function load(){
   const t=++serial;loaded=false;root.style.visibility='hidden';root.setAttribute('aria-busy','true');render();
   try{
    let data;try{const d=await scope.PablicusScreenData.profile();data=[d.details,d.posts_more?await fetchAll('pablicus_profile_posts'):d.posts,d.albums_more?await fetchAll('pablicus_profile_albums'):d.albums];}
    catch{if(!active(t))return;data=await Promise.all([result(sb.from('pablicus_profile_details').select('*').eq('owner_id',uid).maybeSingle()),fetchAll('pablicus_profile_posts'),fetchAll('pablicus_profile_albums')]);}
    if(!active(t))return;[details,posts,albums]=data;details||={};
    await scope.PablicusScreenData.prepareProfile(o.getProfile(),posts);if(!active(t))return;loaded=true;if(panel===null)render();
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
   }catch(e){if(!active(t)||panel!==null)return;const content=root.querySelector('.youContent');content?.replaceChildren(el('p','youMuted','Не удалось загрузить профиль.'),button('Повторить',load));}
   finally{if(active(t)){root.style.visibility='';root.removeAttribute('aria-busy');}}
  }
''' + s[b:];p.write_text(s)
# Already decoded publication thumbnails are mounted directly.
patch('profile-page.js',"const item=el(media.type==='video'?'video':'img');", "const item=media.type==='image'?(scope.PablicusScreenData.image('profile-media',media.path,960)||el('img')):el('video');")
patch('profile-page.js',"item.loading='lazy'", "item.loading=item.src?'eager':'lazy'")
patch('profile-page.js',"resolve(media.path).then(url=>", "(item.src?Promise.resolve(item.src):resolve(media.path)).then(url=>")
patch('profile-page.js',"item.src=url;if(media.type==='video')", "if(item.src!==url)item.src=url;if(media.type==='video')")
patch('profile-page.js',"const media=el(item.type==='video'?'video':'img');", "const media=item.type==='image'?(scope.PablicusScreenData.image('profile-media',item.path,960)||el('img')):el('video');")
patch('profile-page.js',"resolve(item.path).then(url=>", "(media.src?Promise.resolve(media.src):resolve(item.path)).then(url=>")
patch('profile-page.js',"media.src=url;if(item.type==='video')", "if(media.src!==url)media.src=url;if(item.type==='video')")
# Same carousel code owns both personal and contact headers. Keep the current
# photograph attached while a larger one decodes. Do not load the whole album.
patch('profile-photos.js', 'async function url(path){', 'async function url(path,width=1280){')
patch('profile-photos.js', "resolve('profile-media',path,{type:'image'})", "resolve('profile-media',path,{type:'image',width})")
patch('profile-photos.js',"for(let k=Math.max(0,index-1);k<Math.min(photos.length,index+2);k++)loadImage(k);", "for(let k=expanded?Math.max(0,index-1):index;k<Math.min(photos.length,expanded?index+2:index+1);k++)loadImage(k);")
patch('profile-photos.js',"if(initialFace&&photos[0]?.path===profile.avatar_url&&!initialFace.parentNode)slides.get(0)?.append(initialFace);paint();", "if(initialFace&&photos[0]?.path===profile.avatar_url&&!initialFace.parentNode){const slide=slides.get(0);slide?.append(initialFace);const img=initialFace.querySelector('img');if(slide&&img?.complete&&img.naturalWidth){slide.dataset.ready='yes';slide.dataset.width='192';}}paint();requestAnimationFrame(()=>{if(live()&&photos[0]?.path===profile.avatar_url)loadImage(0,960);});")
p=R/'profile-photos.js';s=p.read_text();a=s.index('  function loadImage(k){');b=s.index('\n  async function load(more',a)
s=s[:a]+'''  function loadImage(k,width=expanded?1280:192){
   const slide=slides.get(k),p=photos[k];if(!slide||slide.dataset.loading==='yes'||slide.querySelector('img')&&slide.dataset.ready==='yes'&&Number(slide.dataset.width)>=width)return;
   slide.dataset.loading='yes';api.url(p.path,width).then(async url=>{
    if(!live()||slides.get(k)!==slide)return;
    const existing=slide.querySelector('img');if(existing?.src===url&&existing.complete&&existing.naturalWidth){slide.dataset.width=String(width);return;}
    const img=node('img');img.alt=`Фотография профиля ${k+1}`;img.draggable=false;img.decoding='sync';img.loading='eager';img.referrerPolicy='no-referrer';img.src=url;await img.decode();
    if(live()&&slides.get(k)===slide){slide.replaceChildren(img);slide.dataset.ready='yes';slide.dataset.width=String(width);}
   }).catch(()=>{if(live()&&!slide.querySelector('img')&&k===index)error.replaceChildren(button('Повторить загрузку фото',()=>{error.replaceChildren();loadImage(k,width);}));}).finally(()=>{delete slide.dataset.loading;});
  }
''' + s[b:];p.write_text(s)
# Contacts and QR surfaces reuse their already authorized/decoded home avatar.
p=R/'contact-card.js';s=p.read_text();a=s.index("  function face(p,s,cls='contactFace'){");b=s.index('\n  function row(',a)
s=s[:a]+'''  function face(p,s,cls='contactFace'){
   const n=el('div',cls,p.avatar_url?'':initial(nameOf(s.data)));const ready=p.avatar_url&&scope.PablicusScreenData.avatarReady(p);
   if(ready){ready.alt='Фотография профиля';n.append(ready);return n;}
   if(p.avatar_url)scope.PablicusScreenData.avatar(p).then(img=>{if(img&&live(s)&&n.isConnected){img.alt='Фотография профиля';n.replaceChildren(img);}}).catch(()=>{});return n;
  }
''' + s[b:];p.write_text(s)
# Release shell only. Push-handler bytes and the working P04 home remain unchanged.
p=R/'sw.js';s=p.read_text();old=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));names=list(old)+['screen-data.js'];manifest={f:hashlib.sha256((R/('index.html' if f=='./' else f)).read_bytes()).hexdigest() for f in names}
s=re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1);s=s.replace("const VERSION='pablicus-shell-p04-20260918';","const VERSION='pablicus-shell-p05-20260918';");p.write_text(s)
report=json.loads((R/'release-p04.json').read_text());report.update(release='P05',base='48a2bc424bbc1fa0e5d630e970d2cb5611c877e3',assets=manifest)
(R/'release-p01r2.json').write_text(json.dumps(report,indent=2));(R/'release-p05.json').write_text(json.dumps(report,indent=2))
print('P05 candidate:',len(manifest),'assets; P04 home code unchanged')
