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
export function openProfileStore(factory=globalThis.indexedDB){
 let dbPromise;
 function db(){if(!factory)return Promise.reject(Error('Хранилище устройства недоступно.'));return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=factory.open('sekkes-profile-device-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('profiles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Закрой другие вкладки SEKKES и повтори.'));}));}
 return {
  async load(uid){if(!uid)return null;const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('profiles','readonly'),r=tx.objectStore('profiles').get(uid);r.onsuccess=()=>resolve(r.result||{name:'',bio:'',city:'',interests:'',avatar:null,posts:[]});r.onerror=()=>reject(r.error);});},
  async save(uid,value){if(!uid)throw Error('Сначала войди в аккаунт.');const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('profiles','readwrite');tx.objectStore('profiles').put(value,uid);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Не удалось сохранить.'));});},
  close(){dbPromise?.then(d=>d.close()).catch(()=>{});}
 };
}
