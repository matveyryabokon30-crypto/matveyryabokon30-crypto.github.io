// Private, account-scoped device library. No social publishing or AI context upload.
export const mediaTypes = Object.freeze({photo:'Фото',video:'Видео',carousel:'Карусель',story:'Сторис'});
export function validateMedia(kind,files){
 if(!Object.hasOwn(mediaTypes,kind))throw Error('Выбери формат.');
 if(!files.length||files.length>(kind==='carousel'?10:1))throw Error(kind==='carousel'?'Выбери от 2 до 10 фотографий.':'Выбери один файл.');
 if(kind==='carousel'&&files.length<2)throw Error('Для карусели нужно минимум 2 фотографии.');
 for(const f of files){
  const image=['image/jpeg','image/png','image/webp','image/avif'].includes(f.type),video=['video/mp4','video/webm','video/quicktime'].includes(f.type);
  if((kind==='video'&&!video)||(['photo','carousel'].includes(kind)&&!image)||(kind==='story'&&!image&&!video))throw Error('Поддерживаются JPG, PNG, WebP, AVIF и видео MP4, WebM, MOV.');
  if(f.size>(video?100:20)*1024*1024)throw Error(video?'Видео должно быть меньше 100 МБ.':'Фото должно быть меньше 20 МБ.');
 }
 return true;
}
const emptyProfile=()=>({name:'',bio:'',city:'',interests:'',avatar:null,posts:[]});
const metaKey=uid=>['profile-metadata-v2',uid];
const assetKey=(uid,id)=>['profile-media-v2',uid,id];
const requestResult=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
// Existing v1 Blob records are read-only recovery data. Saving text NEVER puts
// those Blobs back over their source key (WebKit bug 240216). New media are
// immutable byte records; metadata contains references, not live File handles.
export function openProfileStore(factory=globalThis.indexedDB){
 let dbPromise;const references=new WeakMap();
 function db(){if(!factory)return Promise.reject(Error('Хранилище устройства недоступно.'));return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=factory.open('sekkes-profile-device-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('profiles');r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>{dbPromise=null;reject(r.error);};r.onblocked=()=>reject(Error('Закрой другие вкладки SEKKES и повтори.'));}));}
 function remember(blob,uid,ref){if(blob instanceof Blob)references.set(blob,{uid,ref});return blob;}
 function tagLegacy(value,uid){
  if(value.avatar)remember(value.avatar,uid,{legacy:'avatar'});
  for(const post of value.posts||[])post.files.forEach((blob,index)=>remember(blob,uid,{legacy:'post',id:post.id,index}));
  return value;
 }
 return {
  async load(uid){
   if(!uid)return null;const d=await db(),s=d.transaction('profiles','readonly').objectStore('profiles');
   const [old,meta]=await Promise.all([requestResult(s.get(uid)),requestResult(s.get(metaKey(uid)))]);
   const legacy=tagLegacy(old||emptyProfile(),uid);if(!meta)return legacy;
   if(meta.schema!==2)throw Error('Эта версия профиля не поддерживается. Обновление приложения загрузится автоматически.');
   const assets=new Map();
   async function hydrate(ref){
    if(!ref)return null;
    if(ref.legacy){const blob=ref.legacy==='avatar'?legacy.avatar:legacy.posts.find(p=>p.id===ref.id)?.files[ref.index];if(!(blob instanceof Blob))throw Error('Не удалось прочитать материал. Исходные данные не удалены.');return remember(blob,uid,ref);}
    if(!ref.asset)throw Error('Повреждена ссылка на материал профиля.');
    if(!assets.has(ref.asset))assets.set(ref.asset,(async()=>{const record=await requestResult(d.transaction('profiles','readonly').objectStore('profiles').get(assetKey(uid,ref.asset)));if(!(record?.bytes instanceof ArrayBuffer))throw Error('Не удалось прочитать материал. Исходные данные не удалены.');return remember(new Blob([record.bytes],{type:record.type}),uid,ref);})());
    return assets.get(ref.asset);
   }
   const avatar=await hydrate(meta.avatar),posts=[];
   for(const post of meta.posts||[])posts.push({...post,files:await Promise.all(post.files.map(hydrate))});
   const {schema,...fields}=meta;return {...fields,avatar,posts};
  },
  async save(uid,value){
   if(!uid)throw Error('Сначала войди в аккаунт.');
   const d=await db(),pending=[],prepared=new Map();
   async function reference(blob){
    if(!blob)return null;
    if(!(blob instanceof Blob))throw Error('Материал не является файлом. Исходные данные не изменены.');
    const known=references.get(blob);if(known?.uid===uid)return known.ref;
    if(prepared.has(blob))return prepared.get(blob);
    const ref={asset:crypto.randomUUID()};prepared.set(blob,ref);
    // Complete file IO BEFORE opening the write transaction. Failure leaves
    // both the previous metadata and every existing media record unchanged.
    const bytes=await blob.arrayBuffer();if(bytes.byteLength!==blob.size)throw Error('Файл прочитан не полностью. Повтори выбор файла.');
    pending.push({blob,ref,record:{bytes,type:blob.type,name:blob.name||''}});return ref;
   }
   const avatar=await reference(value.avatar),posts=[];
   for(const post of value.posts||[]){const files=[];for(const blob of post.files)files.push(await reference(blob));posts.push({...post,files});}
   const meta={...value,schema:2,avatar,posts};
   await new Promise((resolve,reject)=>{const tx=d.transaction('profiles','readwrite'),s=tx.objectStore('profiles');
    const retained=new Set([meta.avatar,...meta.posts.flatMap(p=>p.files)].filter(r=>r?.asset).map(r=>r.asset));
    const prior=s.get(metaKey(uid));prior.onsuccess=()=>{const old=prior.result;if(!old)return;for(const ref of [old.avatar,...(old.posts||[]).flatMap(p=>p.files)])if(ref?.asset&&!retained.has(ref.asset))s.delete(assetKey(uid,ref.asset));};
    for(const item of pending)s.put(item.record,assetKey(uid,item.ref.asset));
    s.put(meta,metaKey(uid));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Не удалось сохранить.'));
   });
   for(const item of pending)remember(item.blob,uid,item.ref);
  },
  close(){dbPromise?.then(d=>d.close()).catch(()=>{});}
 };
}
