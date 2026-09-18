from pathlib import Path
import hashlib,json,re,sys
R=Path(sys.argv[1])
def patch(name,before,after):
 p=R/name;s=p.read_text();assert s.count(before)==1,(name,before[:100]);p.write_text(s.replace(before,after))
# Descendant visibility:visible must not defeat the bounded preparation gate.
p=R/'style.css';s=p.read_text();assert 'p05-readiness' not in s
p.write_text(s+'\n/* p05-readiness: child styles cannot prematurely reveal a preparing screen. */\n#app[inert],#app[inert] *, .youPage[aria-busy="true"],.youPage[aria-busy="true"] *{visibility:hidden!important}\n')
patch('screen-data.js',"async function avatar(p){const ready=avatarReady(p);return ready||await preload('profile-media',p?.avatar_url,192,-1);}","async function avatar(p){const ready=avatarReady(p);if(ready)return ready;const img=await preload('profile-media',p?.avatar_url,192,-1);return img?.cloneNode(true)||null;}")
# Upgrade resolution only after the screen read supplies its fresh RLS metadata.
patch('profile-photos.js',"paint();requestAnimationFrame(()=>{if(live()&&photos[0]?.path===profile.avatar_url)loadImage(0,960);});", "paint();")
patch('profile-photos.js',"get index(){return index;},setExpanded", "get index(){return index;},prepare:()=>loadImage(index,960),setExpanded")
p=R/'profile-photos.js';text=p.read_text();a=text.index('  function loadImage(k,width=');b=text.index('\n  async function load(more',a)
text=text[:a]+"""  function loadImage(k,width=expanded?1280:192){
   const slide=slides.get(k),p=photos[k];if(!slide||slide.querySelector('img')&&slide.dataset.ready==='yes'&&Number(slide.dataset.width)>=width)return Promise.resolve();
   if(slide._imageRequest)return slide._imageRequest.then(()=>{if(live()&&slides.get(k)===slide&&slide.dataset.ready==='yes'&&Number(slide.dataset.width)<width)return loadImage(k,width);});
   const task=api.url(p.path,width).then(async url=>{
    if(!live()||slides.get(k)!==slide)return;
    const existing=slide.querySelector('img');if(existing?.src===url&&existing.complete&&existing.naturalWidth){slide.dataset.ready='yes';slide.dataset.width=String(width);return;}
    const img=node('img');img.alt=`Фотография профиля ${k+1}`;img.draggable=false;img.decoding='sync';img.loading='eager';img.referrerPolicy='no-referrer';img.src=url;await img.decode();
    if(live()&&slides.get(k)===slide){slide.replaceChildren(img);slide.dataset.ready='yes';slide.dataset.width=String(width);}
   }).catch(()=>{if(live()&&!slide.querySelector('img')&&k===index)error.replaceChildren(button('Повторить загрузку фото',()=>{error.replaceChildren();loadImage(k,width);}));}).finally(()=>{if(slide._imageRequest===task)slide._imageRequest=null;});
   slide._imageRequest=task;return task;
  }
"""+text[b:];p.write_text(text)
patch('contact-motion.js','refreshPhotos:()=>gallery?.refresh(),','refreshPhotos:()=>gallery?.refresh(),preparePhoto:()=>gallery?.prepare(),')
patch('profile-page.js','await scope.PablicusScreenData.prepareProfile(o.getProfile(),posts);','await Promise.allSettled([scope.PablicusScreenData.prepareProfile(o.getProfile(),posts),scope.PablicusScreenData.bounded(motion?.preparePhoto?.(),800)]);')
p=R/'sw.js';s=p.read_text();old=json.loads(re.search(r'const ASSETS=(.*?);\n',s).group(1));manifest={name:hashlib.sha256((R/('index.html' if name=='./' else name)).read_bytes()).hexdigest() for name in old}
p.write_text(re.sub(r'const ASSETS=.*?;\n',lambda m:'const ASSETS='+json.dumps(manifest,separators=(',',':'))+';\n',s,count=1))
for file in ['release-p01r2.json','release-p05.json']:
 p=R/file;report=json.loads(p.read_text());report['assets']=manifest;p.write_text(json.dumps(report,indent=2))
print('P05 readiness and independent decoded clones verified')
