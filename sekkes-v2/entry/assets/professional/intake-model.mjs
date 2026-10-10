import {SCHEMA,mergeData} from './model.mjs?v=733ad495211fd9070f41e4b72313613b5025a6234e97be0f25373845ab316974';
import {INTAKE} from './intake-contract.mjs?v=623ecbf30a0165381a720e774824087401644609ab16e4fd0593986569a5bc70';
export {INTAKE};
export const spec=SCHEMA.kinds.find(k=>k.id==='psychologist');
export const fieldAt=path=>{const [section,key]=path.split('.');return spec.sections.find(s=>s.id===section)?.fields.find(f=>f.id===key);};
export function appearance(data){return Object.fromEntries(['style','palette','font','background'].map(key=>{const choices=INTAKE[key==='style'?'styles':key==='palette'?'palettes':key==='font'?'fonts':'backgrounds'];return[key,choices.find(x=>x.id===data.appearance?.[key])?.id||choices[0].id];}));}
export function history(data){try{const h=JSON.parse(data.assistant?.history||'[]');return Array.isArray(h)?h.filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string'):[];}catch{return [];}}
export function appendHistory(data,messages){const value=JSON.stringify([...history(data),...messages]);if(value.length>60000)throw Error('ASSISTANT_HISTORY_FULL');return {...data,assistant:{...data.assistant,history:value}};}
export function filled(value){return typeof value==='string'?!!value.trim():Array.isArray(value)?value.length>0:value===true;}
export function completion(step,data,documents=[]){
 if(step.id==='documents')return documents.some(d=>d.kind==='diploma'&&d.state==='ready');
 if(step.id==='appearance')return !!data.appearance?.style;
 if(step.repeat){const s=spec.sections.find(s=>s.id===step.repeat),rows=data[step.repeat]||[];return !!rows.length&&rows.every(row=>s.fields.filter(f=>f.required).every(f=>filled(row[f.id])));}
 const required=(step.fields||[]).filter(p=>fieldAt(p)?.required);return required.length?required.every(p=>{const[a,b]=p.split('.');return filled(data[a]?.[b]);}):(step.fields||[]).some(p=>{const[a,b]=p.split('.');return filled(data[a]?.[b]);});
}
// Server proposes only editable, schema-backed strings. It never grants review,
// consent, publication, marketplace rights or arbitrary object keys.
export function validateProposal(changes,data){
 if(!Array.isArray(changes)||changes.length>32)throw Error('ASSISTANT_INVALID');
 const seen=new Set();return changes.map(c=>{
  const s=spec.sections.find(x=>x.id===c.section),f=s?.fields.find(x=>x.id===c.field);
  if(!s||!f||['assistant','declarations','market'].includes(s.id)||f.type==='bool'||f.type==='multi'||typeof c.value!=='string'||c.value.length>f.max)throw Error('ASSISTANT_INVALID');
  if(f.type==='select'&&c.value&&!f.options.some(x=>x.id===c.value))throw Error('ASSISTANT_INVALID');
  if(f.type==='money'&&c.value&&!/^\d{1,9}([.,]\d{1,2})?$/.test(c.value))throw Error('ASSISTANT_INVALID');
  if(f.type==='email'&&c.value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value))throw Error('ASSISTANT_INVALID');
  if(f.type==='url'&&c.value&&!/^https?:\/\/[^\s]+$/.test(c.value))throw Error('ASSISTANT_INVALID');
  if(!Number.isInteger(c.row)||(s.repeat?(c.row<0||c.row>=(data[s.id]||[]).length+1||c.row>=30):c.row!==-1))throw Error('ASSISTANT_INVALID');
  const path=[s.id,c.row,f.id].join('.');if(seen.has(path))throw Error('ASSISTANT_INVALID');seen.add(path);return {section:s.id,field:f.id,row:c.row,value:c.value,label:f.label};
 });
}
export function applyProposal(data,changes){const next=structuredClone(data);for(const c of validateProposal(changes,data)){if(c.row===-1){next[c.section]||={};next[c.section][c.field]=c.value;}else{next[c.section]||=[];next[c.section][c.row]||={};next[c.section][c.row][c.field]=c.value;}}return next;}
export function rebaseProposal(snapshot,current,changes){return mergeData(snapshot,applyProposal(snapshot,changes),current);}
export function publicPage(data){return {name:data.identity?.name||'Ваше имя',city:data.identity?.city||'',about:data.identity?.about||'',format:data.identity?.format||'',methods:data.practice?.methods||'',topics:data.practice?.topics||'',education:(data.education||[]).map(x=>({institution:x.institution,program:x.program,year:x.year})),services:(data.services||[]).map(x=>({title:x.title,description:x.description,duration:x.duration,price:x.price,currency:x.currency})),products:(data.products||[]).map(x=>({title:x.title,description:x.description,price:x.price}))};}
