import {ClothField} from './topology-cloth.mjs';
import {restoreSceneClock,saveSceneClock,FlowField,geometry,renderDensity,paletteAt,PALETTE,COLOR_SECONDS} from './topology-evolving-core.mjs';
// One persistent sketch for all routes. Audio only modulates presentation.
export function installEvolving(win,doc){
 let storage;try{storage=win.localStorage}catch{/* Restricted browsing may deny storage. */}
 const clock=restoreSceneClock(storage);let lastSaved=clock.seconds,state={active:false,motion:true,user:0,agent:0},levels={user:0,agent:0};
 let sketch=null,ready=false,disposed=false,resizeTimer=0,field=null,particles=null,ages=null,cloth=null,trails=null,trailCx=null,cx,width=1,height=1,frame=0,density=1,lastChrome=-Infinity;
 const count=4500,vector=new Float32Array(2),temp=new Float32Array(2);
 function persist(force=false){if(!force&&clock.seconds-lastSaved<5)return;lastSaved=clock.seconds;saveSceneClock(storage,clock);}
 function pause(){sketch?.noLoop();clock.pause();persist(true);}
 function apply(){if(!ready)return;if(state.active&&state.motion&&!doc.hidden)sketch.loop();else pause();}
 function diagnostic(){const canvas=doc.querySelector('canvas');if(!canvas)return;canvas.dataset.elapsed=clock.seconds.toFixed(2);canvas.dataset.epoch=String(field?.epoch||0);canvas.dataset.palette=String(Math.floor(clock.seconds/COLOR_SECONDS)%PALETTE.length);canvas.dataset.frame=String(frame);canvas.dataset.angle=cloth.angle.toFixed(3);canvas.dataset.density=String(density);}
 // Share the same clock and palette as the cloth. No canvas sampling: during
 // the nine-second palette hold, moving geometry produces no colour changes.
 function chrome(force=false){
  if(!force&&clock.seconds-lastChrome<.1)return;lastChrome=clock.seconds;
  win.parent.postMessage({type:'sekkes-topology-color',rgb:paletteAt(clock.seconds)},win.location.origin);
 }
 function step(dt,prime=false){
  if(!cx||!field)return;
  if(!prime)field.advance(clock.seconds);
  const time=clock.seconds,windX=.026*Math.cos(time*.17)+.018*Math.sin(time*.071),windY=.026*Math.sin(time*.139)-.018*Math.cos(time*.093);
  const color=paletteAt(time),gain=Math.max(levels.user,levels.agent),speed=dt*60*(1+gain*.3);
  // Fade only the highlight mask. Never erase the material beneath it.
  trailCx.globalCompositeOperation='destination-out';trailCx.fillStyle=`rgba(0,0,0,${1-Math.exp(-dt*.48)})`;trailCx.fillRect(0,0,width,height);
  trailCx.globalCompositeOperation='source-over';trailCx.beginPath();
  for(let i=0;i<count;i++){
   const at=i*4;ages[i]+=dt;
   if(ages[i]>18){ages[i]=0;particles[at]=Math.random()*(width+200);particles[at+1]=Math.random()*(height+200);particles[at+2]=0;particles[at+3]=0;}
   const x=particles[at],y=particles[at+1];field.sample(x,y,vector,temp);
   // Travelling curl and broad wind steer the upper veil independently of the cloth.
   const curl=.55*Math.sin(x*.0035+y*.0023-time*.23),fx=vector[0]-vector[1]*curl+windX,fy=vector[1]+vector[0]*curl+windY;
   let vx=particles[at+2]+fx*3*speed,vy=particles[at+3]+fy*3*speed;
   const length=Math.hypot(vx,vy)||1;vx=vx/length*2.2;vy=vy/length*2.2;
   const nx=x+vx*speed,ny=y+vy*speed;
   particles[at]=(nx+width+200)%(width+200);particles[at+1]=(ny+height+200)%(height+200);particles[at+2]=vx;particles[at+3]=vy;
   trailCx.moveTo(x-100,y-100);trailCx.lineTo(nx-100,ny-100);
  }
  const rgb=color.map(v=>Math.round(v+(255-v)*gain*.22));
  trailCx.strokeStyle=`rgba(255,255,255,${.13+gain*.07})`;trailCx.lineWidth=.75;trailCx.stroke();
  // Recolour the whole mask: old colours cannot accumulate into grey ghosts.
  trailCx.globalCompositeOperation='source-in';trailCx.fillStyle=`rgb(${rgb.join(',')})`;trailCx.fillRect(0,0,width,height);
  if(prime)return;
  cloth.update(field,clock.seconds);cloth.draw(cx,color.map(Math.round));
  cx.globalCompositeOperation='screen';cx.drawImage(trails,0,0,width,height);cx.globalCompositeOperation='source-over';frame++;
 }
 function start(){
  if(disposed)return;
  try{sketch=new win.p5(p=>{
   p.setup=()=>{
    const size=geometry(win.innerWidth,win.innerHeight);width=size.width;height=size.height;density=renderDensity(win.devicePixelRatio,width,height,win.innerWidth);p.pixelDensity(density);
    const renderer=p.createCanvas(width,height);renderer.parent(doc.querySelector('#topology'));cx=p.drawingContext;
    field=new FlowField((x,y,z)=>p.noise(x,y,z),width,height,clock.seconds);
    cloth=new ClothField(width,height);trails=doc.createElement('canvas');trails.width=Math.round(width*density);trails.height=Math.round(height*density);trailCx=trails.getContext('2d');trailCx.setTransform(density,0,0,density,0,0);
    ages=new Float32Array(count);particles=new Float32Array(count*4);for(let i=0;i<count;i++){ages[i]=p.random(17);particles[i*4]=p.random(width+200);particles[i*4+1]=p.random(height+200);}
    cx.fillStyle='#002222';cx.fillRect(0,0,width,height);
    // A formed first still also serves Reduced Motion; no empty canvas flash.
    for(let i=0;i<23;i++)step(1/60,true);step(1/60);
    p.frameRate(30);p.noLoop();ready=true;diagnostic();
    win.parent.postMessage({type:'sekkes-topology-ready'},win.location.origin);chrome(true);
    // p5 setup can run inside the constructor before sketch is assigned.
    win.setTimeout(()=>{if(!disposed)apply()},0);
   };
   p.draw=()=>{
    if(disposed||!ready||!state.active||!state.motion||doc.hidden){p.noLoop();clock.pause();return;}
    try{const dt=clock.tick(win.performance.now());if(!dt)return;
     for(const k of ['user','agent'])levels[k]+=(state[k]-levels[k])*(1-Math.exp(-dt*(state[k]>levels[k]?10:3)));
     step(dt);chrome();persist();if(frame%15===0)diagnostic();
    }catch{pause();}
   };
  },doc.querySelector('#topology'));}catch{pause();}
 }
 function resize(){win.clearTimeout(resizeTimer);resizeTimer=win.setTimeout(()=>{
  if(!ready||disposed)return;const size=geometry(win.innerWidth,win.innerHeight),nextDensity=renderDensity(win.devicePixelRatio,size.width,size.height,win.innerWidth);if(size.width===width&&size.height===height&&nextDensity===density)return;
  // Keep the same sketch, seed, simulation time and normalized particle paths.
  const old=doc.createElement('canvas');old.width=trails.width;old.height=trails.height;old.getContext('2d').drawImage(trails,0,0);
  const sx=(size.width+200)/(width+200),sy=(size.height+200)/(height+200);
  for(let i=0;i<count;i++){particles[i*4]*=sx;particles[i*4+1]*=sy;}
  width=size.width;height=size.height;density=nextDensity;sketch.pixelDensity(density);sketch.resizeCanvas(width,height,true);cx=sketch.drawingContext;
  field.resize(width,height,clock.seconds);cloth.resize(width,height);trails.width=Math.round(width*density);trails.height=Math.round(height*density);trailCx=trails.getContext('2d');trailCx.setTransform(density,0,0,density,0,0);trailCx.drawImage(old,0,0,width,height);cloth.update(field,clock.seconds);cloth.draw(cx,paletteAt(clock.seconds).map(Math.round));cx.globalCompositeOperation='screen';cx.drawImage(trails,0,0,width,height);cx.globalCompositeOperation='source-over';diagnostic();
 },180);}
 function message(e){
  if(e.source!==win.parent||e.origin!==win.location.origin||e.data?.type!=='sekkes-topology-state')return;
  const bound=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
  state={active:e.data.active===true,motion:e.data.motion===true,user:bound(e.data.user),agent:bound(e.data.agent)};
  if(!state.active)levels={user:0,agent:0};apply();
 }
 function visibility(){apply();}
 function dispose(){if(disposed)return;disposed=true;pause();win.clearTimeout(resizeTimer);sketch?.remove();win.removeEventListener('message',message);win.removeEventListener('resize',resize);win.removeEventListener('load',start);win.removeEventListener('pagehide',pause);win.removeEventListener('pageshow',apply);doc.removeEventListener('visibilitychange',visibility);}
 win.addEventListener('message',message);win.addEventListener('resize',resize);win.addEventListener('pagehide',pause);win.addEventListener('pageshow',apply);doc.addEventListener('visibilitychange',visibility);
 if(doc.readyState==='complete')start();else win.addEventListener('load',start,{once:true});
 return {dispose};
}
if(typeof window!=='undefined')installEvolving(window,document);

