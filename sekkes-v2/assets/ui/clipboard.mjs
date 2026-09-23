export async function copyText(text){
 try{await navigator.clipboard.writeText(text);return}catch{}
 const selected=document.activeElement,field=document.createElement('textarea');field.value=text;field.readOnly=true;field.style.cssText='position:fixed;top:0;left:0;opacity:0;font-size:16px';document.body.append(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);
 try{if(!document.execCommand('copy'))throw Error('COPY_FAILED')}finally{field.remove();selected?.focus?.({preventScroll:true})}
}
