import {el} from './components.mjs';
export const ASSESSMENT_SCHEMA='ai-marius-assessment-v1';
export const VERDICTS=Object.freeze({pending:'Нужна проверка',passed:'Пройдено',failed:'Не пройдено'});
export function readAssessment(document){
 if(document?.kind!=='evaluation'||typeof document.content!=='string')return null;
 try{const v=JSON.parse(document.content);if(v.schema!==ASSESSMENT_SCHEMA||v.method!=='owner_manual'||!Object.hasOwn(VERDICTS,v.verdict)||['question','expected','actual','notes'].some(k=>typeof v[k]!=='string'))return null;return v;}catch{return null;}
}
export function assessmentSource(data,id){
 if(id.startsWith('run:')){const r=data.training_runs?.find(r=>'run:'+r.id===id);if(!r||r.hidden||r.state!=='completed'||!r.reply)return null;return {question:r.prompt||r.request_text||'',actual:r.reply,source:{type:'training_run',id:r.id,at:r.created_at||null}};}
 if(id.startsWith('turn:')||id.startsWith('trial:')){const t=data.turns?.find(t=>id.split(':').slice(1).join(':')===t.id);if(!t||t.status!=='completed'||!t.reply)return null;return {question:t.user_text||'',actual:t.reply,source:{type:'admin_turn',id:t.id,at:t.answered_at||t.created_at||null}};}
 return null;
}
export function encodeAssessment(value){
 if(!value.title?.trim())throw Error('Укажи название проверки.');
 if(!value.question?.trim()||!value.expected?.trim()||!value.actual?.trim())throw Error('Заполни вопрос, ожидаемый результат и полученный ответ.');
 if(!Object.hasOwn(VERDICTS,value.verdict))throw Error('Выбери результат проверки.');
 const data={schema:ASSESSMENT_SCHEMA,question:value.question,expected:value.expected,actual:value.actual,verdict:value.verdict,notes:value.notes||'',source:value.source||null,method:'owner_manual'};
 const content=JSON.stringify(data);if(value.title.length>160||content.length>30000)throw Error('Проверка слишком большая. Сократи текст до 30 000 символов.');
 return {title:value.title.trim(),content};
}
export function assessmentEditor({value={},versions=[],onDirty=()=>{},onSave}){
 const form=el('form','owner-editor owner-assessment'),fields={};
 const definitions=[['title','Название проверки',false],['question','Вопрос',true],['expected','Ожидаемый результат',true],['actual','Полученный ответ',true],['notes','Комментарий к оценке',true]];
 for(const [key,label,multiline]of definitions){const wrap=el('label','owner-assessment-field'),input=el(multiline?'textarea':'input','owner-input');input.setAttribute('aria-label',label);input.maxLength=key==='title'?160:25000;if(multiline)input.rows=key==='notes'?3:5;input.value=value[key]||'';input.readOnly=Boolean(value.source&&['question','actual'].includes(key));input.required=key!=='notes';input.oninput=onDirty;fields[key]=input;wrap.append(el('span','owner-note',label),input);form.append(wrap);}
 const verdict=el('select','owner-input');verdict.setAttribute('aria-label','Результат проверки');for(const [key,label]of Object.entries(VERDICTS)){const option=el('option','',label);option.value=key;verdict.append(option)}verdict.value=value.verdict||'pending';verdict.onchange=onDirty;
 const save=el('button','owner-button','Сохранить проверку');save.type='submit';const error=el('p','owner-notice');error.setAttribute('role','status');
 form.append(el('p','owner-note','Ручная оценка владельца. Сохранение не запускает модель и не меняет поведение агента.'),verdict,error,save);
 let source=value.source||null,saving=false;
 form.addEventListener('submit',async e=>{e.preventDefault();if(saving)return;error.textContent='';
  try{const v=Object.fromEntries(Object.entries(fields).map(([k,node])=>[k,node.value]));const encoded=encodeAssessment({...v,verdict:verdict.value,source});saving=true;for(const node of form.querySelectorAll('input,textarea,select,button'))node.disabled=true;await onSave(encoded);}
  catch(e){error.textContent=e.message||'Не удалось сохранить проверку.';}
  finally{saving=false;for(const node of form.querySelectorAll('input,textarea,select,button'))node.disabled=false;}
 });
 if(versions.length){const history=el('details','owner-auto-record');history.append(el('summary','','Предыдущие версии'));for(const doc of versions){const v=readAssessment(doc);if(!v)continue;const b=el('button','owner-button',`v${doc.revision} · ${VERDICTS[v.verdict]}`);b.type='button';b.onclick=()=>{for(const [k,node]of Object.entries(fields))node.value=k==='title'?doc.title:v[k]||'';verdict.value=v.verdict;source=v.source||null;onDirty();error.textContent='Открыта старая версия. Сохранение создаст новую.';};history.append(b)}form.append(history);}
 return form;
}
