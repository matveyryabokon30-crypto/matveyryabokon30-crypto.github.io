// Read-only live-call decoration. No microphone capture, audio routing or persisted data.
export function levelFromStats(row, previous) {
  if (Number.isFinite(row.audioLevel)) return Math.max(0, Math.min(1, row.audioLevel));
  const duration = row.totalSamplesDuration - previous?.totalSamplesDuration;
  const energy = row.totalAudioEnergy - previous?.totalAudioEnergy;
  return duration > 0 && energy >= 0 ? Math.min(1, Math.sqrt(energy / duration)) : 0;
}
export function readLevels(report, previous = new Map()) {
  let user = 0, agent = 0;
  const next = new Map();
  report.forEach(row => {
    if ((row.kind || row.mediaType) !== 'audio') return;
    if (!['media-source', 'inbound-rtp'].includes(row.type)) return;
    const value = levelFromStats(row, previous.get(row.id));
    if (row.type === 'media-source') user = Math.max(user, value);
    else agent = Math.max(agent, value);
    next.set(row.id, {totalSamplesDuration:row.totalSamplesDuration, totalAudioEnergy:row.totalAudioEnergy});
  });
  return {user, agent, previous:next};
}
export function coverGeometry(width, height, imageWidth, imageHeight) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  return {scale, x:(width-imageWidth*scale)*.5, y:(height-imageHeight*scale)*.55};
}

export function startLakeVisual(pc, doc = document) {
  const scene = doc.querySelector('.home-screen .wallpaper');
  if (!scene || !pc?.getStats) return {dispose(){}};
  const win = doc.defaultView, shell = doc.querySelector('#shell');
  const canvas = doc.createElement('canvas'), base = doc.createElement('canvas');
  const ctx = canvas.getContext('2d'), bx = base.getContext('2d');
  if (!ctx || !bx) return {dispose(){}};
  canvas.className = 'lake-visual';canvas.setAttribute('aria-hidden','true');canvas.hidden = true;
  scene.append(canvas);
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, raf = 0, dirty = true, last = 0, clock = 0, lastStats = 0;
  let pending = false, previous = new Map(), targets = {user:0,agent:0}, levels = {user:0,agent:0};
  let geometry, image, w = 0, h = 0, interval = 1000/30, slow = 0;
  const allowed = () => !disposed && !doc.hidden && scene.isConnected && shell?.dataset.route === 'home'
    && doc.documentElement.dataset.motion !== 'reduced' && !reduced.matches;
  function prepare() {
    image = scene.querySelector('img');
    if (!image?.complete || !image.naturalWidth) return false;
    const rect = scene.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const factor = Math.min(1, 480/rect.width, 900/rect.height);
    w = Math.round(rect.width*factor);h = Math.round(rect.height*factor);
    canvas.width = base.width = w;canvas.height = base.height = h;
    geometry = coverGeometry(w,h,image.naturalWidth,image.naturalHeight);
    bx.drawImage(image,geometry.x,geometry.y,image.naturalWidth*geometry.scale,image.naturalHeight*geometry.scale);
    dirty = false;return true;
  }
  function glow(x,y,rx,ry,color,alpha) {
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,w,h);
    const iw=image.naturalWidth*geometry.scale, ih=image.naturalHeight*geometry.scale;
    const X=n=>geometry.x+iw*n, Y=n=>geometry.y+ih*n;
    const user=levels.user, agent=levels.agent, strength=Math.max(user,agent);
    // Clip to open water in the existing 2:3 lake artwork, not mountains/shore.
    const polygon=[[.23,.58],[.71,.58],[.76,.65],[.80,.72],[.78,.79],[.35,.80],[.26,.74],[.22,.66]];
    ctx.save();ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.closePath();ctx.clip();
    const top=Math.max(0,Math.floor(Y(.58))), bottom=Math.min(h,Math.ceil(Y(.80)));
    for(let y=top;y<bottom;y+=3){
      const edge=Math.min(1,Math.max(0,(y-Y(.58))/24),Math.max(0,(Y(.80)-y)/30));
      const shift=Math.sin(y*.12-clock*1.25)*(.35+strength*1.8)*edge;
      ctx.globalAlpha=edge*.85;
      ctx.drawImage(base,0,y,w,Math.min(3,h-y),shift,y,w,Math.min(3,h-y));
    }
    ctx.globalAlpha=1;
    for(let i=0;i<5;i++){
      const p=(clock*.11+i/5)%1,rx=iw*(.035+p*.22);
      ctx.beginPath();ctx.ellipse(X(.50),Y(.66+p*.095),rx,rx*.07,0,0,Math.PI*2);
      ctx.lineWidth=.8;ctx.strokeStyle=`rgba(193,237,240,${Math.sin(p*Math.PI)*(.035+user*.18)})`;ctx.stroke();
    }
    glow(X(.55),Y(.66),iw*.085,ih*.10,'244,229,185',.025+agent*.19);
    ctx.restore();
    glow(X(.51)+Math.sin(clock*.11)*iw*.035,Y(.557),iw*.33,ih*.017,'192,224,231',.06+strength*.055);
  }
  function sample(now) {
    if(pending||now-lastStats<100)return;
    pending=true;lastStats=now;
    // Never wait for stats in the media path or start overlapping requests.
    Promise.resolve().then(()=>disposed?null:pc.getStats()).then(report=>{
      if(!allowed()||!report)return;
      const read=readLevels(report,previous);previous=read.previous;
      const normalize=n=>Math.min(1,Math.max(0,Math.sqrt(n)*2.2-.10));
      targets={user:normalize(read.user),agent:normalize(read.agent)};
    }).catch(()=>{targets={user:0,agent:0};}).finally(()=>{pending=false;});
  }
  function frame(now) {
    raf=0;if(!allowed()){canvas.hidden=true;return;}
    try{
      if(now-last>=interval){
        const dt=last?Math.min((now-last)/1000,.1):0;last=now;clock+=dt;
        if(dirty&&!prepare()){raf=win.requestAnimationFrame(frame);return;}
        sample(now);if(now-lastStats>500)targets={user:0,agent:0};
        for(const key of ['user','agent'])levels[key]+=(targets[key]-levels[key])*(1-Math.exp(-dt*(targets[key]>levels[key]?16:4)));
        const begin=win.performance.now();draw();canvas.hidden=false;
        if(win.performance.now()-begin>14&&++slow>15)interval=1000/20;
      }
      raf=win.requestAnimationFrame(frame);
    }catch{dispose();} // Decoration cannot strand a call, even on canvas failure.
  }
  function refresh() {
    if(disposed)return;
    if(canvas.parentNode!==scene)scene.append(canvas);
    if(!allowed()){
      if(raf)win.cancelAnimationFrame(raf);raf=0;canvas.hidden=true;last=0;
      targets={user:0,agent:0};levels={user:0,agent:0};previous.clear();return;
    }
    dirty=true;if(!raf)raf=win.requestAnimationFrame(frame);
  }
  const observer = new win.MutationObserver(refresh);
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-theme','data-motion']});
  if(shell)observer.observe(shell,{attributes:true,attributeFilter:['data-route']});
  const resize = new win.ResizeObserver(refresh);resize.observe(scene);
  scene.addEventListener('load',refresh,true);doc.addEventListener('visibilitychange',refresh);
  reduced.addEventListener('change',refresh);
  function dispose() {
    if(disposed)return;disposed=true;
    if(raf)win.cancelAnimationFrame(raf);raf=0;
    observer.disconnect();resize.disconnect();scene.removeEventListener('load',refresh,true);
    doc.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);
    canvas.remove();previous.clear();targets={user:0,agent:0};
    // pc and all tracks belong to the caller; never stop/close/change them here.
  }
  refresh();return {dispose};
}
