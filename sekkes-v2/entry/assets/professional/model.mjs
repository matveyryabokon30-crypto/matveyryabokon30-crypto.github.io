import {SCHEMA} from './schema.mjs?v=5470cc2d1e171571ca92b3ee0fea71958c402549628033ae8f9f1e79b08248b0';
export {SCHEMA};
export const STATES={draft:'Черновик',submitted:'Отправлена на проверку',in_review:'На проверке',needs_changes:'Нужны уточнения',approved:'Анкета проверена',suspended:'Публикация приостановлена'};
export const DOC_STATES={pending:'Загрузка не завершена',ready:'Загружен',withdrawn:'В архиве'};
export const DOC_DECISIONS={unchecked:'Ожидает проверки',accepted:'Проверен модератором',rejected:'Нужно заменить'};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function mergeData(base,desired,remote,path=''){
 const result=structuredClone(remote||{});
 for(const[key,value]of Object.entries(desired)){
  const old=base?.[key],fresh=remote?.[key],field=path?path+'.'+key:key;
  if(equal(old,value))continue;
  if(object(value)&&(!old||object(old))&&(!fresh||object(fresh)))result[key]=mergeData(old||{},value,fresh||{},field);
  else{if(!equal(old,fresh)&&!equal(value,fresh))throw Object.assign(Error('PROFILE_FIELD_CONFLICT'),{field});result[key]=structuredClone(value);}
 }
 return result;
}
export function missingFields(kind,data){
 const spec=SCHEMA.kinds.find(x=>x.id===kind),missing=[];
 for(const s of spec.sections){const rows=s.repeat?(data[s.id]||[]):[data[s.id]||{}];rows.forEach((r,i)=>{for(const f of s.fields)if(f.required&&(!r[f.id]||(typeof r[f.id]==='string'&&!r[f.id].trim())||(Array.isArray(r[f.id])&&!r[f.id].length)))missing.push(s.title+(s.repeat?' '+(i+1):'')+' · '+f.label);});}
 if(kind==='psychologist'&&!(data.education||[]).some(x=>['higher','retraining'].includes(x.level)))missing.push('Профильное образование');
 if(kind==='university'&&!(data.programs||[]).length)missing.push('Учебная программа');
 if(['university','clinic'].includes(kind)&&!(data.licenses||[]).length)missing.push('Лицензия');
 return missing;
}
export function message(e){return ({AUTH_REQUIRED:'Войдите заново, чтобы продолжить.',AUTH_CHANGED:'Аккаунт изменился. Откройте кабинет заново.',PROFILE_FIELD_CONFLICT:'Это поле уже изменено на другом устройстве. Ваш черновик сохранён. Загрузите новую версию или перенесите в неё правки.',PROFILE_CONFLICT:'Анкета изменилась на другом устройстве. Обновите её и повторите.',REQUIRED_FIELDS:'Заполните обязательные поля.',EDUCATION_REQUIRED:'Добавьте профильное образование.',PROGRAM_REQUIRED:'Добавьте учебную программу.',LICENSE_REQUIRED:'Добавьте сведения о лицензии.',DOCUMENTS_REQUIRED:'Загрузите все обязательные документы.',UPLOAD_PENDING:'Есть незавершённая загрузка. Завершите её или уберите документ из анкеты.',DOCUMENT_NOT_UPLOADED:'Файл пока не загружен. Выберите его ещё раз и повторите загрузку.',DOCUMENT_REVIEW_REQUIRED:'Сначала проверьте каждый действующий документ.',SUBMISSION_REQUIRED:'Анкета должна быть отправлена на проверку.',REVIEW_INVALID:'Для возврата или приостановки укажите причину.',SELLER_REQUIRED:'Заполните сведения о продавце и подтвердите права на материалы.',MEDICAL_CLINIC_REQUIRED:'Медицинские услуги оформляются в анкете клиники с лицензией.',PROFILE_SUSPENDED:'Анкета приостановлена. Обратитесь к команде проверки.',DOCUMENT_INVALID:'Выберите PDF, JPEG или PNG до 10 МБ.',DOCUMENT_LIMIT:'Лимит: 20 действующих документов на анкету.',PROFILE_LIMIT:'Лимит: 20 анкет на аккаунт.',PRICE_INVALID:'Стоимость укажите числом, например 2500 или 2500,50.',EMAIL_INVALID:'Проверьте контактную почту.',URL_INVALID:'Ссылка должна начинаться с https:// или http://.',FORM_INVALID:'Проверьте формат и длину полей.',REVIEWER_REQUIRED:'Проверка доступна уполномоченной команде.'})[e?.message||e?.code]||'Не удалось связаться с сервером. Черновик сохранён на этом устройстве; повторите действие.';}
export async function inspectDocument(file){
 const bytes=new Uint8Array(await file.arrayBuffer());
 const mime=bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':null;
 if(!mime||!bytes.length||bytes.length>10485760||file.name.length>180||/[\x00-\x1f/\\]/.test(file.name))throw Error('DOCUMENT_INVALID');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');return{mime,sha256,bytes:bytes.length,name:file.name};
}
