const CONSENT='sekkes-s2-openai-20260918';
const messages={MEMORY_LIMIT:'Можно сохранить до 10 фактов.',AUTH_REQUIRED:'Войди в SEKKES ещё раз.',NOT_FOUND:'Этот факт уже удалён. Открой память заново.'};
export class MemoryPanel {
 constructor({root,api,onChange=()=>{}}){Object.assign(this,{root,api,onChange});this.closed=false;this.busy=false;}
 close(){this.closed=true;this.root.replaceChildren();}
 el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
 async open(){
  this.root.replaceChildren(this.el('h2','Моя память'));this.root.firstChild.id='dialogTitle';
  this.root.append(this.el('p','Здесь только факты, которые ты сохраняешь самостоятельно. До 10 фактов, каждый — до 400 символов. Разговоры автоматически сюда не записываются.'));
  this.status=this.el('p','Загрузка…');this.status.setAttribute('role','status');this.root.append(this.status);
  try{const r=await this.api.request('memory');if(this.closed)return;this.items=r.items;this.render();}catch(e){if(!this.closed)this.status.textContent=messages[e.code]||'Не удалось загрузить память. Закрой окно и попробуй снова.';}
 }
 render(){
  this.list?.remove();this.form?.remove();this.status.textContent=this.items.length?'':'Пока нет сохранённых фактов.';
  this.list=this.el('div');this.root.append(this.list);
  for(const item of this.items){const card=this.el('div',null,'memory-card');card.append(this.el('p',item.text));
   const edit=this.el('button','Изменить','text-link');edit.type='button';edit.onclick=()=>{if(!this.busy)this.editor(item);};
   const del=this.el('button','Удалить','text-link');del.type='button';del.onclick=()=>{if(this.busy)return;del.disabled=true;const yes=this.el('button','Подтвердить удаление','rounded-action');yes.type='button';const no=this.el('button','Отмена','text-link');no.type='button';no.onclick=()=>{yes.remove();no.remove();del.disabled=false;};yes.onclick=()=>this.mutate({method:'DELETE',body:{id:item.id,consent:CONSENT}});card.append(yes,no);};
   card.append(edit,del);this.list.append(card);
  }
  this.editor();
 }
 editor(item){
  this.form?.remove();this.form=this.el('form');const label=this.el('label',item?'Исправить факт':'Новый факт','s2-label');const input=this.el('textarea');input.maxLength=400;input.required=true;input.rows=3;input.value=item?.text||'';label.append(input);
  const save=this.el('button',item?'Сохранить исправление':'Сохранить в памяти','rounded-action primary');save.type='submit';
  this.form.append(label,save);if(item){const cancel=this.el('button','Отмена','text-link');cancel.type='button';cancel.onclick=()=>this.editor();this.form.append(cancel);}
  this.form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;this.mutate({method:'POST',body:{action:item?'update':'save',...(item?{id:item.id}:{}),text:input.value.trim(),confirm:true,consent:CONSENT}});};this.root.append(this.form);
 }
 async mutate(options){
  if(this.busy||this.closed)return;this.busy=true;this.root.querySelectorAll('button,textarea').forEach(e=>e.disabled=true);this.status.textContent='Сохраняю…';
  try{await this.api.request('memory',options);if(this.closed)return;this.onChange();const r=await this.api.request('memory');if(this.closed)return;this.items=r.items;this.render();this.status.textContent=options.method==='DELETE'?'Факт удалён.':'Сохранено в аккаунте.';}
  catch(e){if(!this.closed)this.status.textContent=messages[e.code]||'Не удалось подтвердить изменение. Открой память заново, чтобы проверить результат.';}
  finally{this.busy=false;if(!this.closed)this.root.querySelectorAll('button,textarea').forEach(e=>e.disabled=false);}
 }
}
