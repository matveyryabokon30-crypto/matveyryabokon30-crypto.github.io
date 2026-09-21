import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync('vision-talk/pablicus/auto-update.js','utf8'),checks=[];
async function test(name,fn){await fn();checks.push({name,passed:true});console.log('PASS '+name);}
function fixture(){
 let now=100000,active=true,reloads=0,activations=0,updates=0,prepare=async()=>{},busy=false;
 const events={},winEvents={},docEvents={},intervals=[];
 const worker={postMessage:(msg,ports)=>{if(msg?.type==='PABLICUS_RELEASE')queueMicrotask(()=>ports[0].other.onmessage?.({data:{buildId:worker.id}}));},id:'git:new'};
 class Channel{constructor(){this.port1={close(){}};this.port2={close(){}};this.port2.other=this.port1;}}
 const registration={waiting:{postMessage:()=>activations++},update:async()=>updates++,addEventListener(){}};
 const sw={controller:null,register:async()=>registration,addEventListener:(n,fn)=>events[n]=fn};
 const window={PablicusBuild:{id:'git:old'},PablicusCallsActive:()=>active,PablicusUpdateGuards:{busy:()=>busy,prepare:()=>prepare()},addEventListener:(n,fn)=>winEvents[n]=fn};
 const document={readyState:'complete',hidden:false,activeElement:null,addEventListener:(n,fn)=>docEvents[n]=fn,getElementById:()=>null,querySelector:()=>null};
 const context={window,navigator:{onLine:true,serviceWorker:sw},document,location:{href:'https://fixture.invalid/app/',reload:()=>reloads++},Date:{now:()=>now},URL,WeakSet,MessageChannel:Channel,setTimeout,clearTimeout,queueMicrotask,console,setInterval:fn=>intervals.push(fn)};
 vm.runInNewContext(source,context);
 return{setActive:v=>active=v,setBusy:v=>busy=v,setPrepare:f=>prepare=f,document,tick:async()=>{now+=4000;intervals[0]();await new Promise(r=>setImmediate(r));},change:(id='git:new')=>{worker.id=id;sw.controller=worker;registration.waiting=null;events.controllerchange();},resume:async()=>{winEvents.pageshow();await new Promise(r=>setImmediate(r));},counts:()=>({reloads,activations,updates})};
}
await test('waiting worker never activates during call then resumes safely',async()=>{const f=fixture();await f.tick();assert.equal(f.counts().activations,0);f.setActive(false);await f.tick();assert.equal(f.counts().activations,1);});
await test('external controllerchange never reloads active call',async()=>{const f=fixture();await f.tick();f.change();await f.tick();assert.equal(f.counts().reloads,0);f.setActive(false);await f.tick();assert.equal(f.counts().reloads,1);});
await test('call starting while draft persistence waits blocks reload',async()=>{const f=fixture();await f.tick();f.setActive(false);f.setPrepare(async()=>f.setActive(true));f.change();await f.tick();assert.equal(f.counts().reloads,0);});
await test('same-version controller avoids unnecessary reload',async()=>{const f=fixture();await f.tick();f.change('git:old');f.setActive(false);await f.tick();assert.equal(f.counts().reloads,0);});
await test('failed draft persistence blocks reload then automatically retries',async()=>{const f=fixture();await f.tick();f.change();f.setPrepare(async()=>{throw Error('disk busy')});f.setActive(false);await f.tick();assert.equal(f.counts().reloads,0);f.setPrepare(async()=>{});await f.tick();assert.equal(f.counts().reloads,1);await f.tick();assert.equal(f.counts().reloads,1);});
await test('upload or unsaved form blocks replacement',async()=>{const f=fixture();await f.tick();f.change();f.setActive(false);f.setBusy(true);await f.tick();assert.equal(f.counts().reloads,0);f.setBusy(false);await f.tick();assert.equal(f.counts().reloads,1);});
await test('focused typing is not interrupted',async()=>{const f=fixture();await f.tick();f.change();f.setActive(false);f.document.activeElement={tagName:'TEXTAREA'};await f.tick();assert.equal(f.counts().reloads,0);f.document.activeElement=null;await f.tick();assert.equal(f.counts().reloads,1);});
await test('hidden page waits and foreground bypasses periodic cooldown',async()=>{const f=fixture();await f.tick();const before=f.counts().updates;f.change();f.setActive(false);f.document.hidden=true;await f.tick();assert.equal(f.counts().reloads,0);f.document.hidden=false;await f.resume();assert.equal(f.counts().reloads,1);assert(f.counts().updates>before);});
fs.mkdirSync('results',{recursive:true});fs.writeFileSync('results/f06-update-tests.json',JSON.stringify({passed:checks.length,checks},null,2));
