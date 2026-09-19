import vm from 'node:vm';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const code=readFileSync('vision-talk/pablicus/push-notifications.js','utf8');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',I='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const checks=[];function check(n,v){assert.ok(v,n);checks.push({name:n,pass:true});console.log('PASS '+n);}
function fixture({build='git:'+'f'.repeat(40),permission='granted'}={}){
 let user=A,permissionRequests=0,subscribes=0;const store=new Map([['pablicus:push-owner',A]]),calls=[],worker=[];
 const sub={endpoint:'https://web.push.apple.com/SYNTHETIC',toJSON:()=>({endpoint:sub.endpoint,keys:{p256dh:'key',auth:'key'}}),unsubscribe:async()=>true};
 const reg={scope:'https://app.invalid/pablicus/',active:{postMessage:(msg,ports)=>{worker.push(msg);ports[0].postMessage({ok:true});ports[0].close();}},getNotifications:async()=>[],pushManager:{getSubscription:async()=>sub,subscribe:async()=>{subscribes++;return sub;}}};
 const context={URL,MessageChannel,AbortController,Uint8Array,Promise,setTimeout,clearTimeout,atob,crypto,PushManager:{},Notification:{permission,requestPermission:()=>{permissionRequests++;return Promise.resolve('granted');}},location:{href:reg.scope},isSecureContext:true,matchMedia:()=>({matches:true}),localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},PablicusBuild:{id:build},navigator:{userAgent:'iPhone',serviceWorker:{getRegistration:async()=>reg,ready:Promise.resolve(reg),addEventListener(){},removeEventListener(){}}},fetch:async(url,opt)=>{calls.push({...opt,body:opt.body?JSON.parse(opt.body):null});return Response.json(opt.body&&JSON.parse(opt.body).action==='status'?{ok:true,banner_visibility:'unknown'}:{ok:true,installation_id:I,tracking:'ready'});}};
 context.window=context;vm.runInNewContext(code,context);
 const client=context.PablicusPush.create({projectUrl:'https://fixture.supabase.co',apiKey:'PUBLIC_FIXTURE',getUserId:()=>user,getSession:async()=>({access_token:'USER_SESSION_FIXTURE',user:{id:user}})});
 return{client,calls,worker,store,counts:()=>({permissionRequests,subscribes}),setUser:v=>{user=v;}};
}
try{
 let f=fixture();await f.client.refresh();await f.client.refresh();
 check('existing permitted subscription registered without permission prompt',f.counts().permissionRequests===0&&f.counts().subscribes===0&&f.client.enabled);
 const m=f.calls.filter(x=>x.body?.action==='subscribe').map(x=>x.body.installation);
 check('one stable client identity across refreshes',m.length===2&&m[0].client_id===m[1].client_id);
 check('installation has current build and coarse platform',m[0].build_id==='git:'+'f'.repeat(40)&&m[0].platform==='web_ios');
 check('worker binding receives no session token',!JSON.stringify(f.worker).includes('USER_SESSION')&&f.worker.every(x=>x.recipientId===A));
 check('health request uses server installation identity',(await f.client.inspect()).banner_visibility==='unknown'&&f.calls.at(-1).body.installation_id===I);
 await f.client.signOut();check('logout detaches local observations',(await f.client.inspect()).installation_id===null&&f.worker.at(-1).recipientId===null);
 f.client.destroy();
 f=fixture({permission:'denied'});await f.client.refresh();check('denied permission remains denied without requests',f.calls.length===0&&f.counts().permissionRequests===0);f.client.destroy();
 f=fixture({build:null});await f.client.refresh();check('missing release identity retains legacy registration',f.client.enabled&&f.calls[0].body.installation===undefined);f.client.destroy();
}finally{mkdirSync('results',{recursive:true});writeFileSync('results/r1-client-tests.json',JSON.stringify({passed:checks.length,checks,environment:'Synthetic browser lifecycle; not a physical iPhone.'},null,2));}
