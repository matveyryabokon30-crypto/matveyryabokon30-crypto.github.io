import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const whole=readFileSync('vision-talk/pablicus/sw.js','utf8');const code=whole.slice(whole.indexOf('// F02-R1 observations'));assert.ok(whole.includes('// F02-R1 observations'));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',C='cccccccc-cccc-4ccc-8ccc-cccccccccccc',D='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const P={message_id:C,recipient_id:A,conversation_id:B,sender_name:'Synthetic sender',preview:'Synthetic text',_r1:{attempt_id:D,event_id:C,installation_id:B,token:'a'.repeat(64)}};
const checks=[];function check(n,v){assert.ok(v,n);checks.push({name:n,pass:true});console.log('PASS '+n);}
function fixture({owner=A,networkFail=false,showFail=false,blockReceipt=false}={}){
 const h={},receipts=[],shown=[],opened=[],stores={recent:[]};let release;
 const blocking=blockReceipt?new Promise(r=>release=r):Promise.resolve();
 const context={PUSH_UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,URL,Date,AbortSignal,Promise,JSON,Set,Number,String,queue:f=>f(),pushOwner:async()=>owner,pushState:async(w,v,k)=>w?(stores[k]=v):stores[k],validClient:u=>u.startsWith('https://app.invalid/'),fetch:async(url,opts)=>{receipts.push({url,options:opts,data:JSON.parse(opts.body)});await blocking;if(networkFail)throw Error('offline');return new Response('{}');},self:{addEventListener:(t,f)=>h[t]=f,registration:{scope:'https://app.invalid/',showNotification:async(t,o)=>{if(showFail)throw Object.assign(Error('secret details'),{name:'NotAllowedError'});shown.push({title:t,...o});}},clients:{matchAll:async()=>[],openWindow:async u=>opened.push(u)}}};
 vm.runInNewContext(code,context);
 const push=p=>{let work;h.push({data:{json:()=>p},waitUntil:p=>work=p});return work;};
 const click=d=>{let work;h.notificationclick({notification:{data:d,close(){}},waitUntil:p=>work=p});return work;};
 return{push,click,receipts,shown,opened,release:()=>release?.(),stores};
}
try{
 let f=fixture();await f.push(P);check('visible message retains sender text',f.shown.length===1&&f.shown[0].title===P.sender_name&&f.shown[0].body===P.preview);
 check('received and show resolution are separate observations',f.receipts.map(x=>x.data.state).join(',')==='worker_received,show_resolved');
 check('receipt uses fixed backend and no account token',f.receipts.every(x=>x.url.endsWith('/pablicus-push/receipt')&&x.options.credentials==='omit'&&!x.options.headers.Authorization&&!x.options.headers.apikey));
 await f.click(f.shown[0].data);check('click routes to correct chat',new URL(f.opened[0]).searchParams.get('conversation')===B&&f.receipts.at(-1).data.state==='clicked');
 await f.push(P);check('duplicate event is not displayed twice',f.shown.length===1&&f.receipts.at(-1).data.state==='duplicate');
 f=fixture({owner:B});await f.push(P);check('wrong local account never sees private message',f.shown.length===0&&f.receipts.at(-1).data.state==='suppressed_owner');
 f=fixture({showFail:true});await f.push(P);check('OS notification rejection is observed accurately',f.shown.length===0&&f.receipts.at(-1).data.state==='show_failed'&&f.receipts.at(-1).data.error_code==='NotAllowedError');
 check('raw notification error is not transmitted',!JSON.stringify(f.receipts).includes('secret details'));
 f=fixture({networkFail:true});await f.push(P);check('receipt network error does not suppress notification',f.shown.length===1&&f.stores.recent.includes(C));
 f=fixture({blockReceipt:true});const w=f.push(P);await new Promise(r=>setImmediate(r));check('display does not wait for telemetry response',f.shown.length===1);f.release();await w;
 f=fixture();await f.push({...P,_r1:undefined});check('old payload remains compatible without receipts',f.shown.length===1&&f.receipts.length===0);
 f=fixture();await f.push({...P,_r1:{...P._r1,event_id:A}});check('substituted event capability is not used',f.shown.length===1&&f.receipts.length===0);
 for(const kind of ['task_reminder','task_followup']){
  f=fixture();await f.push({...P,kind,notification_id:C,task_id:D,expires_at:new Date(Date.now()+60000).toISOString(),body:'Task'});check(kind+' retains presentation and receipts',f.shown.length===1&&f.shown[0].data.taskId===D&&f.receipts.at(-1).data.state==='show_resolved');
 }
 f=fixture();await f.push({...P,kind:'task_reminder',notification_id:C,task_id:D,expires_at:new Date(0).toISOString()});check('expired task is not presented',f.shown.length===0&&f.receipts.at(-1).data.state==='expired');
 f=fixture();await f.push({...P,recipient_id:'invalid'});check('malformed payload cannot display or send receipt',f.shown.length===0&&f.receipts.length===0);
}finally{writeFileSync('results/r1-sw-tests.json',JSON.stringify({passed:checks.length,checks,environment:'Exact SW handlers in deterministic VM. Not a physical push delivery test.'},null,2));}
