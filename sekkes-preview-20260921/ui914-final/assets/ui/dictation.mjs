// Browser speech-to-text only. Never sends a message or calls the SEKKES AI API.
export class Dictation {
 constructor({Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,onText=()=>{},onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){Object.assign(this,{Recognition,onText,onState});this.setTimer=(...args)=>setTimer(...args);this.clearTimer=(...args)=>clearTimer(...args);this.state='idle';this.generation=0;this.recognition=null;this.timer=null;this.disposed=false}
 get supported(){return Boolean(this.Recognition)}
 get busy(){return ['permission','listening','stopping'].includes(this.state)}
 emit(state,code){this.state=state;this.onState({state,code})}
 start(value=''){
  if(this.busy||this.disposed)return;
  if(!this.supported){this.emit('error','unsupported');return}
  const epoch=++this.generation,prefix=value+(value&&!/\s$/.test(value)?' ':'');let recognition;
  try{recognition=new this.Recognition()}catch{this.emit('error','unsupported');return}
  this.recognition=recognition;recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
  const current=()=>epoch===this.generation&&!this.disposed;
  recognition.onstart=()=>{if(!current()){recognition.abort();return}this.emit('listening')};
  recognition.onresult=e=>{if(!current())return;let text='';for(const result of Array.from(e.results||[]))text+=(result[0]?.transcript||'');this.onText((prefix+text).slice(0,2000))};
  recognition.onerror=e=>{if(current())this.release('error',e.error)};
  recognition.onend=()=>{if(current())this.release('idle')};
  this.emit('permission');
  try{recognition.start();if(!current())return;this.timer=this.setTimer(()=>this.stop(),45000)}catch{this.release('error','start-failed')}
 }
 stop(){
  if(!this.busy)return;
  if(this.state==='permission'){this.cancel();return}
  if(this.state==='stopping')return;
  this.clearTimer(this.timer);this.emit('stopping');
  try{this.recognition.stop();if(this.state!=='stopping')return;this.timer=this.setTimer(()=>this.release('idle'),3000)}catch{this.release('idle')}
 }
 release(state='idle',code){
  ++this.generation;this.clearTimer(this.timer);this.timer=null;const r=this.recognition;this.recognition=null;
  if(r){r.onstart=r.onresult=r.onerror=r.onend=null;try{r.abort()}catch{}}
  this.emit(state,code);
 }
 cancel(){this.release('idle')}
 dispose(){this.disposed=true;this.release('idle')}
}
