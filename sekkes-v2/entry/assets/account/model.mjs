export const PROFILE_FIELDS={name:60,surname:60,username:40,pronouns:40,bio:280,birthday:10,gender:40,city:80,interests:160,category:80};
export const EXTRA_FIELDS={headline:200,specialization:2000,education:2000,experience:2000,phone:40,contactEmail:254,website:500};
export const ROLES=[['client','Для себя'],['psychologist','Психолог'],['student','Студент'],['university','Представитель университета'],['center','Представитель центра'],['clinic','Представитель клиники'],['facilitator','Ведущий практик']];
export const DEFAULTS={roles:['client'],activeRole:'client',theme:'system',palette:'graphite',motion:true,transparency:true,textSize:'system',font:'system',companion:true,language:'ru',timezone:'Europe/Moscow'};
export const PREFERENCES=['theme','palette','motion','transparency','textSize','font','companion'];
export function validSnapshot(value){return value&&['profile','account'].every(k=>value[k]&&Number.isSafeInteger(value[k].revision)&&value[k].revision>=0&&value[k].data&&typeof value[k].data==='object'&&!Array.isArray(value[k].data));}
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export function mergePatch(base,desired,remote){
 const patch={};for(const [key,value] of Object.entries(desired)){
  if(equal(base[key],value))continue;
  if(!equal(remote[key],base[key])&&!equal(remote[key],value))throw Object.assign(Error('Это поле изменено на другом устройстве. Обновите анкету и повторите правку.'),{code:'FIELD_CONFLICT',field:key});
  if(!equal(remote[key],value))patch[key]=value;
 }return patch;
}
export function accountMessage(error){
 if(error?.code==='FIELD_CONFLICT')return error.message;
 if(['ACCOUNT_CONFLICT','PROFILE_CONFLICT'].includes(error?.message))return 'Данные изменились на другом устройстве. Обновите анкету перед сохранением.';
 if(error?.code==='AUTH_CHANGED')return 'Аккаунт изменился. Откройте страницу заново.';
 if(error?.message==='ACCOUNT_INVALID'||error?.message==='PROFILE_INVALID')return 'Проверьте заполненные поля и повторите сохранение.';
 return 'Не удалось синхронизировать. Ваши правки сохранены в форме; проверьте соединение и повторите.';
}
