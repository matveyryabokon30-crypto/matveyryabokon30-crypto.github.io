import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const whole=readFileSync('vision-talk/pablicus/sw.js','utf8');const code=whole.slice(whole.indexOf('// F02-R1 observations'));assert.ok(whole.includes('// F02-R1 observations'));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc',D='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const P={message_id:C,recipient_id:A,conversation_id:B,sender_name:'Synthetic sender',preview:'Synthetic text',_r1:{attempt_id:D,event_id:C,installation_id:B,token:'a'.repeat(64)}};
const checks=[];function check(n,v){assert.ok(v,n);checks.push({name:n,pass:true});console.log('PASS '+n);}
function fixture({owner=A,networkFail=false,showFail=false,blockReceipt=false,delayRecent=false}={}){
 const h={},receipts=[],shown=[],opened=[],stores={recent:[]};let release;
 let unblockRecent;const recentWait=delayRecent?new Promise(r=>unblockRecent=r):Promise.resolve();
 const blocking=blockReceipt?new Promise(r=>release=r):Promise.resolve();
 const context={PUSH_UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,URL,Date,AbortSignal,Promise,JSON,Set,Number,String,queue:f=>f(),pushOwner:async()=>owner,pushState:async(w,v,k)=>{if(!w&&k==='recent')await recentWait;return w?(stores[k]=v):stores[k];},validClient:u=>u.startsWith('https://app.invalid/'),fetch:async(url,opts)=>{receipts.push({url,options:opts,data:JSON.parse(opts.body)});await blocking;if(networkFail)throw Error('offline');return new Response('{}');},self:{addEventListener:(t,f)=>h[t]=f,registration:{scope:'https://app.invalid/',showNotification:async(t,o)=>{if(showFail)throw Object.assign(Error('secret details'),{name:'NotAllowedError'});shown.push({title:t,...o});}},clients:{matchAll:async()=>[],openWindow:async u=>opened.push(u)}}};
 vm.runInNewContext(code,context);
 const push=p=>{let work;h.push({data:{json:()=>p},waitUntil:p=>work=p});return work;};
 const click=d=>{let work;h.notificationclick({notification:{data:d,close(){}},waitUntil:p=>work=p});return work;};
 return{push,click,receipts,shown,opened,release:()=>release?.(),stores,unblockRecent:()=>unblockRecent?.(),context};
}
const J={kind:'contact_joined',notification_id:C,recipient_id:A,sender_id:B,sender_name:'Личное имя',preview:'Теперь в Pablicus',expires_at:new Date(Date.now()+60000).toISOString(),_r1:P._r1};
try{
 let f=fixture();await f.push(J);check('joined needs no fabricated conversation',f.shown.length===1&&f.shown[0].title==='Личное имя'&&f.shown[0].body==='Теперь в Pablicus'&&!('conversationId' in f.shown[0].data));
 check('joined retains existing R1 observations',f.receipts.map(x=>x.data.state).join(',')==='worker_received,show_resolved');
 check('joined data minimal and event tagged',Object.keys(f.shown[0].data).sort().join(',')==='_r1,eventId,kind,recipientId'&&f.shown[0].tag==='pablicus-joined-'+C);
 await f.push(J);check('duplicate joined suppressed',f.shown.length===1&&f.receipts.at(-1).data.state==='duplicate');
 await f.click(f.shown[0].data);const u=new URL(f.opened[0]);check('cold click only event and bound recipient',u.searchParams.get('joined')===C&&u.searchParams.get('recipient')===A&&[...u.searchParams.keys()].length===2);
 f=fixture();const sent=[];f.context.self.clients.matchAll=async()=>[{url:'https://app.invalid/',focused:true,focus:async()=>{},postMessage:x=>sent.push(x)}];await f.push(J);await f.click(f.shown[0].data);check('warm click requests authorized event view',sent[0].type==='PABLICUS_JOINED_OPEN'&&sent[0].eventId===C&&sent[0].recipientId===A&&!('senderId' in sent[0]));
 f=fixture({owner:B});await f.push(J);check('wrong owner suppressed',!f.shown.length&&f.receipts.at(-1).data.state==='suppressed_owner');await f.click({kind:'contact_joined',recipientId:A,eventId:C});check('wrong owner cannot click through',!f.opened.length);
 for(const expires_at of [undefined,null,'bad',new Date(0).toISOString()]){f=fixture();await f.push({...J,expires_at});check('joined expiry mandatory '+String(expires_at),!f.shown.length&&f.receipts.at(-1).data.state==='expired');}
 for(const patch of [{sender_id:'bad'},{recipient_id:'bad'},{notification_id:'bad'}]){f=fixture();await f.push({...J,...patch});check('invalid joined identity '+Object.keys(patch)[0],!f.shown.length&&!f.receipts.length);}
 f=fixture({showFail:true});await f.push(J);check('show failure not falsely resolved',f.receipts.at(-1).data.state==='show_failed'&&!f.stores.recent.includes(C));
 f=fixture({networkFail:true});await f.push(J);check('optional receipts never gate display',f.shown.length===1);
 f=fixture();await f.push({...J,_r1:undefined});check('without receipt remains supported',f.shown.length===1&&!f.receipts.length);
 f=fixture();await f.push({...J,_r1:{...J._r1,event_id:A}});check('substituted receipt ignored',f.shown.length===1&&!f.receipts.length);
 f=fixture({delayRecent:true});const at=Date.now()+60000,work=f.push({...J,expires_at:new Date(at).toISOString()});await new Promise(r=>setImmediate(r));f.context.Date={now:()=>at,parse:Date.parse};f.unblockRecent();await work;check('deadline rechecked after storage wait',!f.shown.length&&f.receipts.at(-1).data.state==='expired');
 f=fixture();await f.push({...J,message_id:D,conversation_id:B,task_id:D});check('joined cannot become conversation route',!('conversationId' in f.shown[0].data)&&!('taskId' in f.shown[0].data));
}finally{writeFileSync('results/f05-sw-tests.json',JSON.stringify({passed:checks.length,checks,boundary:'Actual SW VM with synthetic transport and storage; no physical device claim.'},null,2));}
