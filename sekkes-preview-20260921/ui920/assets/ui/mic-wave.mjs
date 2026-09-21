// The analyser shares the recorder stream; it never requests another microphone.
export function micWave(canvas,{Context=globalThis.AudioContext||globalThis.webkitAudioContext,raf=callback=>globalThis.requestAnimationFrame(callback),caf=id=>globalThis.cancelAnimationFrame(id)}={}){
 let context,source,analyser,frame,stream;
 const paint=canvas.getContext('2d');
 function unlock(){try{context ||= new Context();context.resume().catch(()=>{});}catch{}}
 function pause(){const id=frame;frame=null;if(id!=null)try{caf(id)}catch{}}
 function stop(){pause();for(const node of [source,analyser])try{node?.disconnect()}catch{}source=analyser=stream=null;const old=context;context=null;try{old?.close()?.catch(()=>{})}catch{}}
 function start(input){if(stream===input)return;unlock();if(!context||!paint)return;stream=input;source=context.createMediaStreamSource(input);analyser=context.createAnalyser();analyser.fftSize=512;source.connect(analyser);const data=new Uint8Array(analyser.fftSize),levels=Array(36).fill(0);
  function draw(){if(!analyser)return;analyser.getByteTimeDomainData(data);let energy=0;for(const n of data)energy+=((n-128)/128)**2;levels.shift();levels.push(Math.min(1,Math.sqrt(energy/data.length)*5));const w=canvas.width=canvas.clientWidth*2||480,h=canvas.height=88;paint.clearRect(0,0,w,h);paint.strokeStyle='#eef9ff';paint.lineWidth=4;paint.lineCap='round';levels.forEach((v,i)=>{const x=(i+.5)*w/levels.length,y=Math.max(2,v*36);paint.beginPath();paint.moveTo(x,h/2-y);paint.lineTo(x,h/2+y);paint.stroke()});frame=raf(draw)}draw();
 }
 return {unlock,start,pause,stop};
}
