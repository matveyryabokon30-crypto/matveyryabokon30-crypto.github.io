import {chatAttachments} from './chat-attachments.mjs';
import {messageActions,deliveryMark} from './message-actions.mjs';
import {mediaView} from './attachment-view.mjs';
import {create} from './owner-workspace.mjs';
const results=[],check=(value,label)=>{results.push((value?'PASS ':'FAIL ')+label);if(!value)throw Error(label)},pause=()=>new Promise(r=>setTimeout(r,150));
const canvas=document.createElement('canvas');canvas.width=120;canvas.height=160;const g=canvas.getContext('2d');g.fillStyle='#5b9e8c';g.fillRect(0,0,120,160);g.fillStyle='#eadbae';g.fillRect(20,20,80,120);const data=canvas.toDataURL().split(',')[1],bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
const bundle={id:'photo1',mime:'image/png',name:'UUID-photo.png',data};
const form=document.querySelector('#composer'),list=document.querySelector('.messages');
let requests=0;const files=chatAttachments({composer:form,request:async()=>{requests++;return bundle},changed:()=>{},notify:console.log});
const controller=new AbortController(),actions=messageActions({signal:controller.signal,account:()=>({id:'synthetic-media18'}),notify:console.log,compose:()=>{},currentScope:()=> 'home',ownerAllowed:()=>true});
function short(){const row=document.createElement('article');row.className='message';row.innerHTML='<div class="rich-message"><p>Привет</p></div><time>17:30</time>';actions.bind(row,{id:'short',scope:'home',text:'Привет'});list.append(row);return row;}
const row=document.createElement('article');row.className='message user';row.dataset.messageId='j:turn1:user';row.innerHTML='<div class="rich-message"><p>Посмотри прикреплённые материалы.</p></div><time>17:30</time>';list.append(row);
const tiny=short();
document.querySelector('#showMenu').onclick=()=>tiny.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
try{
 const input=form.querySelector('input[type=file]'),dt=new DataTransfer();dt.items.add(new File([bytes],'UUID-photo.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change'));await pause();await pause();
 check(!!form.querySelector('.chat-attachment-chip img'),'photo thumbnail in composer');check(!form.querySelector('.chat-attachment-tray').textContent.includes('UUID'),'no technical filename in composer');
 const r=document.querySelector('#sendButton').getBoundingClientRect();check(r.width===r.height&&r.width===34,'round send control');
 files.decorate(list,[{...bundle,turn_id:'turn1'}]);await pause();await pause();check(!!row.querySelector('img'),'photo loaded automatically in chat');check(!row.textContent.includes('UUID'),'no technical filename in chat');
 check(tiny.getBoundingClientRect().height<45,'short bubble without empty footer row');
 tiny.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));const box=document.querySelector('.message-menu');check(box.getBoundingClientRect().width<=290,'compact action menu');check(box.querySelectorAll(':scope > button svg').length>=7,'action pictograms');box.querySelector('[aria-label="Больше реакций"]').click();check(box.querySelectorAll('.message-reaction-grid button').length===40,'40 additional reactions');const emoji=tiny.querySelector('.message-reaction')?.textContent==='💚'?'💙':'💚';box.querySelector('[aria-label="Реакция '+emoji+'"]').click();check(tiny.querySelector('.message-reaction').textContent===emoji,'reaction selection');
 // Recreate the row, as after history reload, without any locally selected photo.
 files.reset();row.querySelectorAll('.attachment-view').forEach(n=>n.remove());files.decorate(list,[{...bundle,turn_id:'turn1'}]);await pause();await pause();check(!!row.querySelector('img')&&requests===2,'media reloaded through authenticated request after reset');
 const video=mediaView({mime:'video/mp4'},'blob:synthetic-video');check(!!video.querySelector('video[controls]'),'video player instead of document link');
 const doc=mediaView({mime:'application/pdf',name:'Таблица.pdf'},'blob:synthetic-document');check(doc.querySelector('a').textContent==='Таблица.pdf','document retains readable filename');
 const state={ownerRequest:async path=>path==='content'?new Blob([bytes],{type:'image/png'}):{active:true,turns:[{id:'owner1',status:'completed',user_text:'Разбери прикреплённые материалы.',attachments:['photo1'],created_at:new Date().toISOString(),answered_at:new Date().toISOString(),reply:'Вижу фото.'}],media:[bundle],documents:[],costs:{}}};
 const owner=create({runtime:()=>state,account:{id:'synthetic'},bindMessage:()=>{},notify:console.log});document.querySelector('#ownerHost').append(owner.node);await owner.refresh();for(let i=0;i<30&&!owner.node.querySelector('.owner-user img');i++)await pause();check(!!owner.node.querySelector('.owner-user img'),'admin photo auto preview');check(!owner.node.querySelector('.owner-user').textContent.includes('UUID'),'admin hides photo filename');
 const oi=owner.node.querySelector('input[type=file]');oi.files=dt.files;oi.dispatchEvent(new Event('change'));await pause();await pause();check(!!owner.node.querySelector('.owner-attachments img'),'admin composer thumbnail');const os=owner.node.querySelector('.owner-send').getBoundingClientRect();check(os.width===34&&os.height===34,'admin round send control');
}catch(e){results.push('ERROR '+e.message);console.error(e)}
document.querySelector('#results').textContent=results.join('\n');
