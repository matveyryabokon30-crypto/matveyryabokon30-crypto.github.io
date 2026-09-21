// SEKKES Canvas adaptation of the flow-field idea in Vanta TOPOLOGY.
// Original: Teng Bao / Kjetil Midtgarden Golid. See topology-LICENSE.txt.
// No media capture, network, or dependency on the chat submission path.
import {readLevels} from './lake-visual.mjs';

const scenes = new WeakMap();
const clamp = n => Number.isFinite(n) ? Math.min(1,Math.max(0,n)) : 0;
export function flowAngle(x,y,time=0,voice=0) {
  return -.65 + .64*Math.sin(x*3.1+y*1.6+time*.035)
    + .48*Math.cos(y*4.2-x*1.7-time*.027)
    + .16*Math.sin(x*7-y*5+time*.018) + clamp(voice)*.28*Math.sin(y*5+time*.3);
}
export function sceneSize(width,height) {
  const factor=Math.min(1.5,1000/Math.max(1,width),1200/Math.max(1,height));
  return {width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
}

export function mountTopology(scene,doc=document) {
  const win=doc.defaultView,canvas=doc.createElement('canvas');
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return {dispose(){}};
  canvas.className='topology-visual';canvas.setAttribute('aria-hidden','true');scene.append(canvas);
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  let particles=[],w=0,h=0,clock=0,last=0,raf=0,disposed=false,dirty=true,interval=1000/30,slow=0;
  let target={user:0,agent:0},level={user:0,agent:0};
  const shell=doc.querySelector('#shell');
  const visible=()=>!disposed&&!doc.hidden&&scene.isConnected&&shell?.dataset.route==='home';
  const moving=()=>doc.documentElement.dataset.motion!=='reduced'&&!reduced.matches;
  function seed() {
    const rect=scene.getBoundingClientRect();if(!rect.width||!rect.height)return false;
    const size=sceneSize(rect.width,rect.height);w=canvas.width=size.width;h=canvas.height=size.height;
    let randomSeed=912;const random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};
    particles=Array.from({length:Math.min(1800,Math.max(700,Math.round(w*h/500)))},()=>({x:random()*w,y:random()*h,age:random()*1400}));
    ctx.fillStyle='#002222';ctx.fillRect(0,0,w,h);dirty=false;
    // A complete, non-blank still image on first paint / reduced motion.
    for(let i=0;i<36;i++)draw(1/30,true);
    return true;
  }
  function draw(dt,initial=false) {
    const strength=Math.max(level.user,level.agent),step=(initial?2.5:dt*42)*(1+strength*.85);
    ctx.fillStyle=`rgba(0,34,34,${initial?0:.018})`;ctx.fillRect(0,0,w,h);
    ctx.lineWidth=Math.max(.55,w/1100);ctx.strokeStyle=`rgba(${Math.round(137+level.agent*45)},${Math.round(150+level.agent*35)},${Math.round(78+level.user*55)},${initial?.12:.19+strength*.1})`;
    ctx.beginPath();
    for(const p of particles){
      const angle=flowAngle(p.x/w,p.y/h,clock,strength),x=p.x+Math.cos(angle)*step,y=p.y+Math.sin(angle)*step;
      ctx.moveTo(p.x,p.y);ctx.lineTo(x,y);p.x=x;p.y=y;p.age+=dt;
      if(x<0||x>w||y<0||y>h||p.age>1500){p.x=Math.random()*w;p.y=Math.random()*h;p.age=0;}
    }
    ctx.stroke();
  }
  function frame(now){
    raf=0;if(!visible())return;
    try{
      if(dirty&&!seed()){raf=win.requestAnimationFrame(frame);return;}
      if(!moving())return;
      if(now-last>=interval){
        const dt=last?Math.min(.08,(now-last)/1000):1/30;last=now;clock+=dt;
        for(const k of ['user','agent'])level[k]+=(target[k]-level[k])*(1-Math.exp(-dt*(target[k]>level[k]?12:3)));
        const start=win.performance.now();draw(dt);
        if(win.performance.now()-start>12&&++slow>12)interval=1000/20;
      }
      raf=win.requestAnimationFrame(frame);
    }catch{dispose();}
  }
  function refresh(){
    if(disposed)return;
    if(!visible()){if(raf)win.cancelAnimationFrame(raf);raf=0;last=0;target={user:0,agent:0};return;}
    if(!raf)raf=win.requestAnimationFrame(frame);
  }
  const observer=new win.MutationObserver(refresh);
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-motion']});
  if(shell)observer.observe(shell,{attributes:true,attributeFilter:['data-route']});
  const resize=new win.ResizeObserver(()=>{dirty=true;refresh();});resize.observe(scene);
  doc.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
  function dispose(){
    if(disposed)return;disposed=true;if(raf)win.cancelAnimationFrame(raf);
    observer.disconnect();resize.disconnect();doc.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);
    scenes.delete(scene);canvas.remove();particles=[];
  }
  const controller={dispose,setLevels(value){target={user:clamp(value.user),agent:clamp(value.agent)};}};
  scenes.set(scene,controller);refresh();return controller;
}

// Read only the established call's levels. Never acquire/stop tracks or close pc.
export function startTopologyAudio(pc,doc=document) {
  const win=doc.defaultView;let disposed=false,pending=false,previous=new Map(),epoch=0;
  const scene=()=>doc.querySelector('.home-screen .wallpaper');
  const clear=()=>scenes.get(scene())?.setLevels({user:0,agent:0});
  const active=()=>!disposed&&!doc.hidden&&doc.querySelector('#shell')?.dataset.route==='home';
  async function sample(){
    if(!active()){clear();return;}if(pending||!pc?.getStats)return;
    pending=true;const own=++epoch;
    const timeout=win.setTimeout(()=>{if(own===epoch)clear();},600);
    try{
      const report=await pc.getStats();if(!active()||own!==epoch)return;
      const data=readLevels(report,previous);previous=data.previous;
      scenes.get(scene())?.setLevels({user:clamp(Math.sqrt(data.user)*2.2-.1),agent:clamp(Math.sqrt(data.agent)*2.2-.1)});
    }catch{clear();}finally{win.clearTimeout(timeout);pending=false;}
  }
  const timer=win.setInterval(sample,100);sample();
  return {dispose(){if(disposed)return;disposed=true;epoch++;win.clearInterval(timer);previous.clear();clear();}};
}
