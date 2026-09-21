import {SceneClock,FlowField,geometry,paletteAt} from './topology-evolving-core.mjs';
// One persistent sketch for all routes. Audio only modulates presentation.
export function installEvolving(win,doc){
 const clock=new SceneClock();let state={active:false,motion:true,user:0,agent:0},levels={user:0,agent:0};
 let sketch=null,ready=false,disposed=false,resizeTimer=0,field=null,particles=null,cx,width=1,height=1,frame=0;
 const count=4500,vector=new Float32Array(2),temp=new Float32Array(2);
 function pause(){sketch?.noLoop();clock.pause();}
 function apply(){if(!ready)return;if(state.active&&state.motion&&!doc.hidden)sketch.loop();else pause();}
 function diagnostic(){const canvas=doc.querySelector('canvas');if(!canvas)return;canvas.dataset.elapsed=clock.seconds.toFixed(2);canvas.dataset.epoch=String(field?.epoch||0);canvas.dataset.palette=String(Math.floor(clock.seconds/100)%8);canvas.dataset.frame=String(frame);}
 function step(dt,prime=false){
  if(!cx||!field)return;
  if(!prime)field.advance(clock.seconds);
  const color=paletteAt(clock.seconds),gain=Math.max(levels.user,levels.agent),speed=dt*60*(1+gain*.3);
  cx.fillStyle=`rgba(0,34,34,${1-Math.exp(-dt*.48)})`;cx.fillRect(0,0,width,height);
  cx.beginPath();
  for(let i=0;i<count;i++){
   const at=i*4,x=particles[at],y=particles[at+1];field.sample(x,y,vector,temp);
   let vx=particles[at+2]+vector[0]*3*speed,vy=particles[at+3]+vector[1]*3*speed;
   const length=Math.hypot(vx,vy)||1;vx=vx/length*2.2;vy=vy/length*2.2;
   const nx=x+vx*speed,ny=y+vy*speed;
   particles[at]=(nx+width+200)%(width+200);particles[at+1]=(ny+height+200)%(height+200);particles[at+2]=vx;particles[at+3]=vy;
   cx.moveTo(x-100,y-100);cx.lineTo(nx-100,ny-100);
  }
  const rgb=color.map(v=>Math.round(v+(255-v)*gain*.22));
  cx.strokeStyle=`rgba(${rgb.join(',')},${.13+gain*.07})`;cx.lineWidth=.75;cx.stroke();frame++;
 }
 function start(){
  if(disposed)return;
  try{sketch=new win.p5(p=>{
   p.setup=()=>{
    const size=geometry(win.innerWidth,win.innerHeight);width=size.width;height=size.height;p.pixelDensity(1);
    const renderer=p.createCanvas(width,height);renderer.parent(doc.querySelector('#topology'));cx=p.drawingContext;
    field=new FlowField((x,y,z)=>p.noise(x,y,z),width,height,clock.seconds);
    particles=new Float32Array(count*4);for(let i=0;i<count;i++){particles[i*4]=p.random(width+200);particles[i*4+1]=p.random(height+200);}
    cx.fillStyle='#002222';cx.fillRect(0,0,width,height);
    // A formed first still also serves Reduced Motion; no empty canvas flash.
    for(let i=0;i<48;i++)step(1/60,true);
    p.frameRate(30);p.noLoop();ready=true;diagnostic();
    win.parent.postMessage({type:'sekkes-topology-ready'},win.location.origin);
    // p5 setup can run inside the constructor before sketch is assigned.
    win.setTimeout(()=>{if(!disposed)apply()},0);
   };
   p.draw=()=>{
    if(disposed||!ready||!state.active||!state.motion||doc.hidden){p.noLoop();clock.pause();return;}
    try{const dt=clock.tick(win.performance.now());if(!dt)return;
     for(const k of ['user','agent'])levels[k]+=(state[k]-levels[k])*(1-Math.exp(-dt*(state[k]>levels[k]?10:3)));
     step(dt);if(frame%15===0)diagnostic();
    }catch{pause();}
   };
  },doc.querySelector('#topology'));}catch{pause();}
 }
 function resize(){win.clearTimeout(resizeTimer);resizeTimer=win.setTimeout(()=>{
  if(!ready||disposed)return;const size=geometry(win.innerWidth,win.innerHeight);if(size.width===width&&size.height===height)return;
  // Keep the same sketch, seed, simulation time and normalized particle paths.
  const old=doc.createElement('canvas');old.width=width;old.height=height;old.getContext('2d').drawImage(sketch.canvas,0,0);
  const sx=(size.width+200)/(width+200),sy=(size.height+200)/(height+200);
  for(let i=0;i<count;i++){particles[i*4]*=sx;particles[i*4+1]*=sy;}
  width=size.width;height=size.height;sketch.resizeCanvas(width,height,true);cx=sketch.drawingContext;cx.drawImage(old,0,0,width,height);
  field.resize(width,height,clock.seconds);diagnostic();
 },180);}
 function message(e){
  if(e.source!==win.parent||e.origin!==win.location.origin||e.data?.type!=='sekkes-topology-state')return;
  const bound=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
  state={active:e.data.active===true,motion:e.data.motion===true,user:bound(e.data.user),agent:bound(e.data.agent)};
  if(!state.active)levels={user:0,agent:0};apply();
 }
 function visibility(){apply();}
 function dispose(){if(disposed)return;disposed=true;pause();win.clearTimeout(resizeTimer);sketch?.remove();win.removeEventListener('message',message);win.removeEventListener('resize',resize);win.removeEventListener('load',start);doc.removeEventListener('visibilitychange',visibility);}
 win.addEventListener('message',message);win.addEventListener('resize',resize);doc.addEventListener('visibilitychange',visibility);
 if(doc.readyState==='complete')start();else win.addEventListener('load',start,{once:true});
 return {dispose};
}
if(typeof window!=='undefined')installEvolving(window,document);
