import {initialize} from './assets/ui/app.mjs';
const vv=new EventTarget();Object.assign(vv,{height:innerHeight,width:innerWidth,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{value:vv});
const turns=Array.from({length:25},(_,i)=>({id:'admin-'+i,user_text:'Задание '+i,reply:'Ответ администратора '+i,created_at:new Date(2026,8,23,10,i).toISOString(),answered_at:new Date(2026,8,23,10,i).toISOString(),status:'completed'}));
window.SekkesS2={updateReady:false,busy:false,voiceActive:false,saveDraft(){},ownerRequest:async p=>p==='status'?{owner:true,active:true}:{turns,media:[],documents:[],costs:{},budget_cap_usd:1},loadEarlier:async()=>{},chatMedia:async()=>{},sendText:async()=>{const input=document.querySelector('#draft');SekkesUI.render('user',input.value,{id:'sent-'+Date.now()});input.value='';}};
initialize();const pause=()=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Paint frames stalled')),5000);let left=4;function next(){if(--left)requestAnimationFrame(next);else{clearTimeout(timeout);resolve();}}requestAnimationFrame(next);});const wait=async fn=>{for(let i=0;i<60&&!fn();i++)await pause();if(!fn())throw Error('Timeout')};
await wait(()=>document.querySelector('.messages'));SekkesUI.account({id:'synthetic-qa'});SekkesUI.status('');
const results=document.querySelector('#testResults');
document.querySelector('#runCheck').onclick=async()=>{try{
SekkesUI.history(Array.from({length:40},(_,i)=>({id:'history'+i,speaker:i%2?'assistant':'user',text:'История после входа '+i,at:new Date(2026,8,23,12,i).toISOString()})));
await pause();const list=document.querySelector('.messages'),form=document.querySelector('#composer');
const checks=[['history opens on startup',!list.closest('[hidden]')],['startup at last',list.scrollHeight-list.clientHeight-list.scrollTop<3],['composer below history',list.getBoundingClientRect().bottom<=form.getBoundingClientRect().top+3]];
results.textContent=checks.map(([n,v])=>(v?'PASS ':'FAIL ')+n).join('\n');
}catch(e){results.textContent='FAIL '+e.message}};
